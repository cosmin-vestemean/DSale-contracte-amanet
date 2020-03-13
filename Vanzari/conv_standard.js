var folderPath = 'C:\\S1Print\\ftp\\',
urlMtrls = 'https://dev.creditamanet.ro/Backend_controller/ping_for_items_s1',
urlDocs = 'https://dev.creditamanet.ro/api/sendDocsOnEmail',
tipartituraFac = 510,
tipartituraGar = 301;

function EXECCOMMAND(cmd) {
	if (cmd == '20181122') {
		X.EXEC('XCMD:CONVERTDLG,SOSOURCE:1351');
	}
}

function ON_POST() {
	calcul_regim_special();
}

function ON_AFTERPOST() {
	regim_special();
	add_points();
	calc_points();
	inactivare_voucher();

	status_contracte();

	if (SALDOC.FPRMS == 7000 || SALDOC.FPRMS == 7900) {
		//debugger;
		comm1(true);
		X.PROCESSMESSAGES;
	}

	// Transmitere array articole pentru update stoc pe website
	if (SALDOC.FPRMS == 7000 || SALDOC.FPRMS == 7900) {
		var fin = SALDOC.FINDOC ? SALDOC.FINDOC : X.NEWID;
		sendJson(fin, urlMtrls, 1);
	}
}

function ON_DELETE() {
	docID();
	DsConv = X.GETSQLDATASET('select findoc from mtrlines where findocs=' + vID, null);
	if (DsConv.RECORDCOUNT > 0)
		X.EXCEPTION('Stergere nepermisa, flux tranzactii!');
}

function ON_AFTERDELETE() {
	docID();
	// update ID Nota lichidare: macheta procesare contracte expirate
	X.RUNSQL('update custlines set cint04=null where cint04=' + vID, null);

	DsSursa = X.GETSQLDATASET('select isnull(fprms,0) as fprms, isnull(sosource,0) as sosource from findoc where findoc=' + SALDOC.FINDOCS, null);

	if (SALDOC.FPRMS == 3000 || SALDOC.FPRMS == 3900) {
		if (DsSursa.fprms == 1000) // Lichidare
		{
			//update status contract: 5000 - Expirat
			X.RUNSQL('update inst set utbl04=5000 where inst=' + SALDOC.INST, null);
		}
		if (DsSursa.fprms == 1100) // Reactivare
		{
			//update status contract: 4100 - Transferat
			X.RUNSQL('update inst set utbl04=4100, cccrpr=0, cccrprdate=null where inst=' + SALDOC.INST, null);
		}
	}

	// update status proces sursa: Incomplet
	X.RUNSQL('update findoc set bool01=0 where sosource=1015 and findoc=' + SALDOC.FINDOCS, null);

	// Transmitere array articole pentru update stoc pe website
	if (SALDOC.FPRMS == 7000 || SALDOC.FPRMS == 7900) {
		var fin = SALDOC.FINDOC ? SALDOC.FINDOC : X.NEWID;
		sendJson(fin, urlMtrls, 1);
	}

	status_contracte();
}

