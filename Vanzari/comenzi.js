var vStatus = null,
esteModif = false,
recno = 0,
urlUpdOrd='https://dev.creditamanet.ro/api/updateOrder/',
urlPing='https://dev.creditamanet.ro/Backend_controller/ping_for_items_s1';

function ON_LOCATE() {
	vStatus = SALDOC.FINSTATES;
	recno = ITELINES.RECORDCOUNT;
}

function EXECCOMMAND(cmd) {
	if (cmd == '20181122') {
		if (SALDOC.FINSTATES != 400)
			X.EXCEPTION('Comanda necesita aprobare!');

		if (SALDOC.UFTBL01 == 100)
			X.EXEC('XCMD:RETAILDOC,N,CNV:1');
		else
			X.EXEC('XCMD:CONVERTDLG,SOSOURCE:1351');
	}
}

function ON_POST() {
	// Mutare in Submodul Retail la modificare in Cash
	if (SALDOC.FPRMS == 5000 && SALDOC.UFTBL01 == 100)
		SALDOC.SOREDIR = 10000;
}

function ON_AFTERPOST() {
	calc_points();
	inactivare_voucher();

	if (SALDOC.FPRMS == 5000) {
		docID();

		if (SALDOC.ISCANCEL == 1)
			X.RUNSQL('update mtrl set cccrez=0 where mtrl in(select mtrl from mtrlines where findoc=' + vID + ') ', null);
		else
			X.RUNSQL('update mtrl set cccrez=1 where mtrl in(select mtrl from mtrlines where findoc=' + vID + ') ', null);

		sendOrderJson(urlPing, composeJson());

		if (vStatus != SALDOC.FINSTATES){
			debugger;
			sendOrderJson(urlPing, composeJson1());
		}
	}

	if (SALDOC.FINDOC > 0 && ITELINES.RECORDCOUNT != recno && esteModif) {
		//debugger;
		var json = updateOrder1();
		if (json) {
			sendOrderJson(urlUpdOrd, json);
			esteModif = false;
		}
	}
}

function ON_DELETE() {
	if (SALDOC.FPRMS == 5000) {
		docID();
		X.RUNSQL('update mtrl set cccrez=0 where mtrl in(select mtrl from mtrlines where findoc=' + vID + ') ', null);
		sendOrderJson(urlPing, composeJson());
	}
}

function ON_AFTERDELETE() {
	calc_points();
}

