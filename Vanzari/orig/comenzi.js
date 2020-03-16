var vStatus=null;

function ON_LOCATE()
{
	vStatus = SALDOC.FINSTATES;
}

function EXECCOMMAND(cmd)
{
if (cmd=='20181122')
	{
	if (SALDOC.FINSTATES != 400)
	X.EXCEPTION('Comanda necesita aprobare!');

	if (SALDOC.UFTBL01==100)
	X.EXEC('XCMD:RETAILDOC,N,CNV:1');
	else
	X.EXEC('XCMD:CONVERTDLG,SOSOURCE:1351');
	}
}

function ON_POST()
{
	// Mutare in Submodul Retail la modificare in Cash
	if (SALDOC.FPRMS==5000 && SALDOC.UFTBL01 == 100)
	SALDOC.SOREDIR = 10000;
}

function ON_AFTERPOST()
{
	calc_points();
	inactivare_voucher();

	if (SALDOC.FPRMS==5000)
	{
	docID();

	if (SALDOC.ISCANCEL==1)
	X.RUNSQL('update mtrl set cccrez=0 where mtrl in(select mtrl from mtrlines where findoc='+vID+') ',null);

	else
	X.RUNSQL('update mtrl set cccrez=1 where mtrl in(select mtrl from mtrlines where findoc='+vID+') ',null);

	sendJson();

	if (vStatus!=SALDOC.FINSTATES)
	sendJson1();
	}
}

function ON_DELETE()
{
	if (SALDOC.FPRMS==5000)
	{
	docID();
	X.RUNSQL('update mtrl set cccrez=0 where mtrl in(select mtrl from mtrlines where findoc='+vID+') ',null);
	sendJson();
	}
}

function ON_AFTERDELETE()
{
	calc_points();
}

function ON_SALDOC_FINSTATES()
{

	// Anulare comanda
	if (SALDOC.FINSTATES==300)
	{
	docID();
	DsStat = X.GETSQLDATASET('select finstates from findoc where findoc='+vID,null);

	X.EXEC('button:Save');
	X.EXEC('XCMD:1001');

	if (SALDOC.FINSTATES==300 && SALDOC.ISCANCEL!=1) // Nu s-a anulat comanda
	X.RUNSQL('update findoc set finstates='+DsStat.finstates+' where findoc='+vID,null);
	}


	//Aprobare comanda
	if (SALDOC.FINSTATES == 400)
	{
	docID();
	DsStatus = X.GETSQLDATASET('select finstates from findoc where findoc='+vID,null);
	//X.EXEC('button:Save');

	DsDepart = X.GETSQLDATASET('select depart from prsn where users='+X.SYS.USER+' and company='+X.SYS.COMPANY,null);
	if (DsDepart.depart==1700) // Trezorerie
	ceDepart = 1200; // Bijuterii
	else
	ceDepart = DsDepart.depart;


	if (DsDepart.RECORDCOUNT==0)
	{
	SALDOC.FINSTATES=410;
	X.EXCEPTION('Definiti departament utilizator!');
	}



	DsDep = X.GETSQLDATASET('select distinct mg.cccdepart as depart from mtrgroup mg   '+
					' join mtrl m on m.mtrgroup=mg.mtrgroup and m.company=mg.company '+
					' join mtrlines ml on m.mtrl = ml.mtrl '+
					' join findoc f on ml.findoc=f.findoc '+
					' where m.sodtype=51 and f.findoc='+vID,null);

	if (CCCFINDOCAPP.DEPART>0)
	{
	if(CCCFINDOCAPP.LOCATE('DEPART',ceDepart) == 1)
	{
	CCCFINDOCAPP.FINSTATESOLD = DsStatus.finstates;
	CCCFINDOCAPP.FINSTATENEW = SALDOC.FINSTATES;
	CCCFINDOCAPP.USERS = X.SYS.USER;
	Ds = X.GETSQLDATASET('select getdate() as data',null);
	CCCFINDOCAPP.USERTIME = Ds.data;
	}
	}

	else
	{

	DsDep.FIRST;
	while(!DsDep.Eof)
	{
	CCCFINDOCAPP.APPEND;
	CCCFINDOCAPP.DEPART = DsDep.depart;
	if (ceDepart==CCCFINDOCAPP.DEPART)
	{
	CCCFINDOCAPP.FINSTATESOLD = DsStatus.finstates;
	CCCFINDOCAPP.FINSTATENEW = SALDOC.FINSTATES;
	CCCFINDOCAPP.USERS = X.SYS.USER;
	Ds = X.GETSQLDATASET('select getdate() as data',null);
	CCCFINDOCAPP.USERTIME = Ds.data;
	}
	CCCFINDOCAPP.POST;

	DsDep.NEXT;
	}
	}

	invalid = 0;
	CCCFINDOCAPP.FIRST;
	while(!CCCFINDOCAPP.Eof)
	{
	if (CCCFINDOCAPP.FINSTATENEW!=400)
	invalid+=1;
	CCCFINDOCAPP.NEXT;
	}
	//if (valid>0)
	//SALDOC.FINSTATES=400;
	if (invalid>0)
	SALDOC.FINSTATES=410;
	}
}