function ON_RESTOREEVENTS() {
	if (SALDOC.FPRMS == 7900) {
		// In caz de retur, returul e face in magazia de vanzare aferenta agentiei din care s-a facturat
		ITELINES.FIRST;
		while (!ITELINES.Eof) {
			ITELINES.WHOUSE = SALDOC.BRANCH;
			ITELINES.NEXT;
		}
	}

	if (SALDOC.FPRMS == 7000) {
		DsSursa = X.GETSQLDATASET('select finstates from findoc where findoc=' + ITELINES.FINDOCS, null);
		if (DsSursa.finstates == 40000) {
			X.WARNING('Comanda necesita aprobare!'); // X.EXCEPTION nu apare in RESTOREEVENTS, desi se aplica
			X.EXEC('button:Cancel');
		}

		ceData = X.FORMATDATE('yyyymmdd', SALDOC.TRNDATE);
		ceData = String.fromCharCode(39) + ceData + String.fromCharCode(39);

		ITELINES.FIRST;
		while (!ITELINES.Eof) {
			DsMagStoc = X.GETSQLDATASET('select top 1 whouse as whouse from mtrfindata where fiscprd=Year(GetDate()) and mtrl=' + ITELINES.MTRL + ' order by qty1 desc', null);
			ITELINES.WHOUSE = DsMagStoc.whouse;

			DsCost = X.GETSQLDATASET('select top 1 purmmtk as purmmtk from mtrcprices where mtrl=' + ITELINES.MTRL + ' and fiscprd=year(' + ceData + ') and period<=month(' + ceData + ') order by period desc', null);
			if (DsCost.RECORDCOUNT == 0)
				DsCost = X.GETSQLDATASET('select purmmtk from mtrcprices where mtrl=' + ITELINES.MTRL + ' and fiscprd=year(' + ceData + ') and period=1000', null);

			ceCost = DsCost.purmmtk;
			ITELINES.SALESCVAL = ceCost;

			// preluare adaos si TVA neexigibil
			DsNx = X.GETSQLDATASET('select cccadd, cccvat from mtrl where mtrl=' + ITELINES.MTRL, null);
			ITELINES.NUM03 = DsNx.cccadd;
			ITELINES.NUM04 = DsNx.cccvat;

			ITELINES.NEXT;
		}
	}

	if (SALDOC.FPRMS == 7900) {
		DsPuncte = X.GETSQLDATASET('select cardpoints, negcardpoints from findoc where findoc=' + ITELINES.FINDOCS, null);
		//SALDOC.CARDPOINTS = (-1)*DsPuncte.cardpoints; (anuleaza valoarea din camp, standard la salvare - realizat in AFTERPOST: add_points)
		SALDOC.NEGCARDPOINTS = (-1) * DsPuncte.negcardpoints;

		ceData = X.FORMATDATE('yyyymmdd', SALDOC.TRNDATE);
		ceData = String.fromCharCode(39) + ceData + String.fromCharCode(39);
		ITELINES.FIRST;
		while (!ITELINES.Eof) {
			// Preluare cost
			calcul_cost();
			ITELINES.SALESCVAL = ceCost;

			// preluare adaos si TVA neexigibil
			DsNx = X.GETSQLDATASET('select cccadd, cccvat from mtrl where mtrl=' + ITELINES.MTRL, null);
			ITELINES.NUM03 = DsNx.cccadd;
			ITELINES.NUM04 = DsNx.cccvat;

			ITELINES.NEXT;
		}
	}
}

function ON_ITELINES_QTY1() {
	// Preluare cost
	calcul_cost();
	ITELINES.SALESCVAL = ceCost * ITELINES.QTY1;
}

function ON_ITELINES_BEFOREDELETE() {
	X.EXCEPTION('Stergere nepermisa!');
}

function ON_SRVLINES_BEFOREDELETE() {
	X.EXCEPTION('Stergere nepermisa!');
}

function calcul_cost() {
	ceData = X.FORMATDATE('yyyymmdd', SALDOC.TRNDATE);
	ceData = String.fromCharCode(39) + ceData + String.fromCharCode(39);
	DsCost = X.GETSQLDATASET('select top 1 purmmtk as purmmtk from mtrcprices where mtrl=' + ITELINES.MTRL + ' and fiscprd=year(' + ceData + ') and period<=month(' + ceData + ') order by period desc', null);
	if (DsCost.RECORDCOUNT == 0)
		DsCost = X.GETSQLDATASET('select purmmtk from mtrcprices where mtrl=' + ITELINES.MTRL + ' and fiscprd=year(' + ceData + ') and period=1000', null);

	ceCost = DsCost.purmmtk;
	return ceCost;
}

function calcul_regim_special() {
	ITELINES.FIRST;
	while (!ITELINES.Eof) {
		DsTipVat = X.GETSQLDATASET('select cccshtype from vat where vat=' + ITELINES.VAT, null);
		if (DsTipVat.cccshtype == 1) {
			DsVatPrc = X.GETSQLDATASET('select percnt from vat where vat=(select vats2 from vat where vat=' + ITELINES.VAT + ')', null);
			cePrc = DsVatPrc.percnt;
			ceMarja = Math.round((ITELINES.LTRNLINEVAL - ITELINES.SALESCVAL) * 100) / 100;
			//ceMarja = Math.round(ceMarja *100 / (1+cePrc/100))/100;
			//ceVat = Math.round(ceMarja * cePrc)/100;

			if (ceMarja < 0) // Daca adaos negativ, nu se calculeaza tva
				cePrc = 0;

			ceMarja = (ceMarja / (1 + cePrc / 100)); // fara aproximare la 2 zecimale, sa nu iasa dif zecimale la calcul TVA
			ceVat = Math.round(ceMarja * cePrc) / 100;
			ceMarja = Math.round(ceMarja * 100) / 100;

			ITELINES.PLSMVAL = ceMarja;
			ITELINES.PLSMVAT = ceVat;
		}

		ITELINES.NEXT;
	}
}