function ON_SALDOC_FINSTATES() {

	// Anulare comanda
	if (SALDOC.FINSTATES == 300) {
		docID();
		DsStat = X.GETSQLDATASET('select finstates from findoc where findoc=' + vID, null);

		//debugger;
		X.EXEC('button:Save');
		X.EXEC('XCMD:1001');

		if (SALDOC.FINSTATES == 300 && SALDOC.ISCANCEL != 1) // Nu s-a anulat comanda
			X.RUNSQL('update findoc set finstates=' + DsStat.finstates + ' where findoc=' + vID, null);
	}

	//Aprobare comanda
	if (SALDOC.FINSTATES == 400) {
		docID();
		DsStatus = X.GETSQLDATASET('select finstates from findoc where findoc=' + vID, null);
		//X.EXEC('button:Save');

		DsDepart = X.GETSQLDATASET('select depart from prsn where users=' + X.SYS.USER + ' and company=' + X.SYS.COMPANY, null);
		if (DsDepart.depart == 1700) // Trezorerie
			ceDepart = 1200; // Bijuterii
		else
			ceDepart = DsDepart.depart;

		if (DsDepart.RECORDCOUNT == 0) {
			SALDOC.FINSTATES = 410;
			X.EXCEPTION('Definiti departament utilizator!');
		}

		DsDep = X.GETSQLDATASET('select distinct mg.cccdepart as depart from mtrgroup mg   ' +
				' join mtrl m on m.mtrgroup=mg.mtrgroup and m.company=mg.company ' +
				' join mtrlines ml on m.mtrl = ml.mtrl ' +
				' join findoc f on ml.findoc=f.findoc ' +
				' where m.sodtype=51 and f.findoc=' + vID, null);

		if (CCCFINDOCAPP.DEPART > 0) {
			if (CCCFINDOCAPP.LOCATE('DEPART', ceDepart) == 1) {
				CCCFINDOCAPP.FINSTATESOLD = DsStatus.finstates;
				CCCFINDOCAPP.FINSTATENEW = SALDOC.FINSTATES;
				CCCFINDOCAPP.USERS = X.SYS.USER;
				Ds = X.GETSQLDATASET('select getdate() as data', null);
				CCCFINDOCAPP.USERTIME = Ds.data;
			}
		} else {

			DsDep.FIRST;
			while (!DsDep.Eof) {
				CCCFINDOCAPP.APPEND;
				CCCFINDOCAPP.DEPART = DsDep.depart;
				if (ceDepart == CCCFINDOCAPP.DEPART) {
					CCCFINDOCAPP.FINSTATESOLD = DsStatus.finstates;
					CCCFINDOCAPP.FINSTATENEW = SALDOC.FINSTATES;
					CCCFINDOCAPP.USERS = X.SYS.USER;
					Ds = X.GETSQLDATASET('select getdate() as data', null);
					CCCFINDOCAPP.USERTIME = Ds.data;
				}
				CCCFINDOCAPP.POST;

				DsDep.NEXT;
			}
		}

		invalid = 0;
		CCCFINDOCAPP.FIRST;
		while (!CCCFINDOCAPP.Eof) {
			if (CCCFINDOCAPP.FINSTATENEW != 400)
				invalid += 1;
			CCCFINDOCAPP.NEXT;
		}
		//if (valid>0)
		//SALDOC.FINSTATES=400;
		if (invalid > 0)
			SALDOC.FINSTATES = 410;
	}
}

function ON_ITELINES_MTRL_VALIDATE() {
	if (SALDOC.SERIES > 0) {}
	else
		X.EXCEPTION('Selectati serie document!');
}

function ON_ITELINES_BEFOREDELETE() {
	docID()
	if (vID > 0)
		X.EXCEPTION('Stergere nepermisa!');
}

function ON_SRVLINES_BEFOREDELETE() {
	docID()
	//if (vID>0)
	//X.EXCEPTION('Stergere nepermisa!');

	//validare stergere discount card fidelitate
	DsSrv = X.GETSQLDATASET('select cardsrv from cccacomm where branch=1000', null);
	if (SRVLINES.MTRL == DsSrv.cardsrv && (SALDOC.NEGCARDPOINTS < 0 || SALDOC.NEGCARDPOINTS > 0)) {
		X.EXCEPTION('S-a utilizat card de fidelitate!');
		//SALDOC.NEGCARDPOINTS=null;
	}

	// validare stergere discount voucher
	DsSrv = X.GETSQLDATASET('select vousrv from cccacomm where branch=1000', null);
	if (SRVLINES.MTRL == DsSrv.vousrv && SALDOC.CCCVOUCHER > 0) {
		X.EXCEPTION('S-a utilizat voucher!');
		//SALDOC.CCCVOUCHER=null;
	}

	// validare stergere discount voucher
	DsSrv = X.GETSQLDATASET('select prosrv from cccacomm where branch=1000', null);
	if (SRVLINES.MTRL == DsSrv.prosrv && SALDOC.PRJC > 0) {
		X.EXCEPTION('S-a utilizat promotie!');
		//SALDOC.PRJC=null;
	}
}

function calc_points() {
	docID();
	DsCalc = X.GETSQLDATASET('select isnull(tb.opoints,0)+sum(isnull(f.cardpoints,0)-isnull(f.negcardpoints,0)) as points, tb.trdr ' +
			'from trdrbonuscard tb ' +
			'left join findoc f on tb.bonuscard=f.bonuscard and isnull(f.iscancel,0)=0 ' +
			'where tb.trdr=' + SALDOC.TRDR + ' and tb.bonuscard=' + SALDOC.BONUSCARD +
			' group by tb.trdr, tb.bonuscard, tb.opoints', null);

	X.RUNSQL('update trdrbonuscard set points=' + DsCalc.points + ' where bonuscard=' + SALDOC.BONUSCARD + ' and trdr=' + SALDOC.TRDR, null);
}