function ON_ITELINES_MTRL_VALIDATE()
{
	if (SALDOC.SERIES>0) {}
	else
	X.EXCEPTION('Selectati serie document!');
}

function ON_ITELINES_BEFOREDELETE()
{
	docID()
	if (vID>0)
	X.EXCEPTION('Stergere nepermisa!');
}

function ON_SRVLINES_BEFOREDELETE()
{
	docID()
	//if (vID>0)
	//X.EXCEPTION('Stergere nepermisa!');

	//validare stergere discount card fidelitate
		DsSrv = X.GETSQLDATASET('select cardsrv from cccacomm where branch=1000',null);
		if (SRVLINES.MTRL==DsSrv.cardsrv&&(SALDOC.NEGCARDPOINTS<0 || SALDOC.NEGCARDPOINTS>0))
		{
		X.EXCEPTION('S-a utilizat card de fidelitate!');
		//SALDOC.NEGCARDPOINTS=null;
		}

		// validare stergere discount voucher
		DsSrv = X.GETSQLDATASET('select vousrv from cccacomm where branch=1000',null);
		if (SRVLINES.MTRL==DsSrv.vousrv&&SALDOC.CCCVOUCHER>0)
		{
		X.EXCEPTION('S-a utilizat voucher!');
		//SALDOC.CCCVOUCHER=null;
		}

		// validare stergere discount voucher
		DsSrv = X.GETSQLDATASET('select prosrv from cccacomm where branch=1000',null);
		if (SRVLINES.MTRL==DsSrv.prosrv&&SALDOC.PRJC>0)
		{
		X.EXCEPTION('S-a utilizat promotie!');
		//SALDOC.PRJC=null;
		}
}

function calc_points()
{
docID();
DsCalc = X.GETSQLDATASET('select isnull(tb.opoints,0)+sum(isnull(f.cardpoints,0)-isnull(f.negcardpoints,0)) as points, tb.trdr '+
		'from trdrbonuscard tb '+
		'left join findoc f on tb.bonuscard=f.bonuscard and isnull(f.iscancel,0)=0 '+
		'where tb.trdr='+SALDOC.TRDR+' and tb.bonuscard='+SALDOC.BONUSCARD+
		' group by tb.trdr, tb.bonuscard, tb.opoints',null);

X.RUNSQL('update trdrbonuscard set points='+DsCalc.points+' where bonuscard='+SALDOC.BONUSCARD+' and trdr='+SALDOC.TRDR,null);
}

function add_points()
{
	DsAddRate = X.GETSQLDATASET('select value from cardcategory where cardcategory=200',null);
	ceRata = DsAddRate.value;
	catePuncte = Math.round(SALDOC.SUMAMNT * ceRata)/100;

	docID();
	X.RUNSQL('update findoc set cardpoints='+catePuncte+' where findoc='+vID,null);
}

function inactivare_voucher()
{
	if (SALDOC.CCCVOUCHER>0)
	X.RUNSQL('update voucher set voucherstates=3 , upddate=GETDATE() where voucher='+SALDOC.CCCVOUCHER,null);
}

function docID()
{
    if (FINDOC.FINDOC < 0)
        vID = X.NEWID;
    else
        vID = FINDOC.FINDOC;
    return vID;
}

function sendJson()
{
	DsDB = X.GETSQLDATASET('select db_id() as db',null);
	if (DsDB.db==6){
		try {
			var xmlhttp = new ActiveXObject("MSXML2.XMLHTTP.6.0");
			//var url = 'http://m-web-design.ro/receive_product.php';
			var url = 'https://creditamanet.ro/Backend_controller/ping_for_items_s1';
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
}


function composeJson () {
	var jsonToSend = '[';
	ITELINES.FIRST;
	while (!ITELINES.EOF) {
		jsonToSend += ITELINES.MTRL+',';
		ITELINES.NEXT;
	}

	jsonToSend = jsonToSend.substring(0, jsonToSend.length -1);
	jsonToSend += ']';

	//return CUSTFINDOC.FINDOC;
	return jsonToSend;
}

function sendJson1()
{
	DsDB = X.GETSQLDATASET('select db_id() as db',null);
	if (DsDB.db==6){
		try {
			var xmlhttp = new ActiveXObject("MSXML2.XMLHTTP.6.0");
			//var url = 'http://m-web-design.ro/receive_product.php';
			var url = 'https://creditamanet.ro/Backend_controller/ping_for_orders_s1';
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
}

function composeJson1 () {
	var jsonToSend = '[';

		docID;
		jsonToSend += vID;

	jsonToSend += ']';

	//X.WARNING(jsonToSend);
	return jsonToSend;
}