function status_contracte() {
	ITELINES.FIRST;
	while (!ITELINES.Eof) {
		DsStoc = X.GETSQLDATASET('select sum(isnull(qty1,0)) as stoc from mtrfindata where fiscprd=' + X.SYS.FISCPRD + ' and mtrl=' + ITELINES.MTRL, null);

		if (DsStoc.stoc > 0)
			X.RUNSQL('update inst set isactive=1 where inst=(select cccinst from mtrl where mtrl=' + ITELINES.MTRL + ')', null);
		else
			X.RUNSQL('update inst set isactive=0 where inst=(select cccinst from mtrl where mtrl=' + ITELINES.MTRL + ')', null);

		ITELINES.NEXT;
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
	//SALDOC.CARDPOINTS = catePuncte;

	docID();
	DsSemn = X.GETSQLDATASET('select (flg01+flg02) as semn from tprms tp ' +
			' join trdtrn td on td.sodtype=tp.sodtype and td.company=tp.company and td.tprms=tp.tprms ' +
			' where td.findoc=' + vID, null);

	catePuncte = catePuncte * DsSemn.semn;

	X.RUNSQL('update findoc set cardpoints=' + catePuncte + ' where findoc=' + vID, null);
}

function inactivare_voucher() {
	if (SALDOC.CCCVOUCHER > 0)
		X.RUNSQL('update voucher set voucherstates=3 , upddate=GETDATE() where voucher=' + SALDOC.CCCVOUCHER, null);
}

function regim_special() {
	docID();

	// Regim special pe factura daca contine integral bunuri sh, eventual si 0%
	DsLS = X.GETSQLDATASET('select findoc from mtrlines where isnull(vat,0)<>198 and isnull(vat,0)<>0 and findoc=' + vID, null);
	if (DsLS.RECORDCOUNT == 0)
		X.RUNSQL('update findoc set BGOTHRVAT=21, VATSTS=0 where findoc=' + vID, null);
	else
		X.RUNSQL('update findoc set BGOTHRVAT=null, VATSTS=(select vatsts from trdr where trdr=findoc.trdr) where findoc=' + vID, null);
}

function docID() {
	if (SALDOC.FINDOC < 0)
		vID = X.NEWID;
	else
		vID = SALDOC.FINDOC;
	return vID;
}

function composeJsonMtrls() {
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

function uploadMe() {
	//tipareste 510 so 301
	//si trimte-le pe server ftp
	//dupa trimitere set flag trimitere pe 1, ca sa nu le mai trimit o data
	//daca nu am reusit sa upload returnez false si ma rechem. Daca da, pa.
	//daca anulare/stergere, cauta si sterge din ftp.
	//daca au ajuns pe ftp sterge-le local.

	docID();
	var check = printMe(vID);
	if (check.succes && check.f1 && check.f2) {
		if (ftpMe(check.f1, check.f2)) {
			//delete local copies
			//delFiles(check.f1, check.f2);
		}
	} else {
		X.WARNING('Nu am gasit pdf-urile aferente tipariturilor, nu am ce trimite.');
	}
}

function delFiles(f1, f2) {
	var objFSO = new ActiveXObject("Scripting.FileSystemObject");

	objFSO.DeleteFile(f1);
	objFSO.DeleteFile(f2);
}

function ftpMe(f1, f2) {
	try {
		var oShell = new ActiveXObject("Shell.Application"),
		host = '37.251.149.223',
		usr = 'ftp-user01',
		pwd = 'StxwQtgtDCQHD01%21%23',
		wd = '',
		sFile = '',
		an = new Date().getFullYear(),
		luna = new Date().getMonth(),
		vArguments = '/log="' + folderPath + 'WinSCP.log" /loglevel=2 /ini=nul /command "open ftp://' + usr + ':' + pwd + '@' + host + '" "put ' + f1 + '" "put ' + f2 + '" "exit"',
		vDirectory = "",
		vOperation = "open",
		vShow = 0,
		WshShell = new ActiveXObject("WScript.Shell");
		wd = WshShell.CurrentDirectory;
		sFile = wd + '\\WinSCP.com';
		oShell.ShellExecute(sFile, vArguments, vDirectory, vOperation, vShow);
		return true;
	} catch (e) {
		X.WARNING(e.message);
		return false;
	}
}

function printMe(findoc) {
	//tiparire
	var ret = {},
	path = folderPath + findoc,
	ObjSaldoc = X.CreateObj('SALDOC'),
	f1 = path + '-510.PDF',
	f2 = path + '-301.PDF';
	try {
		ObjSaldoc.DBLocate(findoc);
		ObjSaldoc.PRINTFORM(510, 'PDF file', f1);
		ObjSaldoc.PRINTFORM(301, 'PDF file', f2);
		ret.succes = true;
		ret.f1 = f1;
		ret.f2 = f2;
	} catch (e) {
		X.WARNING(e.message + '\nAsigurati-va ca exista urmatoarea cale pe disk: ' + folderPath);
		ret.succes = false;
		ret.f1 = null;
		ret.f2 = null;
	}
	finally {
		ObjSaldoc.FREE;
		ObjSaldoc = null;
	}

	return ret;
}

function comm1(scurt) {
	//debugger;
	var fin = SALDOC.FINDOC > 0 ? SALDOC.FINDOC : X.NEWID;

	if (scurt) {
		//daca a mai fost salvat in db, trimite de acolo
		var aa = X.GETSQLDATASET('select isnull(idfactura, 0) FINDOC, FACTURA64, GARANTIA64 from cccpdffactura where isnull(idfactura, 0)=' + fin, null);
		if (aa.RECORDCOUNT) {
			//trimte spre site
			sendJson(fin, urlDocs, 2, aa.FACTURA64, aa.GARANTIA64);
			return;
		}
	}

	//debugger;
	var fac = printToPDF('SALDOC', fin, tipartituraFac),
	gar;

	if (SALDOC.FPRMS == 7000) {
		//debugger;
		gar = printToPDF('SALDOC', fin, tipartituraGar);
	} else {
		gar = '';
	}

	//debugger;
	if (fac) {
		var fac64 = converBinToBase64(fac),
		gar64;
		if (gar) {
			gar64 = converBinToBase64(gar);
		} else {
			gar64 = '';
		}

		//salveaza-le ultima versiune in db, pentru preluare pe web service apis
		ITELINES.FIRST;

		var q = 'delete from CCCPDFFACTURA where IDFACTURA=' + fin;
		X.RUNSQL(q, null);

		q = "INSERT INTO CCCPDFFACTURA (IDFACTURA, IDCOMANDA, FACTURA64, GARANTIA64, SENTDATE) VALUES (" + fin + "," +
			ITELINES.FINDOCS + ",'" + fac64 + "','" + gar64 + "', '" + formatDate(new Date()) + "')";
		X.RUNSQL(q, null);
	}

	//trimte spre site
	//debugger;
	sendJson(fin, urlDocs, 2, fac64, gar64, fac, gar);
}

function sendJson(fin, url, x, f, g, facFile, garFile) {
	//debugger;
	try {
		var xmlhttp = new ActiveXObject("MSXML2.XMLHTTP.6.0");
		var dataToSend = x == 1 ? composeJsonMtrls() : composeJsonDocs(f, g, fin);
		xmlhttp.open("POST", url, true);
		xmlhttp.setRequestHeader("Content-Type", "application/json");
		xmlhttp.onreadystatechange = function () {
			if (xmlhttp.readyState != 4)
				return;
			if (xmlhttp.status != 200 & xmlhttp.status != 304) {
				X.WARNING('HTTP error ' + xmlhttp.status);
			}

			if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
				callback(xmlhttp, arguments.length, facFile, garFile);
			}
		}

		//debugger;
		xmlhttp.send(dataToSend);

	} catch (err) {
		X.WARNING(err.message);
	}
}

function callback(xmlhttp, len, facFile, garFile) {
	//X.WARNING(xmlhttp.responseText);
	try {
		//arguments.length
		if (len > 5) {
			if (facFile)
				stergePDFs(facFile);
			if (garFile)
				stergePDFs(garFile);
		}
	} catch (err) {}
}

function stergePDFs(f) {
	var fso;
	try {
		fso = new ActiveXObject("Scripting.FileSystemObject");
		fso.DeleteFile(f);
	} catch (err) {}
}

function composeJsonDocs(f64, g64, fin) {
	//debugger;
	ITELINES.FIRST;

	var jsonGar = '',
	scop = '',
	xx,
	yy;

//if (X.SQL('select top 1 findoc from mtrlines where findoc='+ITELINES.FINDOCS, null))
//scop = 'storno_fara_comanda';
	//debugger;
	if (g64) {
		jsonGar = ',' +
			'{' +
			'"name":"Garantia aferenta",' +
			'"base64":"' + g64 + '"' +
			'}';

		if (ITELINES.FINDOCS) {
			scop = 'aprobare_comanda';
			xx = ITELINES.FINDOCS;
		}
		else {
			if (SALDOC.FPRMS == 7000) {
				scop = 'factura_fara_comanda';
				xx = 'factura_fara_comanda';
			}
		}
	} else {
		yy = X.SQL('select top 1 findocs from mtrlines where findoc='+ITELINES.FINDOCS, null);
		if (yy) {
			scop = 'storno_comanda';
			xx = yy;
		} else {
			scop = 'storno_fara_comanda';
			xx = 'storno_fara_comanda';
		}
	}

	cusEmail = X.SQL('select email from trdr where trdr=' + SALDOC.TRDR, null);
	var unescapedStr = '{' +
		'"data_trimiterii":"' + formatDate(new Date()) + '",' +
		'"TRDR":"' + SALDOC.TRDR + '",' +
		'"name":"' + SALDOC.TRDR_CUSTOMER_NAME + '",' +
		'"email":"' + cusEmail + '",' +
		//'"email":"marketing@creditamanet.ro",' +
		//'"email":"cosmin.ve@gmail.com",' +
		'"scope":"' + scop + '",' +
		'"idDoc":"' + xx + '",' +
		'"data_docs":"' + X.FORMATDATE('yyyymmdd', SALDOC.TRNDATE) + '",' +
		'"docs":[' +
		'{' +
		'"name":"'+ X.SQL('select fincode from findoc where findoc='+fin, null) + '",' +
		'"base64":"' + f64 + '"' +
		'}' +
		jsonGar +
		']}';

	var jsonObj = JSON.parse(unescapedStr);
	var jsonStr = JSON.stringify(jsonObj);

	return jsonStr;
}

function formatDate(date) {
	var d = new Date(date),
	month = '' + (d.getMonth() + 1),
	day = '' + d.getDate(),
	year = d.getFullYear();

	if (month.length < 2)
		month = '0' + month;
	if (day.length < 2)
		day = '0' + day;

	//delimiter
	return [year, month, day].join('');
}

function printToPDF(modul, findoc, tipartitura) {
	//tiparire
	//debugger;
	var ret = false,
	path = folderPath + findoc,
	oMod = X.CreateObj(modul),
	file = path + '-' + tipartitura + '.PDF';
	try {
		oMod.DBLocate(findoc);
		X.PROCESSMESSAGES;
		try {
			oMod.PRINTFORM(tipartitura, 'PDF file', file);
			ret = file;
		} catch (err1) {
			X.WARNING(err1.message + '\nAsigurati-va ca exista urmatoarea cale pe disk: ' + folderPath);
			ret = false;
		}
	} catch (err2) {
		X.WARNING(err2.message);
		ret = false;
	}
	finally {
		oMod.FREE;
		oMod = null;
	}

	return ret;
}

function converBinToBase64(filePath) {
	var inputStream = new ActiveXObject('ADODB.Stream');
	inputStream.Open();
	inputStream.Type = 1; // adTypeBinary
	inputStream.LoadFromFile(filePath);
	X.PROCESSMESSAGES;
	var bytes = inputStream.Read();
	var dom = new ActiveXObject('Microsoft.XMLDOM');
	var elem = dom.createElement('tmp');
	elem.dataType = 'bin.base64';
	elem.nodeTypedValue = bytes;
	return elem.text.replace(/[^A-Z\d+=\/]/gi, '');
}

/*
var urlMtrls = 'https://dev.creditamanet.ro/Backend_controller/ping_for_items_s1',
urlDocs = 'https://dev.creditamanet.ro/api/sendDocsOnEmail',
tipartituraFac = 510,
tipartituraGar = 301;

function ON_AFTERPOST() {
	if (SALDOC.FPRMS == 7000 || SALDOC.FPRMS == 7900) {
		//debugger;
		comm1(true);
		X.PROCESSMESSAGES;
	}

	// Transmitere array articole pentru update stoc pe website
	if (SALDOC.FPRMS == 7000 || SALDOC.FPRMS == 7900) {
		var fin = SALDOC.FINDOC ? SALDOC.FINDOC : X.NEWID;
		sendJson(fin, urlMtrls, 1);
	}
}

function ON_AFTERDELETE() {
if (SALDOC.FPRMS == 7000 || SALDOC.FPRMS == 7900) {
	var fin = SALDOC.FINDOC ? SALDOC.FINDOC : X.NEWID;
	sendJson(fin, urlMtrls, 1);
}
}
*/