function add_points() {
	DsAddRate = X.GETSQLDATASET('select value from cardcategory where cardcategory=200', null);
	ceRata = DsAddRate.value;
	catePuncte = Math.round(SALDOC.SUMAMNT * ceRata) / 100;

	docID();
	X.RUNSQL('update findoc set cardpoints=' + catePuncte + ' where findoc=' + vID, null);
}

function inactivare_voucher() {
	if (SALDOC.CCCVOUCHER > 0)
		X.RUNSQL('update voucher set voucherstates=3 , upddate=GETDATE() where voucher=' + SALDOC.CCCVOUCHER, null);
}

function docID() {
	if (FINDOC.FINDOC < 0)
		vID = X.NEWID;
	else
		vID = FINDOC.FINDOC;
	return vID;
}

function sendJson() {
	try {
		var xmlhttp = new ActiveXObject("MSXML2.XMLHTTP.6.0");
		//var url = 'http://m-web-design.ro/receive_product.php';
		var url = 'https://dev.creditamanet.ro/Backend_controller/ping_for_items_s1';
		var dataToSend = composeJson();
		xmlhttp.open("POST", url, false);
		xmlhttp.setRequestHeader("Content-Type", "application/json");
		xmlhttp.send(dataToSend);
		if (xmlhttp.readyState == 4) {
			if (xmlhttp.status == 200) {
				var raspuns = xmlhttp.responseText;
				//X.WARNING(raspuns);
			}
		}
	} catch (err) {
		X.WARNING(err.message);
	}
}

function composeJson() {
	var jsonToSend = '[';
	ITELINES.FIRST;
	while (!ITELINES.EOF) {
		jsonToSend += ITELINES.MTRL + ',';
		ITELINES.NEXT;
	}

	jsonToSend = jsonToSend.substring(0, jsonToSend.length - 1);
	jsonToSend += ']';

	//return CUSTFINDOC.FINDOC;
	return jsonToSend;
}

function sendJson1() {
	try {
		var xmlhttp = new ActiveXObject("MSXML2.XMLHTTP.6.0");
		//var url = 'http://m-web-design.ro/receive_product.php';
		var url = 'https://dev.creditamanet.ro/Backend_controller/ping_for_orders_s1';
		var dataToSend = composeJson1();
		xmlhttp.open("POST", url, false);
		xmlhttp.setRequestHeader("Content-Type", "application/json");
		xmlhttp.send(dataToSend);
		if (xmlhttp.readyState == 4) {
			if (xmlhttp.status == 200) {
				var raspuns = xmlhttp.responseText;
				//X.WARNING('Status comanda id: '+raspuns);
			}
		}
	} catch (err) {
		X.WARNING(err.message);
	}
}

function composeJson1() {
	var jsonToSend = '[';

	docID;
	jsonToSend += vID;

	jsonToSend += ']';

	//X.WARNING(jsonToSend);
	return jsonToSend;
}

function updateOrder() {
	var q = "SELECT A.FINDOC " +
		"	,A.TRNDATE DataDoc " +
		"	,A.FINCODE Doc " +
		"	,A.BRANCH " +
		"	,h.name NumeSucursala " +
		"	,A.TRDR " +
		"	,E.CODE AS CodClient " +
		"	,E.NAME AS NumeClient " +
		"	,A.FULLYTRANSF Conversie " +
		"	,A.FINSTATES STATUS " +
		"	,i.name DenumireStatus " +
		"	,A.SHIPMENT Transport " +
		"	,j.Name DenumireTransport " +
		"	,A.PAYMENT TermenPlata " +
		"	,k.name DenumireTermenPlata " +
		"	,ISNULL(A.LDISC1VAL, 0) AS Disc1DocLei " +
		"	,ISNULL(A.SUMLAMNT, 0) AS SumaDocLei " +
		"	,A.UFTBL01 ModPlata " +
		"	,l.name DenumireModPlata " +
		"	,A.CCCTRDR ContClient " +
		"	,G.CODE AS CodContClient " +
		"	,G.NAME AS NumeContClient " +
		"	,A.CCCAWB AWB " +
		"	,C.LINENUM AS Linie " +
		"	,C.MTRL " +
		"	,D.CODE AS CodArticol " +
		"	,D.WEBNAME AS DenumWebArticol " +
		"	,ISNULL(C.PRICE, 0) AS Pret " +
		"	,ISNULL(C.LDISC1VAL, 0) AS DiscVal " +
		'	,"NaturaLiniei" = CASE  ' +
		"		WHEN c.sodtype = 51 " +
		"			THEN 'Articol' " +
		"		WHEN c.sodtype = 52 " +
		"			THEN 'Serviciu' " +
		"		END " +
		"	, (select STRING_AGG(findoc, ', ') from mtrlines where findocs=a.findoc and mtrlines=(select top 1 mtrlines from mtrlines where findocs=a.findoc)) as idfact " +
		"FROM FINDOC A " +
		"LEFT JOIN MTRDOC B ON A.FINDOC = B.FINDOC " +
		"LEFT JOIN MTRLINES C ON C.FINDOC = A.FINDOC " +
		"LEFT JOIN MTRL D ON C.MTRL = D.MTRL " +
		"LEFT JOIN TRDR E ON A.TRDR = E.TRDR " +
		"LEFT JOIN TRDR G ON A.CCCTRDR = G.TRDR " +
		"LEFT JOIN branch h ON (h.branch = a.branch AND h.company=a.company) " +
		"LEFT JOIN finstates i ON ( " +
		"		a.finstates = i.finstates " +
		"		AND i.isactive = 1 AND i.company=a.company " +
		"		) " +
		"LEFT JOIN shipment j ON ( " +
		"		a.shipment = j.shipment " +
		"		AND j.isactive = 1 AND j.company=a.company " +
		"		) " +
		"LEFT JOIN payment k ON ( " +
		"		a.payment = k.payment " +
		"		AND k.isactive = 1 AND k.sodtype=13 AND k.company=a.company " +
		"		) " +
		"LEFT JOIN UFTBL01 l ON ( " +
		"		a.UFTBL01 = l.UFTBL01 " +
		"		AND l.isactive = 1 AND l.company=a.company " +
		"		) " +
		"WHERE A.COMPANY = :X.SYS.COMPANY " +
		"	AND A.SOSOURCE = 1351 " +
		"	AND A.FPRMS IN (5000) " +
		"	AND A.SODTYPE = 13 " +
		"	and a.findoc = " + SALDOC.FINDOC;

	var ds = X.GETSQLDATASET(q, null);

	if (ds.RECORDCOUNT) {
		var finalJ = '{"document": "comanda modificata","totalcount":' + ds.RECORDCOUNT + ',"rows":' + ds.JSON + '}';
		X.WARNING(finalJ);
		return finalJ;
	} else {
		return null;
	}
}

function sendOrderJson(url, dataToSend) {
	//debugger;
	try {
		var xmlhttp = new ActiveXObject("MSXML2.XMLHTTP.6.0");
		xmlhttp.open("POST", url, true);
		xmlhttp.setRequestHeader("Content-Type", "application/json");
		xmlhttp.onreadystatechange = function () {
			if (xmlhttp.readyState != 4)
				return;
			if (xmlhttp.status != 200 & xmlhttp.status != 304) {
				X.WARNING('HTTP error ' + xmlhttp.status);
			}

			if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
				callMePlease(xmlhttp, arguments.length);
			}
		}

		xmlhttp.send(dataToSend);

	} catch (err) {
		X.WARNING(err.message);
	}
}

function callMePlease(xmlhttp) {
	X.WARNING(xmlhttp.responseText);
	X.PROCESSMESSAGES;
}

function ON_ITELINES_NEW() {
	esteModif = true;
}

function ON_ITELINES_DELETE() {
	esteModif = true;
}

function ON_ITELINES_LINEVAL() {
	esteModif = true;
}

function updateOrder1() {
	var trs = 0,
	shp ='',
	shpid = 0,
	mdpName = '',
	mdpid = 0,
	disc = SALDOC.DISC1VAL + SALDOC.DISC2VAL,
	tara ='',
	judet = '';
	if (SRVLINES.LOCATE('MTRL', 74532) == 1) {
		trs = SRVLINES.LINEVAL;
	}

	if (SALDOC.SHIPMENT) {
		shpid = SALDOC.SHIPMENT;
		shp = X.SQL('select name from shipment where shipment=' + SALDOC.SHIPMENT, null)
	}

	if (SALDOC.UFTBL01) {
		mdpid = SALDOC.UFTBL01;
		mdpName = X.SQL('select name from uftbl01 where uftbl01=' + SALDOC.UFTBL01, null)
	}

	//debugger;

	var ds = X.GETSQLDATASET('select NAME, PHONE01, ADDRESS, COUNTRY, DISTRICT1 from trdr where trdr=' + SALDOC.TRDR, null);

	if (ds.COUNTRY) {
		tara = X.SQL('select name from country where country = '+ds.COUNTRY, null);
	}

	if (ds.DISTRICT1) {
		judet = X.SQL('select name from district where district='+ds.DISTRICT1, null);
	}

	str = '{';
	str += '"findoc":"' + SALDOC.FINDOC + '",';
	str += '"Doc":"' + SALDOC.FINCODE + '",';
	str += '"TRDR":"' + SALDOC.TRDR + '",';
	str += '"NumeClient":"' + ds.NAME + '",';
	str += '"PrenumeClient":"' + ds.NAME + '",';
	str += '"Telefon":"' + ds.PHONE01 + '",';
	str += '"Tara":"' + tara + '",';
	str += '"Judet":"' + judet + '",';
	str += '"Oras":"' + SALDOC.TRDR_CUSTOMER_CITY + '",';
	str += '"Strada":"' + ds.ADDRESS + '",';
	str += '"StatusComanda":"' + SALDOC.FINSTATES + '",';
	str += '"DenumireStatusComanda":"' + X.SQL('select name from finstates where finstates='+SALDOC.FINSTATES, null) + '",';
	str += '"Transport":"' + shpid + '",';
	str += '"DenumireTransport":"' + shp + '",';
	str += '"PretTransport":"' + trs + '",';
	str += '"ModPlata":"' + mdpid + '",';
	str += '"DenumireModPlata":"' + mdpName + '",';
	str += '"Discount":"' + disc.toFixed(4) + '",';
	str += '"Total":"' + SALDOC.SUMAMNT + '",';
	str += '"Produse": [';
	ITELINES.DISABLECONTROLS;
	ITELINES.FIRST;
	try {
		while (!ITELINES.EOF) {
			str += '{"MTRL":"'+ITELINES.MTRL+'",';
			str += '"CodArticol":"'+ITELINES.MTRL_ITEM_NAME+'",';
			str += '"DenumWebArticol":"'+ITELINES.MTRL_ITEM_WEBNAME+'",';
			str += '"Pret":"'+ITELINES.LINEVAL+'"}';
			if (ITELINES.RECNO < ITELINES.RECORDCOUNT) {
				str += ',';
			}
			ITELINES.NEXT;
		}
		str += ']}';
	} catch (err) {
		X.WARNING(err.message);
	}
	finally {
		ITELINES.ENABLECONTROLS;
	}

	var jsonObj = JSON.parse(str);
	var jsonStr = JSON.stringify(jsonObj);
	//X.WARNING(jsonStr);
	return jsonStr;
}
