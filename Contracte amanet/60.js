var cePayType = 2;
var vdel=0;
var folderPath = 'C:\\S1Print\\doc\\',
itsMe = false,
urlDummy='https://dev.creditamanet.ro/api/test',
urlEmail='https://dev.creditamanet.ro/api/sendDocsOnEmail',
countms = '',
tipInst;

function ON_POST()
{
 if (INST.CCCACOMM>0) {}
 else
 X.EXCEPTION('Grila comision: nu exista!');

 validare_perioada();

		docID();

		// Validare suplimentara - acte aditionale dublate
		if (vID==0)
		{
		DsValidare = X.GETSQLDATASET('select inst from inst where isnull(cccinsts,0)>0 and cccinsts='+INST.CCCINSTS,null);
		if (DsValidare.RECORDCOUNT>0)
		{
		X.EXCEPTION('Salvare nepermisa, exista alt act aditional generat!');
		}
		}

		if (INST.CCCITESUM>0)
		{
		 sum=0;
			INSTLINES.FIRST;
			while(!INSTLINES.Eof)
			{
			if (INSTLINES.PRICE==0||INSTLINES.PRICE<0||INSTLINES.MTRL=='')
			sum+=1;

			INSTLINES.NEXT;
			}
			if (sum>0)
			X.EXCEPTION('Valoare necorespunzatoare articole/imprumut!');
		}
		else
		X.EXCEPTION('Valoare necorespunzatoare imprumut!');

		interogare_SMS();

		if (INST.UTBL04!=1100&&INST.UTBL04!=1200)
		{
		validare_ID();

		formare_nume();

		//Interogare Alerta SMS la acordare imprumut
		//interogare_SMS();

		docID();


		// Aplicare promotie la salvare contract/act aditional, doar la intocmire; ulterior, se aplica doar la recalculare in grid comisioane
		if (INST.PRJC>0) {}
		else
		validare_use_promo();

		// Aplicare Promotii - Act Aditional// (?) id=0 cand nu e salvat...
		if (vID<0)
		validare_use_promo();

		//Validare acordare imprumut inainte de salvare contract


		if (INST.CCCINSTS > 0)
		DsImprumut = X.GETSQLDATASET('select findoc from findoc where sosource=1351 and fprms=9000 and inst='+INST.CCCINST,null);
		else
		DsImprumut = X.GETSQLDATASET('select findoc from findoc where sosource=1351 and fprms=9000 and inst='+vID,null);

		if (DsImprumut.RECORDCOUNT ==0)
		{
		var ans;
		ans = X.ASK('Salvare','Acordati imprumutul?');

		if (ans==6)
		{
			if (INST.BRANCH==X.SYS.BRANCH) // Se acorda imprumut doar din agentia logarii
			{}		// Mergi mai departe... se acorda imprumutul in AFTERPOST
			else
			X.EXCEPTION('Sucursala necorespunzatoare!');
		}

		else
		{
		INST.PRJC=null;
		X.EXCEPTION('Actiune anulata!');
		}
	  }


		}



		/*if (vID==0)  // Mutat la acordare imprumut
		{
		DsGDPR = X.GETSQLDATASET('select consent, noconsent from trdr where trdr='+INST.TRDR,null);
		INST.CCCCONSENT = DsGDPR.consent;
		INST.CCCNOCONSENT = DsGDPR.noconsent;
		}*/
}

function ON_AFTERPOST()
{
		if (INST.UTBL04!=1100&&INST.UTBL04!=1200)
		{
		docID();

		// Contract ID - doar pt. Contracte, nu si acte aditionale
		if (INST.CCCCNTRTYPE==1||INST.CCCCNTRTYPE==3)
		{
		X.RUNSQL('update inst set cccinst='+vID+' where inst='+vID,null);
		}


		if (INST.CCCINSTS > 0)
		DsImprumut = X.GETSQLDATASET('select findoc from findoc where sosource=1351 and fprms=9000 and inst='+INST.CCCINST,null);
		else
		DsImprumut = X.GETSQLDATASET('select findoc from findoc where sosource=1351 and fprms=9000 and inst='+vID,null);

		if (DsImprumut.RECORDCOUNT == 0)
		{
		plata_imprumut();

		getGDPR();
		}


		//Contract ID - doar pt. Acte aditionale, nu si acte aditionale
		if (INST.CCCCNTRTYPE==2)
		{
		getGDPR();

		// update status/activ act precedent
		X.RUNSQL('update inst set utbl04=3000, isactive=0 where inst='+INST.CCCINSTS,null);
		}


		// Rezolvare bug - la stergerea liniei din INSTLINES, nu se sterg liniile aferente din INSTLINESS
		docID();
		DsBug = X.GETSQLDATASET('select instlines, instliness from instlines where isnull(instliness,0)>0 and instliness not in '+
					'(select instlines from instlines where inst='+vID+') and inst='+vID,null);
		if (DsBug.RECORDCOUNT>0)
		{
		DsBug.FIRST;
		while (!DsBug.Eof)
		{
		X.RUNSQL('delete from instlines where inst='+vID+' and instliness='+DsBug.instliness,null);
		DsBug.NEXT;
		}
		}
		// End Rezolvare Bug
		}

		// Operare conditii speciale
		/*if (INST.BOOL04==1 && (X.SYS.GROUPS==1000 || X.SYS.GROUPS==100) && INST.UTBL04 == 1100)
		{
		docID();
		X.RUNSQL('update inst set utbl04 = 1200 where inst='+vID,null);
		}*/


		// Operare conditii speciale
		if (INST.BOOL04==1 && INST.CCCAPR1==1 && INST.UTBL04 == 1100)
		{
		docID();
		X.RUNSQL('update inst set utbl04 = 1200 where inst='+vID,null);
		}

		// Aprobare conditii speciale
		if (INST.BOOL04==1 && INST.CCCAPR==1 && INST.UTBL04 == 1200)
		{
		docID();
		X.RUNSQL('update inst set utbl04 = 1300 where inst='+vID,null);
		}

		// Tiparire automata
		if (INST.CCCPRINT==0&&INST.UTBL04!=4000)
		{
		if (INST.UTBL04!=1100&&INST.UTBL04!=1200&&INST.UTBL04!=1300)
		conditiiPrint();
		}

    itsMe = true;
}

function ON_INSERT()
{
		dsRO(INST,0);
		dsRO(INSTLINES,0);
		dsRO(INSTLINESS,0);
		INST.UTBL01=30;

		set_field_editor();


		INST.SETREADONLY('CCCVALPOINTS',1);
}

function ON_LOCATE()
{
		set_field_color();

		set_field_editor();

		statusRO(); // Read only campuri in functie de status contract

		INST.SETREADONLY('CCCVALPOINTS',1);
}

function ON_CANCEL()
{
	// Interdictie: obligatoriu se salveaza act aditional generat
	docID();

	if (vID==0)
	{
	// Validare suplimentara - acte aditionale dublate
	DsValidare = X.GETSQLDATASET('select inst from inst where isnull(cccinsts,0)>0 and cccinsts='+INST.CCCINSTS,null);
	if (DsValidare.RECORDCOUNT==0)
	{
	if (INST.CCCINSTS>0&&vID==0)
	X.EXCEPTION('Salvati documentul!');
	}
	}

  xx();

	if (itsMe) {
		//comm1(0);
		//debugger;
		sendJson(true, 123, urlDummy);
		itsMe = false;
	}
}

function ON_DELETE()
{
	docID();
	DsValidare = X.GETSQLDATASET('select inst from inst where cccinsts='+vID,null);
	if (DsValidare.RECORDCOUNT>0)
	X.EXCEPTION('Stergere nepermisa, exista act aditional generat!');
}

function EXECCOMMAND(cmd)
{
  if (cmd == '20200313') {
    a(false, 2);
    b();
    c(false);
  }

	if (cmd == '20190528')
	{
	// Tiparire automata
		docID();
		if (vID>0)
		{
		if (INST.CCCPRINT==1)
		{
		var ans;
		ans = X.ASK('Tiparire','Documentul a fost deja tiparit. Retipariti?');

		if (ans==6)
		{
			if (INST.CCCPRINTFORM>0&&INST.UTBL04!=4000)
		printMe(INST.CCCPRINTFORM,0);
		else
		conditiiPrint();
		}
		}
		else
		conditiiPrint();
		}
	}

	if (cmd == '20190321')
	{
	if (INST.UTBL04==3000||INST.UTBL04==4000||INST.UTBL04==4100)
	X.EXCEPTION('Actiune nepermisa, verificati status contract!');

	aplicare_card_fidelitate();

	ceCodScan = X.INPUTQUERY('Scanare','Scanare Card ','',1);
	ceCodScan = String.fromCharCode(39)+ceCodScan+String.fromCharCode(39);
	DsCard = X.GETSQLDATASET('select bonuscard from bonuscard where code='+ceCodScan,null);
	if (DsCard.RECORDCOUNT == 1)
	{
			if (INST.CCCBONUSCARD == DsCard.bonuscard)
			{
			INST.CCCCARDUSE = 1;
			//INST.CCCNEGCARDPOINTS = INST.CCCBONUSPOINTS;
			}
			else
			{
			X.WARNING('Cardul nu este identificat!');
			INST.CCCBONUSCARD = null;
			INST.CCCBONUSPOINTS = 0;

			INST.SETREADONLY('CCCVALPOINTS',0);
			INST.CCCVALPOINTS = 0;
			INST.SETREADONLY('CCCVALPOINTS',1);

			INST.CCCNEGCARDPOINTS = 0;
			INST.CCCCARDUSE = 0;
			}
	}
	else
	{
	X.WARNING('Cardul nu este identificat!');
	INST.CCCBONUSCARD = null;
	INST.CCCBONUSPOINTS = 0;

	INST.SETREADONLY('CCCVALPOINTS',0);
	INST.CCCVALPOINTS = 0;
	INST.SETREADONLY('CCCVALPOINTS',1);

	INST.CCCNEGCARDPOINTS = 0;
	INST.CCCCARDUSE = 0;
	}
	}

	// Utilizare puncte card fidelitate
	if (cmd == '20190314')
		{
		INST.NEXT;
		validare_use_points();
		}


	// Aplicare voucher
	if (cmd == '201903211')
	{
	if (INST.UTBL04==3000||INST.UTBL04==4000||INST.UTBL04==4100)
	X.EXCEPTION('Actiune nepermisa, verificati status contract!');


	ceCodScan = X.INPUTQUERY('Scanare','Scanare Voucher ','',1);
	ceCodScan = String.fromCharCode(39)+ceCodScan+String.fromCharCode(39);
	DsVoucher = X.GETSQLDATASET('select voucher from voucher where code='+ceCodScan,null);

	if (DsVoucher.RECORDCOUNT == 1)
	INST.CCCVOUCHER = DsVoucher.voucher;
	else
	{
	X.WARNING('Voucherul nu a fost identificat!');
	INST.CCCVOUCHER = null;
	}
	}

	/*
  if (cmd == 20190208)
	{


	X = CallPublished('SysRequest.XSendWebSMS',VarArray('40728300307','test buton',2));

	}*/
	if (cmd==20190225)
	{
	if (INST.UTBL04==3000||INST.UTBL04==4000||INST.UTBL04==4100)
	X.EXCEPTION('Actiune nepermisa, verificati status contract!');

	//aplicare_discount_promotii()
	if (INST.INST>0)
	validare_aplicare_com();
	else
	X.WARNING('Promotia se aplica la acordarea imprumutului!');
	}

	// Deschidere fereastra incasare contract
	if (cmd == 20181025)
	{

	//Validare acordare imprumut inainte de incasare
		if (INST.CCCCNTRTYPE==1) // Doar pt. contracte;
		{
		docID();
		if (INST.CCCINSTS > 0)
		DsImprumut = X.GETSQLDATASET('select findoc from findoc where sosource=1351 and fprms=9000 and inst='+INST.CCCINST,null);
		else
		DsImprumut = X.GETSQLDATASET('select findoc from findoc where sosource=1351 and fprms=9000 and inst='+vID,null);

		if (DsImprumut.RECORDCOUNT==0)
		X.EXCEPTION('Imprumutul nu a fost acordat!');
		}


	if (INST.UTBL04==3000||INST.UTBL04==4000||INST.UTBL04==4100)
	{
	if (INST.UTBL04==3000)
	X.EXCEPTION('Operati ultimul act aditional activ!');
	else
	DsStatus = X.GETSQLDATASET('select name from utbl04 where sodtype=41 and company='+X.SYS.COMPANY+' and utbl04='+INST.UTBL04,null);
	X.EXCEPTION('Nu puteti efectua incasari! Contractul are statusul: '+DsStatus.name+'');
	}
	else
	X.OPENSUBFORM('SFVPAYTYPE');
	}

	/*
	if (cmd == 20181027)
	{
		lichidare_contract();
	}*/

	// Plata valoare imprumut
	if (cmd == 20181028)
	{
		INSTLINES.FIRST;  // Artificiu pt. postare ultima linie la plata imprumut
		X.EXEC('button:Save');
		//plata_imprumut();
	}

	// Simulare calcul valoare imprumut + comision pt. perioada contract
	if (cmd == 20181106)
	{
	INST.NEXT;
	cePrcR = 0;
	cePrcM = 0;

	if (INST.BOOL02==1)
	{
	dataCntr = X.FORMATDATE('yyyymmdd',INST.FROMDATE);
	dataCntr = String.fromCharCode(39)+dataCntr+String.fromCharCode(39);

	if (INST.CCCACOMM>0)
	DsPrc = X.GETSQLDATASET('select top 1 COMMAVRPRC, COMMAVMPRC from CCCACOMM where cccacomm='+INST.CCCACOMM,null);
	else
	DsPrc = X.GETSQLDATASET('select top 1 COMMAVRPRC, COMMAVMPRC from CCCACOMM where branch='+INST.BRANCH+' and convert(varchar(10),fromdate,112)<='+dataCntr+' order by fromdate desc',null);

	cePrcR = DsPrc.commavrprc;
	cePrcM = DsPrc.commavmprc;
	}


	INST.NUM03 = null;
	INST.NUM04 = null;
	INST.NUM05 = null;
	simulare_imprumut();

	if (INST.UTBL01>0)
	simulare_comision();
	else
	X.EXCEPTION('Completati durata contract!');
	}

	// Modificare suma de achitat
	if (cmd == 20190121)
	{
  distribuire_incasare();
	}
}

function ON_SFVGDPR_SHOW()
{
	CCCVGDPR.CONSENT = 1;
	CCCVGDPR.DATECONSENT = X.SYS.LOGINDATE;
}

function ON_SFVGDPR_ACCEPT()
{
	ceNo = String.fromCharCode(39)+CCCVGDPR.NOCONSENT+String.fromCharCode(39);
	X.RUNSQL('update trdr set consent='+CCCVGDPR.CONSENT+', noconsent='+ceNo+' where trdr='+INST.TRDR,null);

	ceData = X.FORMATDATE('yyyymmdd',CCCVGDPR.DATECONSENT);
	ceData = String.fromCharCode(39)+ceData+String.fromCharCode(39);
	X.RUNSQL('update trdextra set date01='+ceData+'where trdr='+INST.TRDR,null);
}


function ON_SFVPAYTYPE_SHOW()
{
	vdel=1;
		cePayType = 0;

		CCCVPAY.FIRST;
		while (!CCCVPAY.Eof)
		{
		CCCVPAY.DELETE;
		}
	vdel=0;

   for (i=2; i<=3; i++)
	 {
	 CCCVPAY.APPEND;
	 CCCVPAY.PAYTYPE = i;
	 }

	 // Plata OP
	 docID();
	 DsOP = X.GETSQLDATASET('select sum(llineval) as opval from trdtlines where inst='+vID+' and sosource=1413', null);
	 if (DsOP.opval > 0)
	 INST.UTBL05 = 200;
}

function ON_SFVPAYTYPE_ACCEPT()
{
	a(true, CCCVPAY.PAYTYPE);
}

function a(showNext, tipActiune) {
  INST.CCCPAYTYPE = tipActiune;
	gridRO(INSTLINES,0);

	//cePayType = 0;
	cePayType = CCCVPAY.PAYTYPE;


		// Beneficii la plata comision in avans (majorare imprumut; reducere comision)
		if (INST.CCCPAYTYPE == 1)
		{
		aplicare_promo_avans();
		}

		// Interdictie lichidare din alta agentie
		if (INST.CCCPAYTYPE == 3)
		{
		if (INST.BRANCH!=X.SYS.BRANCH)
		X.EXCEPTION('Lichidare nepermisa din alta agentie!');
		}


		if (INST.CCCPAYTYPE == 2)
		{
		if (INST.UTBL01==1)  // Contracte cu durata redusa
		X.EXCEPTION('Contractul nu poate fi prelungit - durata redusa!');
		}

		// Modificare data achitare doar pt. prelungire/lichidare
		if (INST.CCCPAYTYPE > 1)
		{
		// Nou
		if (INST.CCCPAYTYPE== 2)
		{
			DsMode = X.GETSQLDATASET('select isnull(prelmode,0) as prelmode from cccacomm where cccacomm='+INST.CCCACOMM,null);
			if (DsMode.prelmode==0) // La zi
			{
			if (X.SYS.LOGINDATE<INST.WDATEFROM)
			INST.BLCKDATE=INST.WDATEFROM;
			else
			INST.BLCKDATE = X.SYS.LOGINDATE;
			}
			if (DsMode.prelmode==1) // La scadenta
			{
			if (INST.WDATETO < X.SYS.LOGINDATE)
			INST.BLCKDATE = X.SYS.LOGINDATE;
			else
			INST.BLCKDATE = INST.WDATETO;
			}
		}
		if (INST.CCCPAYTYPE== 3)
		{
		if (INST.WDATEFROM > X.SYS.LOGINDATE)
			{
			ceDataL = X.FORMATDATE('yymmdd',INST.WDATEFROM);
			DsDataL = X.GETSQLDATASET("select dateadd(d,-1,'"+ceDataL+"') as data",null);
			INST.BLCKDATE = DsDataL.data;
			}
		else
		INST.BLCKDATE = X.SYS.LOGINDATE;
		}

		validare_aplicare_com();
		}


		if (INST.CCCPAYTYPE == 2)
		{
		DsOP = X.GETSQLDATASET('select sum(llineval) as opval from trdtlines where inst='+vID+' and sosource=1413', null);
		if (DsOP.opval > INST.CCCSUMAMNT || DsOP.opval == INST.CCCSUMAMNT)
		X.EXCEPTION('Suma depaseste valoarea de incasat! Incercati: Lichidare');

		}



		// Adaos/discount comision valoare lichidare OP
		if (INST.CCCPAYTYPE == 3)
		{
		//	aplicare_comision_adaos();
		aplicare_comision_lichidare();
		}

		//cePayType = CCCVPAY.PAYTYPE;


	gridRO(INSTLINES,1);

	if (showNext)
    X.OPENSUBFORM('SFCCCVPAY');
}

function ON_SFVPAYTYPE_CANCEL()
{
	// Repunere data finala si recalculare comision intreg
	INST.BLCKDATE = INST.WDATETO;

	if (cePayType == 1)
	anulare_promo_avans();
}

function ON_CCCVPAY_SELECT()
{
	if (CCCVPAY.SODTYPE==52&&CCCVPAY.SELECT==1)
	CCCVPAY.SELECT=null;

	if (CCCVPAY.SODTYPE==51&&CCCVPAY.SELECT==1)
	{
	if (INST.BRANCH!=X.SYS.BRANCH)
	{
	CCCVPAY.SELECT=null;
	X.EXCEPTION('Lichidare nepermisa din alta agentie!');
	}
	}
}

function ON_CCCVPAY_BEFOREDELETE()
{
	if (vdel==0)
	X.EXCEPTION('Stergere nepermisa!');
}


function ON_SFCCCVPAY_SHOW()
{
	b();
}

function b() {
  vdel=1;
	CCCVPAY.FIRST;
	while (!CCCVPAY.Eof)
	{
		CCCVPAY.DELETE;
	}
	vdel=0;

	CCCVPAYSUM.SETREADONLY('PAYAMNT',0);

	ceAchit = 0; // Validare suma incasare > 0
	ceSum = 0;   // Suma totala incasare
	ceSumI = 0;  // Suma imprumut de incasat
	ceSumC = 0;  // Suma comision de incasat
	ceSumCI = 0; // Suma comision intarziere
	ceSumCA = 0; // Suma comision administare
	cateZile = 0; // Zile incasare comision

	INSTLINES.FIRST;
	while(!INSTLINES.Eof)
	{

		CCCVPAY.APPEND;
		CCCVPAY.SODTYPE = 51;
		CCCVPAY.INSTLINES = INSTLINES.INSTLINES;
		CCCVPAY.MTRL = INSTLINES.MTRL;
		CCCVPAY.CCCQTY = INSTLINES.CCCQTY;
		CCCVPAY.CCCPRICE = INSTLINES.CCCPRICE;
		CCCVPAY.VALUE = INSTLINES.PRICE;
		CCCVPAY.PAID = INSTLINES.CCCPAID;
		CCCVPAY.TOPAY = INSTLINES.PRICE - INSTLINES.CCCPAID;
		if (cePayType==1|| cePayType==2)
		CCCVPAY.PRICE = 0;
		if (cePayType==3)
		CCCVPAY.PRICE = INSTLINES.PRICE - INSTLINES.CCCPAID;
		if (CCCVPAY.PRICE != 0)
		ceAchit = ceAchit + 1;

		ceSumI = ceSumI + CCCVPAY.TOPAY;
		ceSum = ceSum + CCCVPAY.TOPAY;

		CCCVPAY.POST;

		INSTLINES.NEXT;
	}

	INSTLINESS.FIRST;
	while(!INSTLINESS.Eof)
						{
						CCCVPAY.APPEND;
						CCCVPAY.SODTYPE = 52;
						CCCVPAY.INSTLINES = INSTLINESS.INSTLINES;
						CCCVPAY.INSTLINESS = INSTLINESS.INSTLINESS;
						CCCVPAY.MTRL = INSTLINESS.MTRL;
						CCCVPAY.CCCQTY = INSTLINESS.CCCQTY;
						CCCVPAY.CCCPRICE = INSTLINESS.CCCPRICE;
						CCCVPAY.VALUE = INSTLINESS.PRICE;
						CCCVPAY.PAID = INSTLINESS.CCCPAID;
						CCCVPAY.TOPAY = INSTLINESS.PRICE - INSTLINESS.CCCPAID;
						CCCVPAY.PRICE = INSTLINESS.PRICE - INSTLINESS.CCCPAID;
						if (CCCVPAY.PRICE != 0)
						ceAchit = ceAchit + 1;

						DsCateg = X.GETSQLDATASET('select mtrcategory from mtrl where mtrl='+INSTLINESS.MTRL,null);
						//DsCod = X.GETSQLDATASET('select code from mtrl where mtrl='+INSTLINESS.MTRL,null);
						//if (DsCod.code == 'COM')
						if (DsCateg.mtrcategory==106||DsCateg.mtrcategory==101||DsCateg.mtrcategory==109)
						{
						ceSumC = ceSumC + CCCVPAY.TOPAY;
						if (DsCateg.mtrcategory==106)
						cateZile = INSTLINESS.CCCQTY;
						}
						//if (DsCod.code == 'CMI')
						if (DsCateg.mtrcategory==107)
						{
						ceSumCI = ceSumCI + CCCVPAY.TOPAY;
						}

						if (DsCateg.mtrcategory==108)
						{
						ceSumCA = ceSumCA + CCCVPAY.TOPAY;
						}

						ceSum = ceSum + CCCVPAY.TOPAY;

						CCCVPAY.POST;
						INSTLINESS.NEXT;

						}


	ceSum = Math.round(ceSum*100)/100;   		// Suma totala incasare
	ceSumI = Math.round(ceSumI*100)/100;  	// Suma imprumut de incasat
	ceSumC = Math.round(ceSumC*100)/100;  	// Suma comision de incasat
	ceSumCI = Math.round(ceSumCI*100)/100; 	// Suma comision intarziere
	ceSumCA = Math.round(ceSumCA*100)/100;  // Suma comision administrare


	CCCVPAYSUM.ITEAMNT = ceSumI;
	CCCVPAYSUM.SRVAMNT = ceSumC + ceSumCI + ceSumCA;

	if (INST.CCCPAYTYPE == 2 || INST.CCCPAYTYPE == 1)
	CCCVPAYSUM.PAYAMNT = ceSumC + ceSumCI + ceSumCA;
	if (INST.CCCPAYTYPE == 3)
	{
	CCCVPAYSUM.PAYAMNT = ceSum;
	CCCVPAYSUM.SETREADONLY('PAYAMNT',1);
	}

	if (INST.UTBL05==200) // Plata OP
	{
	CCCVPAYSUM.SETREADONLY('PAYAMNT',0);
	DsOP = X.GETSQLDATASET('select sum(llineval) as opval from trdtlines where inst='+vID+' and sosource=1413', null);
	CCCVPAYSUM.PAYAMNT = DsOP.opval;
	//if (INST.CCCPAYTYPE == 2)
	distribuire_incasare();

	CCCVPAYSUM.SETREADONLY('PAYAMNT',1);
	}

	CCCVPAYSUM.SUMAMNT = ceSum;
	CCCVPAYSUM.DAYS = cateZile;
}

function ON_SFCCCVPAY_ACCEPT()
{
		c(true);
}

function  c(showNext) {
  dsRO(INSTLINES,0);

  if (ceAchit == 0)
  {}//X.EXCEPTION('Nu exista nimic de achitat. Anulati actiunea!');

  //else
  //{
  CCCVPAY.FIRST;
  while(!CCCVPAY.Eof)
  {
    if (CCCVPAY.SODTYPE == 51)
      {
      INSTLINES.LOCATE('INSTLINES',CCCVPAY.INSTLINES);
          INSTLINES.CCCPAY = CCCVPAY.PRICE;
          // Reproducere in doc retail - la salvare
          //INSTLINES.CCCPAID = CCCVPAY.PRICE + INSTLINES.CCCPAID;
      }

      if (CCCVPAY.SODTYPE == 52)
      {
      //INSTLINESS.LOCATE('INSTLINES;INSTLINESS',CCCVPAY.INSTLINES,CCCVPAY.INSTLINESS);
      INSTLINESS.LOCATE('INSTLINES',CCCVPAY.INSTLINES);
      //INSTLINESS.LOCATE('MTRL',CCCVPAY.MTRL);
      INSTLINESS.CCCPAY = CCCVPAY.PRICE;
      //INSTLINESS.CCCQTY = CCCVPAY.CCCQTY;

      DsCod = X.GETSQLDATASET('select code from mtrl where mtrl='+INSTLINESS.MTRL,null);

      if (DsCod.code == 'COM' || DsCod.code == 'CMA')
      {
      INSTLINESS.CCCQTY = CCCVPAY.CCCQTY;
      ceData1 = X.FORMATDATE('yymmdd',INSTLINESS.FROMDATE);
      ceData2 = X.FORMATDATE('yymmdd',INSTLINESS.FINALDATE);

      //DsData = X.GETSQLDATASET("select dateadd(d,"+CCCVPAY.CCCQTY+"-1,'"+ceData1+"') as data",null);
      DsData = X.GETSQLDATASET("select dateadd(d,"+CCCVPAYSUM.DAYS+"-1,'"+ceData1+"') as data",null);
      INSTLINESS.FINALDATE = DsData.data;
      //INSTLINESS.CCCQTY = CCCVPAY.CCCQTY;
      }

          // Reproducere in doc retail - la salvare
          //INSTLINESS.CCCPAID = CCCVPAY.PRICE + INSTLINESS.CCCPAID;

      }

      CCCVPAY.NEXT;
  }


  if (INST.CCCPAYTYPE == 3) // Lichidare
  {
  if (CCCVPAYSUM.PAYAMNT<CCCVPAYSUM.SUMAMNT)
  X.EXCEPTION('Suma nu acopera valoarea de lichidare!');
  }

  X.EXEC('button:Save');



  if (INST.UTBL05==100)
  {
  DsSeries = X.GETSQLDATASET('select top 1 cccseriesch from cccacomm where branch='+X.SYS.BRANCH+' order by fromdate desc',null);
  ceSerie = DsSeries.cccser5iesch;
  X.EXEC('XCMD:RETAILDOC[AUTOEXEC=2,FORM=S1 - Amanet,FORCEVALUES=SERIES:'+ceSerie+'?TRDR:'+INST.TRDR+'?SALESMAN:'+INST.SALESMAN+'?BOOL01:1?INST:'+INST.INST+'?COMMENTS:]');
  }

  if (INST.UTBL05==200)
  {
  DsSeries = X.GETSQLDATASET('select top 1 cccseriesdi from cccacomm where branch='+X.SYS.BRANCH+' order by fromdate desc',null);
  ceSerie = DsSeries.cccseriesdi;
  X.EXEC('XCMD:RETAILDOC[AUTOEXEC=2,FORM=S1 - Amanet,FORCEVALUES=SERIES:'+ceSerie+'?TRDR:'+INST.TRDR+'?SALESMAN:'+INST.SALESMAN+'?BOOL01:1?INST:'+INST.INST+'?COMMENTS:]');
  }

  //}

  docID();

  if (INST.CCCPAYTYPE == 1)  // Avans
  {
  DsCond = X.GETSQLDATASET('select sum(isnull(price,0)-isnull(cccpaid,0)) as dif from instlines where sodtype=52 and inst='+vID,null);
  ceAvans = DsCond.dif;

  if (ceAvans == 0)
  INST.UTBL04 = 2000;
  else
  {
  // Repunere data finala contract
  INST.BLCKDATE = INST.WDATETO;
  anulare_promo_avans();
  X.EXCEPTION('Avansul nu a fost incasat!');
  }
  }

  if (INST.CCCPAYTYPE == 2) // Prelungire
  {
  lichidare_contract_partial();

  prelungire_contract(showNext);
  docID();
  DsPrel = X.GETSQLDATASET('select inst from inst where cccinsts='+vID,null);
  if (DsPrel.RECORDCOUNT > 0)
  INST.UTBL04 = 3000;
  }

  if (INST.CCCPAYTYPE == 3) // Lichidare
  {
  lichidare_contract();
  INST.UTBL04 = 4000;
  }

  gridRO(INSTLINES,1);
  X.EXEC('button:Save');
}

function ON_SFCCCVPAY_CANCEL()
{
	// Repunere data finala si recalculare comision intreg
	INST.BLCKDATE = INST.WDATETO;

	if (cePayType == 1)
	anulare_promo_avans();
}

function ON_SFPROMO_SHOW()
{
		CCCVPROMO.FIRST;
		while(!CCCVPROMO.Eof)
		{
		CCCVPROMO.DELETE;
		}

		DsPrjc.FIRST;

		while(!DsPrjc.Eof)
		{
		CCCVPROMO.APPEND;
		CCCVPROMO.PRJC = DsPrjc.prjc;
		CCCVPROMO.VOUTYPE = DsPrjc.cccvoutype;
		CCCVPROMO.DISCOUNT = DsPrjc.cccdisc;
		CCCVPROMO.VALUE = DsPrjc.value;
		CCCVPROMO.POST;
		DsPrjc.NEXT;
		}
		CCCVPROMO.FIRST;
}

function ON_SFPROMO_ACCEPT()
{
	 promo_accept();
}

function ON_SFPROMO_CANCEL()
{
	 promo_accept();
}

function promo_accept()
{
ceVal = CCCVPROMO.VALUE;

	 //if (ceValCntr < ceVal)
	 //ceVal = ceValCntr;
	 if (INST.CCCSRVSUM < ceVal)
	 ceVal = INST.CCCSRVSUM;

	 if (ceVal>0)
   {
	 DsSrv = X.GETSQLDATASET('select top 1 prosrv from cccacomm where branch=1000 order by fromdate desc',null);

	 INSTLINESS.APPEND;
	 INSTLINESS.MTRL = DsSrv.prosrv;
	 INSTLINESS.FROMDATE = INST.WDATEFROM;
	 if (INST.BLCKDATE>0)
	 INSTLINESS.FINALDATE = INST.BLCKDATE;
	 else
	 INSTLINESS.FINALDATE = INST.WDATETO;
	 //INSTLINESS.CCCPRICE = ceVal;
	 //INSTLINESS.QTY = -1;
	 //INSTLINESS.CCCQTY = -1;
	 //INSTLINESS.PRICE = ceVal;
	 //INSTLINESS.POST;

	 INST.PRJC = CCCVPROMO.PRJC;
	 }
}

function ON_INST_TRDR_VALIDATE()
{
		// Validare categorie contabila client
		DsTrdr = X.GETSQLDATASET('select trdcategory from trdr where trdr='+INST.TRDR,null);
		if (DsTrdr.trdcategory!=5100&&DsTrdr.trdcategory!=5000&&DsTrdr.trdcategory!=5200)
		X.EXCEPTION('Categorie client necorespunzatoare!');

}

function ON_INST_TRDR()
{
		INST.CCCPRSN = null;

		if (INST.UTBL01>0 && INST.TRDR>0 && INST.INSTTYPE>0)
		formare_nume();

		// Aplicare automata PV Custodie la selectare client
		/*
		DsPV = X.GETSQLDATASET('select findoc from findoc where sosource=1351 and fprms=1000 and trdr='+INST.TRDR+
										' and findoc not in (select num01 from inst where trdr='+INST.TRDR+')',null);
		if (DsPV.RECORDCOUNT == 1)
		INST.NUM01 = DsPV.findoc;
		*/

		// Aplicare reprezentant  - doar pt. Contracte, nu si acte aditionale (se preia din contract) / modificat: pt. oricare
		//if (INST.CCCCNTRTYPE==1)
		//{
		DsPrsn = X.GETSQLDATASET('select distinct p.prsn from prsn p join prsext px on px.prsn=p.prsn where p.sodtype=20 and px.sodtype in (30,31,32) and p.company='+X.SYS.COMPANY+' and p.users='+X.SYS.USER,null);
		if (DsPrsn.RECORDCOUNT>0)
		INST.SALESMAN = DsPrsn.prsn;
		else
		X.EXCEPTION('Angajat definit necorespunzator!');
		//}

		// GDPR
		//X.OPENSUBFORM('SFVGDPR');

		//aplicare_card_fidelitate();
}

function ON_INST_NUM01() //PV Custodie
{
	// Aplicare automata in linii instalari din PV Custodie, la selectare PV Custodie
	DsPV = X.GETSQLDATASET('select mtrl, qty1 from mtrlines where findoc='+INST.NUM01,null);
	DsPV.FIRST;
	while (!DsPV.Eof)
	{
		INSTLINES.APPEND;
		INSTLINES.MTRL = DsPV.mtrl;
		INSTLINES.QTY = DsPV.qty1;
		INSTLINES.POST;

		DsPV.NEXT;
	}
}

function ON_INST_INSTTYPE_VALIDATE()
{

}

function ON_INST_INSTTYPE()
{
		// Validare modificare tip contract
		if (INSTLINES.MTRL>0)
		{
		DsMtrl = X.GETSQLDATASET('select mtrcategory from mtrl where mtrl='+INSTLINES.MTRL,null);
		ceCateg = DsMtrl.mtrcategory;
		if (DsMtrl.mtrcategory!=INST.INSTTYPE)
		{
		//INST.INSTTYPE = DsMtrl.mtrcategory;
	  X.EXCEPTION('Modificare nepermisa, exista articole selectate!');
		}
		}
		else
		INST.CCCMTRGROUP=null;

		if (INST.UTBL01>0 && INST.TRDR>0 && INST.INSTTYPE>0)
		formare_nume();
}

function ON_INST_CCCCNTRTYPE()
{
		if (INST.CCCINSTS>0)
		{}
		else 											// doar acte noi din import AmanetOnline
		{
		if (INST.CCCCNTRTYPE==2)
		{
		INST.CCCCNTRTYPE=1;
		}
		}
}

function ON_INST_UTBL01() //Durata contract
{
		// Nu SMS - doar contracte durata redusa zi
		DsTipDurata = X.GETSQLDATASET('select type from cccdurata where durata='+INST.UTBL01,null);
		if (DsTipDurata.type==1)
		INST.BOOL03=0;
		else
		INST.BOOL03=null;

		if (INST.UTBL01>0 && INST.TRDR>0 && INST.INSTTYPE>0)
		formare_nume();
	/*
	dataCntr1 = X.FORMATDATE('yymmdd',INST.WDATEFROM);
	dataCntr2 = X.FORMATDATE('yymmdd',INST.WDATETO);
	dataGr1 = X.FORMATDATE('yymmdd',INST.GDATEFROM);
	dataGr2 = X.FORMATDATE('yymmdd',INST.GDATETO);
	dataComm1 = X.FORMATDATE('yymmdd',INSTLINESS.FROMDATE);
	dataComm2 = X.FORMATDATE('yymmdd',INSTLINESS.FINALDATE);*/

	// Aplicare data inceput contract - doar pt. Contracte, nu si acte aditionale
	/// eliminat 27.11.2019; afecteaza data prelungire contract (suprascrie data rezultata din functia date_prelungire)
	/*if (INST.CCCCNTRTYPE==1) // chiar daca e act, il vede tot 1..., camp completat dupa momentul corect
	{
	INST.WDATEFROM = X.SYS.LOGINDATE;
	}*/

	// Aplicare data finala contract
	dataCntr1 = X.FORMATDATE('yymmdd',INST.WDATEFROM);
	//DsDurata = X.GETSQLDATASET('select num01-1 as num01 from utbl01 where sodtype=41 and utbl01='+INST.UTBL01+' and company='+X.SYS.COMPANY,null);
	ceDurata = INST.UTBL01 - 1;
	//DsData = X.GETSQLDATASET("select dateadd(d,"+DsDurata.num01+",'"+dataCntr1+"') as data",null);
	DsData = X.GETSQLDATASET("select dateadd(d,"+ceDurata+",'"+dataCntr1+"') as data",null);
	dataCntr2 = DsData.data;
	INST.WDATETO = dataCntr2;

	// Aplicare data inceput perioada gratie
	dataCntr2 = X.FORMATDATE('yymmdd',INST.WDATETO);
	DsDurata = X.GETSQLDATASET('select isnull(gdays,0) as gdays from cccdurata where durata='+INST.UTBL01,null);
	if (DsDurata.gdays == 0)
	cateZile = 0;
	if (DsDurata.gdays > 0)
	cateZile = 1;
	DsData = X.GETSQLDATASET("select dateadd(d,"+cateZile+",'"+dataCntr2+"') as data",null);
	dataGr1 = DsData.data;
	INST.GDATEFROM = dataGr1;

	// Aplicare data finala perioada gratie
	//DsDurata = X.GETSQLDATASET('select gdays from cccacomm where branch='+X.SYS.BRANCH,null);
	DsDurata = X.GETSQLDATASET('select isnull(gdays,0) as gdays from cccdurata where durata='+INST.UTBL01,null);
	if (DsDurata.gdays == 0)
	cateZile = 0;
	if (DsDurata.gdays > 0)
	cateZile = DsDurata.gdays -1;
	dataGr1 = X.FORMATDATE('yymmdd',INST.GDATEFROM);
	DsData = X.GETSQLDATASET("select dateadd(d,"+cateZile+",'"+dataGr1+"') as data",null);
	INST.GDATETO = DsData.data;

	// Aplicare data achitare contract
	INST.BLCKDATE = INST.WDATETO;

	//Recalculare pret imprumut
	INSTLINES.FIRST;
	while(!INSTLINES.Eof)
	{
	DsMtrl = X.GETSQLDATASET('select mtrcategory, mtrgroup from mtrl where mtrl='+INSTLINES.MTRL,null);
	if (DsMtrl.mtrgroup==1000||DsMtrl.mtrgroup==1100) // Bijuterii Aur / Bijuterii cu diamante
	{
	calcul_pret_aur();
	}
	INSTLINES.NEXT;
	}

	// Recalculare comision
	/*INSTLINESS.FIRST;
	while(!INSTLINESS.Eof)
	{
		INSTLINESS.FROMDATE = INST.WDATEFROM;
		INSTLINESS.FINALDATE = INST.WDATETO;
		INSTLINESS.NEXT;
	}*/

	// Recalculare comision
	// Nou! Inclusiv cel de adaos
	if (INSTLINES.MTRL>0)
	validare_aplicare_com();
}

function ON_INST_UTBL04()   // Status contract
{
		statusRO(); // Read only campuri in functie de status contract

		if (INST.UTBL04>0) // Status contract
		{
		DsActiv = X.GETSQLDATASET('select num01 from utbl04 where sodtype=41 and utbl04='+INST.UTBL04+' and company='+X.SYS.COMPANY,null);
		if (DsActiv.num01 == 0)
		{
		INST.ISACTIVE = 0;
		}
		}
}

function ON_INST_CCCMTRGROUP_VALIDATE()
{
	//if (INSTLINES.MTRL>0)
	//X.EXCEPTION('Modificare nepermisa, exista articole completate!');
}

function ON_INST_CCCMTRGROUP()
{
	if (INST.CCCMTRGROUP>0)
	{
	DsDep = X.GETSQLDATASET('select cccdepart from mtrgroup where mtrgroup='+INST.CCCMTRGROUP+' and sodtype=51 and company='+X.SYS.COMPANY,null);
	if (DsDep.cccdepart>0)
	INST.CCCDEPART = DsDep.cccdepart;
	else
	X.EXCEPTION('Departament necorespunzator!');
	}
}

function ON_INST_BLCKDATE()
{
  /*if (INST.BLCKDATE<INST.WDATEFROM)
	{
	INST.BLCKDATE=INST.WDATEFROM;
	//X.EXCEPTION('Modificare nepermisa, data incasare necorespunzatoare!');
	}*/
}

function ON_INST_CCCINSTS()
{
		headerRO(0);

		gridRO(INSTLINES,0);
		//set_field_editor();
		X.SETFIELDEDITOR('INSTLINES.MTRL','MTRL(F[SODTYPE;MTRACN:INSTLINES.SODTYPE;110],U[BUSUNITS=BUSUNITS],H[#INSTLINES.X_SODTYPE;MTRL])');
		//MTRL(F[SODTYPE;MTRACN;MTRGROUP=:INSTLINES.SODTYPE;110;:INST.CCCMTRGROUP],U[BUSUNITS=BUSUNITS],H[#INSTLINES.X_SODTYPE;MTRL])
		date_prelungire();

		//headerRO(1);
		//gridRO(INSTLINES,1);
}

function ON_INST_CCCSUMAMNT()
{
	//calcul_total();
}

function ON_INST_BOOL03()
{
	// Comision Administrare - Alerte SMS Expirare Contract
	if (INSTLINES.MTRL>0)
	validare_aplicare_com();
}

function ON_INST_BOOL04()
{
	// Aplicare status - conditii speciale (comision redus / imprumut mai mare)
		if (INST.BOOL04==1) // bifare
		INST.UTBL04 = 1100;

		if (INST.BOOL04!=1) // debifare
		INST.UTBL04 = null;
}

function ON_INST_CCCAPR1()
{
	// Conditii speciale: operare Grup Call Center / Admin
	if (INST.CCCAPR1==1)
	{
	DsDepart = X.GETSQLDATASET('select depart from prsn where users='+X.SYS.USER+' and company='+X.SYS.COMPANY,null);
	if (DsDepart.depart==1700) // Trezorerie
	ceDepart = 1200; // Bijuterii
	else
	ceDepart = DsDepart.depart;

	if  (INST.UTBL04==1100 && (ceDepart==INST.CCCDEPART  || X.SYS.GROUPS == 1000 || X.SYS.GROUPS == 100 || INST.CCCCNTRTYPE==3))  // Grup  Admin / Call Center
			{
			DsPrsn = X.GETSQLDATASET('select distinct p.prsn from prsn p join prsext px on px.prsn=p.prsn where p.sodtype=20 and px.sodtype in (30,31,32) and p.company='+X.SYS.COMPANY+' and p.users='+X.SYS.USER,null);
			if (DsPrsn.RECORDCOUNT>0)
			{
			INST.CCCPRSN1 = DsPrsn.prsn;
			INST.UTBL04=1200;
			}
			else
			X.EXCEPTION('Angajat definit necorespunzator!');
			}
	if (INST.CCCPRSN1>0) {}
	else
	INST.CCCAPR1=0;
	}

	if (INST.CCCAPR1!=1)
	{
	INST.UTBL04=1100;
	}
}

function ON_INST_CCCAPR()
{
	// Conditii speciale: aprobare Grup Departament / Admin
	if (INST.CCCAPR==1)
	{
	DsDepart = X.GETSQLDATASET('select depart from prsn where users='+X.SYS.USER+' and company='+X.SYS.COMPANY,null);
	if (DsDepart.depart==1700) // Trezorerie
	ceDepart = 1200; // Bijuterii
	else
	ceDepart = DsDepart.depart;

	if  (INST.UTBL04==1200 && (ceDepart==INST.CCCDEPART || X.SYS.GROUPS == 100 || INST.CCCCNTRTYPE==3 || (INST.CCCDEPART==1200  && X.SYS.GROUPS == 1000)))  // Grup  Admin / Departament comercial aferent / Grup Call Center+Dep=Bijuterii
			{
			DsPrsn = X.GETSQLDATASET('select distinct p.prsn from prsn p join prsext px on px.prsn=p.prsn where p.sodtype=20 and px.sodtype in (30,31,32) and p.company='+X.SYS.COMPANY+' and p.users='+X.SYS.USER,null);
			if (DsPrsn.RECORDCOUNT>0)
			{
			INST.CCCPRSN2 = DsPrsn.prsn;

			if (INST.CCCCNTRTYPE==3) // Doar pt. contracte import
			INST.UTBL04=1300;
			}
			else
			X.EXCEPTION('Angajat definit necorespunzator!');
			}
	if (INST.CCCPRSN2>0) {}
	else
	INST.CCCAPR=0;
	}

	if (INST.CCCAPR1!=1)
	{
	INST.UTBL04=1200;
	}
}

function ON_INST_CCCCOMSPEC()
{
	DsDepart = X.GETSQLDATASET('select depart from prsn where users='+X.SYS.USER+' and company='+X.SYS.COMPANY,null);
				if (DsDepart.depart==1700) // Trezorerie
				ceDepart = 1200 // Bijuterii
				else
				ceDepart = DsDepart.depart;

		if ((INST.UTBL04==1100 || INST.UTBL04==1200 ) && (ceDepart == INST.CCCDEPART || X.SYS.GROUPS == 1000 || X.SYS.GROUPS == 100 ||INST.CCCCNTRTYPE==3))
		{
		if (INST.CCCCOMPEC!=0)
		validare_aplicare_com();
		}
}

function ON_INST_CCCBONUSCARD()
{
	calc_points();
	card_points();
	INST.CCCBONUSPOINTS = catePCard;

	DsUseRate = X.GETSQLDATASET('select points from cardcategory where cardcategory=100',null);
	ceRata = DsUseRate.points;
	ceVal = Math.round(catePCard * 100 * ceRata)/100;

	INST.SETREADONLY('CCCVALPOINTS',0);
	INST.CCCVALPOINTS = ceVal;
	INST.SETREADONLY('CCCVALPOINTS',1);
}

function ON_INST_CCCCARDUSE()
{
	/*if (INST.CCCCARDUSE==1)
	 cardRO(0);
	else
	 cardRO(1);*/

	 /*if (INST.CCCCARDUSE==1)
	 {
	 catePuncte = X.INPUTQUERY('Puncte','Utilizare puncte: ',INST.CCCBONUSPOINTS,0);
	 INST.CCCNEGCARDPOINTS = catePuncte;
	 }*/
}

function ON_INST_CCCNEGCARDPOINTS()
{
	if (INST.CCCBONUSCARD>0&&INST.CCCCARDUSE==1)
	{
	if (INST.CCCNEGCARDPOINTS>0)
	{
	calc_points();
	card_points();
	INST.CCCBONUSPOINTS = catePCard;
	if (INST.CCCNEGCARDPOINTS > catePCard)
	{
	X.WARNING('Clientul are '+catePCard+' puncte pe cardul de fidelitate!');
	INST.CCCNEGCARDPOINTS = catePCard;
	}
	}
	}
	//else
	//X.EXCEPTION('Cardul de fidelitate nu este identificat!');
}

function ON_INST_CCCVOUCHER()
{
	if (INST.CCCVOUCHER>0)
	aplicare_discount_voucher();
}

function ON_INSTLINES_MTRL()
{
	if (INSTLINES.MTRL>0)
	{
	INST.SETREADONLY('INSTTYPE',1);
	INST.SETREADONLY('CCCMTRGROUP',1);
	}

	DsMtrl = X.GETSQLDATASET('select mtrcategory, mtrgroup from mtrl where mtrl='+INSTLINES.MTRL,null);
	if (DsMtrl.mtrcategory==1000)
	{
	X.FOCUSFIELD('INSTLINES.CCCGWEIGHT');

	if ((DsMtrl.mtrgroup==1000||DsMtrl.mtrgroup==1100)&&INSTLINES.CCCWEIGHT>0)
	calcul_pret_aur();
	}
	else
	X.FOCUSFIELD('INSTLINES.CCCPRICE');
}

function ON_INSTLINES_CCCADDPRC()
{
	calcul_imprumut();
}

function ON_INSTLINES_QTY()
{
	if (INSTLINES.MTRL>0)
	{
	calcul_imprumut();
	//aplicare_comision();
	}
}

function ON_INSTLINES_CCCQTY()
{
	calcul_imprumut();
}

function ON_INSTLINES_CCCPRICE_VALIDATE()
{
	if (INSTLINES.MTRL>0)
	validare_aplicare_pret();
}

function ON_INSTLINES_CCCPRICE()
{
	calcul_imprumut();
}

function ON_INSTLINES_PRICE_VALIDATE()
{
		// Doar pt. Contracte, nu si acte aditionale
		if (INST.CCCCNTRTYPE==1)
		{
		if (INSTLINES.PRICE>INSTLINES.CCCEVAL)
		{
				DsDepart = X.GETSQLDATASET('select depart from prsn where users='+X.SYS.USER+' and company='+X.SYS.COMPANY,null);
				if (DsDepart.depart==1700) // Trezorerie
				ceDepart = 1200 // Bijuterii
				else
				ceDepart = DsDepart.depart;

			if (ceDepart==INST.CCCDEPART || X.SYS.GROUPS==1000 || X.SYS.GROUPS==100)
			{
			if (INSTLINES.CCCPRICE>0) {}
			else
			X.EXCEPTION('Modificare nepermisa, completati pret!');

			} // Admin si Call Center / Departamente comerciale aferente
			else
			X.EXCEPTION('Modificare nepermisa, depasire valoare evaluata!');
		}

		if (INSTLINES.MTRL>0)
		{
		//if (INSTLINES.PRICE==0 || INSTLINES.PRICE<0)
		//X.EXCEPTION('Valoare imprumut necorespunzatoare!');
		}
		}
}

function ON_INSTLINES_PRICE()
{

		if (INSTLINES.MTRL>0)
		{
		ceLineI = INSTLINES.INSTLINES;

		calcul_total();

		validare_aplicare_com();

		INSTLINES.LOCATE('INSTLINES',ceLineI);
		}
}

function ON_INSTLINES_CCCGWEIGHT()
{
// Doar pt. Contracte, nu si acte aditionale
	if (INST.CCCCNTRTYPE==1)
	{
	calcul_gr_evaluat();
	INSTLINES.CCCWEIGHT = ceGrNet;
	}
}

function ON_INSTLINES_CCCWEIGHT_VALIDATE()
{
		// Doar pt. Contracte, nu si acte aditionale
	if (INST.CCCCNTRTYPE==1)
	{
			DsDepart = X.GETSQLDATASET('select depart from prsn where users='+X.SYS.USER+' and company='+X.SYS.COMPANY,null);
				if (DsDepart.depart==1700) // Trezorerie
				ceDepart = 1200; // Bijuterii
				else
				ceDepart = DsDepart.depart;

			if (ceDepart == INST.CCCDEPART || X.SYS.GROUPS==1000 || X.SYS.GROUPS==100) // Admin si Call Center / Departamente comerciale aferente
			{
			if (INSTLINES.CCCWEIGHT>INSTLINES.CCCGWEIGHT)
			X.EXCEPTION('Modificare nepermisa, depasire greutate bruta!');
			}
			if (ceDepart!=INST.CCCDEPART && X.SYS.GROUPS!=1000 && X.SYS.GROUPS!=100)  // != Admin si Call Center / Departamente comerciale aferente
			{
					calcul_gr_evaluat();
					if (INSTLINES.CCCWEIGHT>ceGrNet)
					X.EXCEPTION('Modificare nepermisa, depasire greutate propusa!');
			}
	}
}

function ON_INSTLINES_CCCWEIGHT()
{
	// Doar pt. Contracte, nu si acte aditionale
	if (INST.CCCCNTRTYPE==1)
	{
	DsMtrl = X.GETSQLDATASET('select mtrcategory, mtrgroup from mtrl where mtrl='+INSTLINES.MTRL,null);
	if (DsMtrl.mtrcategory==1000)
	{
	if (DsMtrl.mtrgroup==1000||DsMtrl.mtrgroup==1100)  // Bijuterii Aur / Bijuterii cu diamante
	{
	calcul_pret_aur();
	}

	INSTLINES.CCCQTY = INSTLINES.CCCWEIGHT;
	}
	else
	{
	if (INSTLINES.CCCWEIGHT!=0)
	INSTLINES.CCCWEIGHT=0;
	}
	}
}

function ON_INSTLINES_CCCPAID()
{
	set_field_color();
}

function ON_INSTLINESS_QTY()
{
	calcul_comision();
}

function ON_INSTLINESS_CCCQTY()
{
	calcul_pret_comision();
}

function ON_INSTLINESS_CCCDISCPRC()
{
	calcul_pret_comision();
}

function ON_INSTLINESS_FINALDATE()
{
	calcul_comision();
}

function ON_INSTLINESS_PRICE()
{
	if (INSTLINESS.MTRL>0&&INSTLINESS.PRICE!=''&&INSTLINESS.PRICE!=0)
	{
	//ceLineI = INSTLINES.INSTLINES;
	ceLineC = INSTLINESS.INSTLINES;

	calcul_total();

	//INSTLINES.LOCATE('INSTLINES',ceLineI);
	INSTLINESS.LOCATE('INSTLINES',ceLineC);
	}
}

function ON_INSTLINESS_CCCPAID()
{
	set_field_color();
}

function ON_INSTLINESS_BEFOREDELETE()
{
	if (INSTLINESS.CCCPAID>0)
	X.EXCEPTION('Modificare nepermisa, exista tranzactii!');

	//DsSrv = X.GETSQLDATASET('select isnull(mtrgroup,0) as mtrgroup from mtrl where mtrl='+INSTLINESS.MTRL,null);
	//if (DsSrv.mtrgroup==600)
	if (vdel==0&&INSTLINESS.MTRL>0)
	X.EXCEPTION('Stergere nepermisa!');
}

function ON_INSTLINES_BEFOREDELETE()
{
	docID();
	if (INST.CCCINSTS > 0)
	DsImprumut = X.GETSQLDATASET('select findoc from findoc where sosource=1351 and fprms=9000 and inst='+INST.CCCINST,null);
	else
	DsImprumut = X.GETSQLDATASET('select findoc from findoc where sosource=1351 and fprms=9000 and inst='+vID,null);

	if (INSTLINES.CCCPAID>0||DsImprumut.RECORDCOUNT>0||INST.UTBL04>0)
	X.EXCEPTION('Modificare nepermisa, exista tranzactii!');

  /*
	// Rezolvare bug - la stergerea liniei din INSTLINES, nu se sterg liniile aferente din INSTLINESS

	-- nu merge in cazul in care se sterge linia afisata si nepostata inca
	if (INSTLINESS.MTRL>0)
	X.EXCEPTION('Stergere nepermisa!');  // interdictie stergere linie, avand linie afereta completata (comision)

	-- nu merge in cazul in care nu salveaza contractul
	X.RUNSQL('delete from instlines where inst='+vID+' and instliness='+INSTLINES.INSTLINES,null);

	-- nu merge, nu mai apuca sa stearga in INSTLINESS la eventul BEFOREDELETE
	INSTLINESS.FIRST;
	while(!INSTLINESS.Eof)
	{
	INSTLINESS.DELETE;
	}
	// End Rezolvare bug - rezolvat in AFTERPOST
	*/
}

function ON_INSTLINES_AFTERDELETE()
{
	validare_aplicare_com();
	calcul_total();

	//X.WARNING('articol:'+INSTLINES.MTRL);


	if (INSTLINES.MTRL>0) {}
	else
	{
	INST.SETREADONLY('INSTTYPE',0);
	INST.SETREADONLY('CCCMTRGROUP',0);
	}

}

function ON_INSTLINESS_AFTERDELETE()
{
	calcul_total();
}

function docID()
{
    if (INST.INST < 0)
        vID = X.NEWID;
    else
        vID = INST.INST;
    return vID;
}

function validare_ID()
{
			// Validare data expirare act identitate
		DsExp = X.GETSQLDATASET('select convert(varchar(10),date04,112) as data from trdextra where trdr='+INST.TRDR,null);
		ceDataExp = DsExp.data;
		ceData = X.FORMATDATE('yyyymmdd',X.SYS.LOGINDATE);
		if (ceDataExp<ceData)
		X.EXCEPTION('Atentie! Act identitate expirat!');
}

function calcul_gr_evaluat()
{
		// Doar pt. Contracte, nu si acte aditionale
	if (INST.CCCCNTRTYPE==1)
	{
	dataCntr = X.FORMATDATE('yyyymmdd',INST.FROMDATE);
	dataCntr = String.fromCharCode(39)+dataCntr+String.fromCharCode(39);
	if (INST.CCCACOMM>0)
	DsScazamant = X.GETSQLDATASET('select top 1 scazprc from cccacomm where branch='+INST.BRANCH+' and cccacomm='+INST.CCCACOMM,null);
	else
	DsScazamant = X.GETSQLDATASET('select top 1 scazprc from cccacomm where branch='+INST.BRANCH+' and convert(varchar(10),fromdate,112)<='+dataCntr+' order by fromdate desc',null);
	ceGrNet = Math.round(INSTLINES.CCCGWEIGHT * (1 - DsScazamant.scazprc/100) *100)/100;
	//INSTLINES.CCCWEIGHT = ceGrNet;
	}
}

function formare_nume()
{
	ceTipAct='';
	ceTip='';
	ceDurata='';
	ceClient='';

	if (INST.CCCCNTRTYPE>0)
	{
	if (INST.CCCCNTRTYPE==1)
	ceTipAct = 'Contract';
	if (INST.CCCCNTRTYPE==2)
	ceTipAct = 'Act aditional';
	if (INST.CCCCNTRTYPE==3)
	ceTipAct = 'Contract';
	}

	if (INST.INSTTYPE>0)
	{
	DsType = X.GETSQLDATASET('select name from insttype where insttype='+INST.INSTTYPE,null);
	ceTip = DsType.name;
	}

	if (INST.UTBL01>0)
	{
	DsDurata = X.GETSQLDATASET('select name from cccdurata where durata='+INST.UTBL01,null);
	ceDurata = DsDurata.name;
	}

	if (INST.TRDR>0)
	{
	DsClient = X.GETSQLDATASET('select name from trdr where trdr='+INST.TRDR,null);
	ceClient = DsClient.name;
	}

	//ceNume = DsType.name + ' - ' + DsDurata.name + ' - ' + DsClient.name;
	ceNume = ceTipAct + ' - '+ ceTip + ' - ' + ceDurata + ' - ' + ceClient;
	if (INST.NAME != ceNume)
	INST.NAME = ceNume;
}

function calcul_imprumut()
{
	//INST.NEXT;
	// Doar pt. Contracte, nu si acte aditionale
	if (INST.CCCCNTRTYPE==1)
	{
	INSTLINES.CCCEVAL = Math.round(INSTLINES.CCCQTY * INSTLINES.CCCPRICE * (1+INSTLINES.CCCADDPRC/100) * 100)/100;
	INSTLINES.PRICE = Math.round(INSTLINES.CCCQTY * INSTLINES.CCCPRICE * (1+INSTLINES.CCCADDPRC/100) * 100)/100;
	}

}

function calcul_pret_aur()
{
	// Doar pt. Contracte, nu si acte aditionale
	if (INST.CCCCNTRTYPE==1)
	{
	ceData = X.FORMATDATE('yyyymmdd',INST.WDATEFROM);
	ceData = String.fromCharCode(39)+ceData+String.fromCharCode(39);
	dataCntr = X.FORMATDATE('yyyymmdd',INST.FROMDATE);
	dataCntr = String.fromCharCode(39)+dataCntr+String.fromCharCode(39);

	if (INST.CCCACOMM>0)
	DsScazamant = X.GETSQLDATASET('select top 1 scazprc from cccacomm where branch='+INST.BRANCH+' and cccacomm='+INST.CCCACOMM,null);
	else
	DsScazamant = X.GETSQLDATASET('select top 1 scazprc from cccacomm where branch='+INST.BRANCH+' and convert(varchar(10),fromdate,112)<='+dataCntr+' order by fromdate desc',null);
	//DsReducere = X.GETSQLDATASET('select discprice from cccdurata where mtrgroup=1000 and durata='+INST.UTBL01,null);


	if (INST.CCCBRATE>0)
	{
	DsCurs = X.GETSQLDATASET('select top 1 frate as frate, frater, cccbrate from cccbrates where cccbrate='+INST.CCCBRATE+
	' and branch='+INST.BRANCH+' and mtrmark=(select mtrmark from mtrl where mtrl='+INSTLINES.MTRL+' and company='+X.SYS.COMPANY+')',null);
	}
	else
	{
	DsCurs = X.GETSQLDATASET('select top 1 frate as frate, frater, cccbrate from cccbrates where convert(varchar(10),ratedate,112)<='+ceData+
	' and branch='+INST.BRANCH+' and mtrmark=(select mtrmark from mtrl where mtrl='+INSTLINES.MTRL+' and company='+X.SYS.COMPANY+') order by ratedate desc',null);
	}
	//cePret = Math.round((DsCurs.frate - DsReducere.discprice)*100)/100;
	//X.WARNING(cePret);

	if (INST.cccdurtype==1)
	ceCurs = DsCurs.frate;
	if (INST.cccdurtype==2)
	ceCurs = DsCurs.frater;

	if (ceCurs>0)
	{
	INSTLINES.CCCPRICE = Math.round(ceCurs*100)/100;
	if (INST.CCCBRATE>0) {}
	else
	INST.CCCBRATE = DsCurs.cccbrate;
	}
	else
	X.EXCEPTION('Nu exista pret definit, verificati configurari preturi bursa!');
	}
}

function aplicare_promo_avans()
{
	dataCntr = X.FORMATDATE('yyyymmdd',INST.FROMDATE);
	dataCntr = String.fromCharCode(39)+dataCntr+String.fromCharCode(39);

	if (INST.CCCACOMM>0)
	DsPrc = X.GETSQLDATASET('select top 1 COMMAVRPRC, COMMAVMPRC from CCCACOMM where cccacomm='+INST.CCCACOMM,null);
	else
	DsPrc = X.GETSQLDATASET('select top 1 COMMAVRPRC, COMMAVMPRC from CCCACOMM where branch='+INST.BRANCH+' and convert(varchar(10),fromdate,112)<='+dataCntr+' order by fromdate desc',null);

	cePrcR = DsPrc.commavrprc;
	cePrcM = DsPrc.commavmprc;

	INSTLINES.FIRST;
	while(!INSTLINES.Eof)
	{
			//cePret = INSTLINES.CCCPRICE;
			//ceQty = INSTLINES.CCCQTY;
			INSTLINES.CCCADDPRC = cePrcM;
			//INSTLINES.PRICE = Math.round(cePret * ceQty * (1+cePrcM/100) *100)/100;

			//*ceVal = INSTLINES.PRICE;
			//*INSTLINES.PRICE = Math.round(ceVal * 100 / (1+cePrcM/100))/100;
			INSTLINES.NEXT;
	}

	INSTLINESS.FIRST;
	while(!INSTLINESS.Eof)
						{
								cePret = INSTLINESS.CCCPRICE;
								ceQty = INSTLINESS.CCCQTY;
								INSTLINESS.CCCDISCPRC = cePrcR;
								//*INSTLINESS.PRICE = Math.round(cePret * ceQty * (1-cePrcR/100) *100)/100;
								INSTLINESS.NEXT;
						}
}

function anulare_promo_avans()
{
	dataCntr = X.FORMATDATE('yyyymmdd',INST.FROMDATE);
	dataCntr = String.fromCharCode(39)+dataCntr+String.fromCharCode(39);

	if (INST.CCCACOMM>0)
	DsPrc = X.GETSQLDATASET('select top 1 COMMAVRPRC, COMMAVMPRC from CCCACOMM where cccacomm='+INST.CCCACOMM,null);
	else
	DsPrc = X.GETSQLDATASET('select top 1 COMMAVRPRC, COMMAVMPRC from CCCACOMM where branch='+INST.BRANCH+' and convert(varchar(10),fromdate,112)<='+dataCntr+' order by fromdate desc',null);

	cePrcR = DsPrc.commavrprc;
	cePrcM = DsPrc.commavmprc;
	INSTLINES.FIRST;
	while(!INSTLINES.Eof)
	{
			//cePret = INSTLINES.CCCPRICE;
			//ceQty = INSTLINES.CCCQTY;
			INSTLINES.CCCADDPRC = 0;
			//INSTLINES.PRICE = Math.round(cePret * ceQty * (1+cePrcM/100) *100)/100;

			//*ceVal = INSTLINES.PRICE;
			//*INSTLINES.PRICE = Math.round(ceVal * 100 / (1+cePrcM/100))/100;
		INSTLINES.NEXT;
	}

	INSTLINESS.FIRST;
	while(!INSTLINESS.Eof)
						{
								cePret = INSTLINESS.CCCPRICE;
								ceQty = INSTLINESS.CCCQTY;
								INSTLINESS.CCCDISCPRC = 0;
								//*INSTLINESS.PRICE = Math.round(cePret * ceQty * (1-cePrcR/100) *100)/100;
								INSTLINESS.NEXT;
						}
}

function calcul_comision()
{
	DsCateg = X.GETSQLDATASET('select mtrcategory from mtrl where mtrl='+INSTLINESS.MTRL,null);
	if (DsCateg.mtrcategory==106 || DsCateg.mtrcategory==107 || DsCateg.mtrcategory==101)
	{
	cateZile=0;
	ceData1 = X.FORMATDATE('yymmdd',INSTLINESS.FROMDATE);
	ceData2 = X.FORMATDATE('yymmdd',INSTLINESS.FINALDATE);

	if (INSTLINESS.FROMDATE==null || INSTLINESS.FINALDATE==null || INSTLINESS.FROMDATE==''||INSTLINESS.FINALDATE=='')
	cateZile=0;
	else
	{
	DsDataDif = X.GETSQLDATASET("select datediff(d,'"+ceData1+"','"+ceData2+"') as zile",null);
	DsCod = X.GETSQLDATASET('select code from mtrl where mtrl='+INSTLINESS.MTRL,null);

	nrZile = DsDataDif.zile+1;

	DsDurata = X.GETSQLDATASET('select gdays as gdays from cccdurata where durata='+INST.UTBL01,null); // zile gratie

	dataCntr = X.FORMATDATE('yyyymmdd',INST.FROMDATE);
	dataCntr = String.fromCharCode(39)+dataCntr+String.fromCharCode(39);

	if (INST.CCCACOMM>0)
	DsDurataM = X.GETSQLDATASET('select top 1 gdays from cccacomm where cccacomm='+INST.CCCACOMM,null); // minim zile
	else
	DsDurataM = X.GETSQLDATASET('select top 1 gdays from cccacomm where branch='+INST.BRANCH+' and convert(varchar(10),fromdate,112)<='+dataCntr+' order by fromdate desc',null); // minim zile

	grZile = DsDurata.gdays;
	minZile = DsDurataM.gdays;

	/*if (cePayType == 3) // Lichidare
	{
	// Aplicare doar la contracte cu durata normala
		DsTipDurata = X.GETSQLDATASET('select type from cccdurata where durata='+INST.UTBL01,null);
		if (DsTipDurata.type==2)  // Durata normala
		{
		DsCateg = X.GETSQLDATASET('select mtrcategory from mtrl where mtrl='+INSTLINESS.MTRL,null);
		if (nrZile<=minZile&&DsCateg.mtrcategory==106)
		cateZile = minZile;
		else
		cateZile = nrZile;
		}
		if (DsTipDurata.type==1)  // Durata redusa
		cateZile = nrZile;
	}
	else*/
	cateZile = nrZile;

	}

	//X.WARNING(cateZile);
	if (DsCateg.mtrcategory==106 || DsCateg.mtrcategory==107)
	INSTLINESS.CCCQTY = cateZile;

	//if (DsCateg.mtrcategory==101)
	//{
	//INSTLINESS.CCCQTY = (-1)*cateZile;
	//INSTLINESS.CCCQTY = -1;
	}

	if (DsCateg.mtrcategory==108)
	INSTLINESS.CCCQTY = 1;

	if (DsCateg.mtrcategory==101)
	INSTLINESS.CCCQTY = -1;
}

function calcul_pret_comision()
{
	if (INSTLINES.MTRL>0)
	{
	DsCateg = X.GETSQLDATASET('select mtrcategory from mtrl where mtrl='+INSTLINESS.MTRL,null);

	if (DsCateg.mtrcategory==106 || DsCateg.mtrcategory==107)
	{
	//X.WARNING('calcul pret comision');
	ceComVal = 0;
	ceComm = 0;
	INSTLINES.FIRST;
	while(!INSTLINES.Eof)
	{
	DsGroup = X.GETSQLDATASET('select isnull(mtrgroup,0) as mtrgroup from mtrl where mtrl='+INSTLINES.MTRL,null);

	// Tip comision: durata normala / redusa
	DsTipDurata = X.GETSQLDATASET('select type from cccdurata where durata='+INST.UTBL01,null);

	// Comision agentie/categorie/valoare
	dataCntr = X.FORMATDATE('yyyymmdd',INST.FROMDATE);
	dataCntr = String.fromCharCode(39)+dataCntr+String.fromCharCode(39);

	if (INST.CCCACOMM>0)
	{
	DsComm = X.GETSQLDATASET('select top 1 commprc as commprc, commprcr as commprcr, commprci as commprci, cccacomm from cccacomms where mtrgroup='+DsGroup.mtrgroup+
													' and isnull(valfrom,0)<='+INST.CCCITESUM+' and cccacomm='+INST.CCCACOMM+' order by valfrom desc',null);
	}

	else
	{

	// Grila curenta
	//DsComm = X.GETSQLDATASET('select top 1 commprc as commprc, commprcr as commprcr, commprci as commprci, cccacomm, commtype from cccacomms where branch='+INST.BRANCH+' and mtrgroup='+DsGroup.mtrgroup+
		//											' and isnull(valfrom,0)<='+INST.CCCITESUM+' and convert(varchar(10),fromdate,112)<='+dataCntr+' order by fromdate desc, valfrom desc',null);
	DsComm = X.GETSQLDATASET('select top 1 a.commprc as commprc, a.commprcr as commprcr, a.commprci as commprci, a.cccacomm, ac.commtype from cccacomms a '+
													' join cccacomm ac on ac.cccacomm=a.cccacomm '+
													' where a.branch='+INST.BRANCH+' and a.mtrgroup='+DsGroup.mtrgroup+
													' and isnull(a.valfrom,0)<='+INST.CCCITESUM+' and convert(varchar(10),a.fromdate,112)<='+dataCntr+
													' order by a.fromdate desc, a.valfrom desc',null);

	// Grila origine
	if (DsComm.commtype==1&&INST.CCCCNTRTYPE==2) // Doar acte aditionale
	{
	DsComm = X.GETSQLDATASET('select top 1 commprc as commprc, commprcr as commprcr, commprci as commprci, cccacomm from cccacomms where mtrgroup='+DsGroup.mtrgroup+
													' and isnull(valfrom,0)<='+INST.CCCITESUM+' and cccacomm=(select cccacomm from inst where inst='+INST.CCCINSTS+') order by valfrom desc',null);
	}
	}

	// Legatura ID Configurare Agentii - Comisioane
	if (INST.CCCACOMM>0) {}
	else
	{
	INST.CCCACOMM = DsComm.cccacomm;
	}
	//X.WARNING(DsComm.cccacomm+' , '+INST.CCCACOMM);

	//Comision intarziere agentie
	//DsCommInt = X.GETSQLDATASET('select commprc from cccacomm where branch='+X.SYS.BRANCH, null);

	dataCntr1 = X.FORMATDATE('yymmdd',INST.WDATEFROM);
	dataCntr2 = X.FORMATDATE('yymmdd',INST.WDATETO);
	dataGr1 = X.FORMATDATE('yymmdd',INST.GDATEFROM);
	dataGr2 = X.FORMATDATE('yymmdd',INST.GDATETO);
	dataComm1 = X.FORMATDATE('yymmdd',INSTLINESS.FROMDATE);
	dataComm2 = X.FORMATDATE('yymmdd',INSTLINESS.FINALDATE);


	if (dataComm2<dataGr2 || dataComm2==dataGr2)
	{
	if (DsTipDurata.type == 1)
	ceComm = DsComm.commprcr;
	if (DsTipDurata.type == 2)
	ceComm = DsComm.commprc;
	}

	if (dataComm2>dataGr2)
	{
	if (DsTipDurata.type == 1)
	ceComm = DsComm.commprcr;
	if (DsTipDurata.type == 2)
	ceComm = DsComm.commprci;
	}
	//ceComm = DsCommInt.commprc;

	// Aplicare comision special (negociat)
	if (INST.BOOL04==1 && INST.CCCCOMSPEC!=0)
	{
	//X.WARNING('Aplicare comision special...');
	ceComm = INST.CCCCOMSPEC;
	}

	//X.WARNING(INSTLINESS.MTRL+' '+ceComm);
	ceComArt = Math.round((ceComm/100) * INSTLINES.PRICE * 100)/100;
	//INSTLINESS.CCCPRICE = Math.round((ceComm/100) * INST.CCCITESUM * 100)/100;
	ceComVal+=ceComArt;
	INSTLINES.NEXT;
	}

	INSTLINESS.CCCPRICE = ceComVal;
	INSTLINES.CCCCOMPRC = ceComm;
	INSTLINESS.CCCCOMPRC = ceComm;
	}

	if (DsCateg.mtrcategory==108)
	{
	ceComm = 0;
	dataCntr = X.FORMATDATE('yyyymmdd',INST.FROMDATE);
	dataCntr = String.fromCharCode(39)+dataCntr+String.fromCharCode(39);

	if (INST.CCCACOMM>0)
	DsCommAdm = X.GETSQLDATASET('select top 1 commadm from cccacomm where cccacomm='+INST.CCCACOMM, null);
	else
	DsCommAdm = X.GETSQLDATASET('select top 1 commadm from cccacomm where branch='+INST.BRANCH+' and convert(varchar(10),fromdate,112)<='+dataCntr+' order by fromdate desc', null);

	ceComm = DsCommAdm.commadm;
	INSTLINESS.CCCPRICE = ceComm;
	}

	if (DsCateg.mtrcategory==101)
	{
	INSTLINESS.CCCPRICE = (-1)*Math.round(ceVal*100/INSTLINESS.CCCQTY)/100;
	}

	INSTLINESS.PRICE = Math.round(INSTLINESS.CCCPRICE*INSTLINESS.CCCQTY* (1-INSTLINESS.CCCDISCPRC/100) * 100)/100;
	}
}

function valoare_comision_initial()
{
	ceComCntr = 0;
	INSTLINESS.FIRST;
	while(!INSTLINESS.Eof)
	{
	DsSrv = X.GETSQLDATASET('select mtrcategory from mtrl where mtrl='+INSTLINESS.MTRL,null);
	if (DsSrv.mtrcategory==106|| DsSrv.mtrcategory==107 || DsSrv.mtrcategory==108 || DsSrv.mtrcategory==109)
	ceComCntr+=INSTLINESS.PRICE;
	INSTLINESS.NEXT;
	}
}

function simulare_imprumut()
{
	ceData = X.FORMATDATE('yyyymmdd',INST.WDATEFROM);
	dataCntr = X.FORMATDATE('yyyymmdd',INST.FROMDATE);
	dataCntr = String.fromCharCode(39)+dataCntr+String.fromCharCode(39);
	DsScazamant = X.GETSQLDATASET('select top 1 scazprc from cccacomm where branch='+INST.BRANCH+' and convert(varchar(10),fromdate,112)<='+dataCntr+' order by fromdate desc',null);
	DsCurs = X.GETSQLDATASET("select top 1 frate as frate, frater from cccbrates where convert(varchar(10),ratedate,112)<='"+ceData+
	"' and branch="+INST.BRANCH+" and mtrmark="+INST.UTBL02+" order by ratedate desc",null);
	//Pret/gram
		DsScazamant = X.GETSQLDATASET('select top 1 scazprc from cccacomm where branch='+INST.BRANCH+' and convert(varchar(10),fromdate,112)<='+dataCntr+' order by fromdate desc',null);

	if (INST.cccdurtype==1)
	ceCurs = DsCurs.frate;
	if (INST.cccdurtype==2)
	ceCurs = DsCurs.frater;

	ceWbrut = INST.NUM02;
	ceWeval = Math.round(ceWbrut * (1 - DsScazamant.scazprc/100) *100)/100;
	cePretUM = Math.round(ceCurs * 100)/100;
	cePret = Math.round(ceWeval * cePretUM *100)/100;

	INST.NUM05 = cePretUM;
	INST.NUM03 = Math.round(cePret * (1+cePrcM/100)*100)/100;
}

function simulare_comision()
{
	dataCntr1 = X.FORMATDATE('yymmdd',INST.WDATEFROM);
	dataCntr2 = X.FORMATDATE('yymmdd',INST.WDATETO);

	DsDataDif = X.GETSQLDATASET("select datediff(d,'"+dataCntr1+"','"+dataCntr2+"') as zile",null);
	//DsGroup = X.GETSQLDATASET('select mtrgroup from mtrl where mtrl='+INSTLINES.MTRL,null);
	ceGrup = INST.UTBL03;

	// Tip comision: durata normala / redusa
	DsTipDurata = X.GETSQLDATASET('select type from cccdurata where durata='+INST.UTBL01,null);

	// Comision agentie/categorie/valoare
	dataCntr = X.FORMATDATE('yyyymmdd',INST.FROMDATE);
	dataCntr = String.fromCharCode(39)+dataCntr+String.fromCharCode(39);
	DsComm = X.GETSQLDATASET('select top 1 commprc as commprc, commprcr as commprcr, commprci as commprci from cccacomms where branch='+INST.BRANCH+' and mtrgroup='+ceGrup+
													' and isnull(valfrom,0)<='+cePret+' and convert(varchar(10),fromdate,112)<='+dataCntr+' order by fromdate desc, valfrom desc',null);

	if (DsTipDurata.type == 1)
	ceComm = DsComm.commprcr;
	if (DsTipDurata.type == 2)
	ceComm = DsComm.commprc;

	cateZile = DsDataDif.zile+1;
	ceCommUM = Math.round((ceComm/100) * cePret * 100)/100;
	ceComm = Math.round(ceCommUM*cateZile * 100)/100;
	INST.NUM04 = Math.round(ceComm * (1-cePrcR/100) * 100)/100;
}

function validare_aplicare_pret()
{
	// Doar pt. Contracte, nu si acte aditionale
	if (INST.CCCCNTRTYPE==1)
	{
	DsMtrl = X.GETSQLDATASET('select mtrcategory from mtrl where mtrl='+INSTLINES.MTRL,null);
	if (DsMtrl.mtrcategory == 1000)
	{
	if (INSTLINES.CCCWEIGHT == 0 || INSTLINES.CCCGWEIGHT == 0 || INSTLINES.CCCWEIGHT == null || INSTLINES.CCCGWEIGHT == null)
	X.EXCEPTION('Completati greutatea!');

	ceData = X.FORMATDATE('yyyymmdd',INST.WDATEFROM);
	dataCntr = X.FORMATDATE('yyyymmdd',INST.FROMDATE);
	dataCntr = String.fromCharCode(39)+dataCntr+String.fromCharCode(39);

	if (INST.CCCACOMM>0)
	DsScazamant = X.GETSQLDATASET('select top 1 scazprc from cccacomm where cccacomm='+INST.CCCACOMM,null);
	else
	DsScazamant = X.GETSQLDATASET('select top 1 scazprc from cccacomm where branch='+INST.BRANCH+' and convert(varchar(10),fromdate,112)<='+dataCntr+' order by fromdate desc',null);
	//DsReducere = X.GETSQLDATASET('select discprice from cccdurata where mtrgroup=1000 and durata='+INST.UTBL01,null);

	if (INST.CCCBRATE>0)
	{
	DsCurs = X.GETSQLDATASET('select top 1 frate as frate, frater, cccbrate from cccbrates where cccbrate='+INST.CCCBRATE+
	' and branch='+INST.BRANCH+' and mtrmark=(select mtrmark from mtrl where mtrl='+INSTLINES.MTRL+' and company='+X.SYS.COMPANY+')',null);
	}
	else
	{
	DsCurs = X.GETSQLDATASET("select top 1 frate as frate, frater, cccbrate from cccbrates where convert(varchar(10),ratedate,112)<='"+ceData+
	"' and branch="+INST.BRANCH+" and mtrmark=(select mtrmark from mtrl where mtrl="+INSTLINES.MTRL+" and company="+X.SYS.COMPANY+") order by ratedate desc",null);
	}

	if (INST.cccdurtype==1)
	ceCurs = DsCurs.frate;
	if (INST.cccdurtype==2)
	ceCurs = DsCurs.frater;

	cePret = Math.round(ceCurs*100)/100 ;
	if (INSTLINES.CCCPRICE!=cePret)
	X.EXCEPTION('Modificare nepermisa, pret incorect!');
	}
	}
}

function validare_aplicare_com()
{
	vdel=1;
	sumCom = 0;
	sumCmi = 0;
	sumCma = 0;
	sumCmad = 0;
	sumDsc = 0;
	INSTLINESS.FIRST;
		while (!INSTLINESS.Eof)
		{
		DsCateg = X.GETSQLDATASET('select mtrcategory from mtrl where mtrl='+INSTLINESS.MTRL,null);


		if (DsCateg.mtrcategory==101) // Discounturi
		{
		sumDsc = 0;
		//sumDsc = sumDsc + 1;
		}

		if (DsCateg.mtrcategory==108) // Comision administrare
		{
		sumCma = sumCma + 1;
		}

		if (DsCateg.mtrcategory==106) // Comision normal
		{
		sumCom = sumCom + 1;
		}

		if (DsCateg.mtrcategory==107) // Comision intarziere
		{
		sumCmi = sumCmi + 1;
		}

		if (DsCateg.mtrcategory==109) // Comision adaos
		{
		sumCmad = 0;
		//sumCmad = sumCmad + 1;
		}

		INSTLINESS.NEXT;
		}

		if (sumCom>0 || sumCmi>0 || sumCma>0 || sumDsc>0 || sumCmad>0)
		{
		INSTLINESS.FIRST;
			while(!INSTLINESS.Eof)
			{
			DsCateg = X.GETSQLDATASET('select mtrcategory from mtrl where mtrl='+INSTLINESS.MTRL,null);

				if (DsCateg.mtrcategory==101) // Discount
				{
				if (INSTLINESS.CCCPAID!=0)
				X.EXCEPTION('Modificare nepermisa, exista tranzactii!');

				if (INSTLINESS.CCCPAID==0||INSTLINESS.CCCPAID==null || INSTLINESS.CCCPAID=='')
				{
				INSTLINESS.DELETE;
				INSTLINESS.PRIOR;
				}
				}


				ceDataLim = X.FORMATDATE('yyyymmdd',INST.BLCKDATE);
				ceDataGr2 = X.FORMATDATE('yyyymmdd',INST.GDATETO);

				if (ceDataLim<ceDataGr2 || ceDataLim==ceDataGr2 )
				{
				if (DsCateg.mtrcategory==106) // Comision
				{
				INSTLINESS.FROMDATE = INST.WDATEFROM;
				INSTLINESS.FINALDATE = INST.BLCKDATE;
				}

				if (DsCateg.mtrcategory==107)
				{
				if (INSTLINESS.CCCPAID!=0)
				X.EXCEPTION('Modificare nepermisa, exista tranzactii!');

				if (INSTLINESS.CCCPAID==0||INSTLINESS.CCCPAID==null || INSTLINESS.CCCPAID=='')
				{
				INSTLINESS.DELETE;
				INSTLINESS.PRIOR;
				}

				}
				}

				if (ceDataLim>ceDataGr2 &&INSTLINESS.MTRL>0)
				{
					if (DsCateg.mtrcategory==106)
					{
					INSTLINESS.FROMDATE = INST.WDATEFROM;
					INSTLINESS.FINALDATE = INST.GDATETO;
					}

					if (DsCateg.mtrcategory==107)
					{
					dataGr2 = X.FORMATDATE('yymmdd',INST.GDATETO);
					DsData = X.GETSQLDATASET("select dateadd(d,1,'"+dataGr2+"') as data",null);
					//INSTLINESS.FINALDATE = null;
					//INSTLINESS.FROMDATE = null;
					INSTLINESS.FROMDATE = DsData.data;
					INSTLINESS.FINALDATE = INST.BLCKDATE;
					}
				}

				if (DsCateg.mtrcategory==108) // Comision administrare
				{
				if (INST.BOOL03==0)
				{
				if (INSTLINESS.CCCPAID!=0)
				X.EXCEPTION('Modificare nepermisa, exista tranzactii!');

				if (INSTLINESS.CCCPAID==0||INSTLINESS.CCCPAID==null || INSTLINESS.CCCPAID=='')
				{
				INSTLINESS.DELETE;
				INSTLINESS.PRIOR;
				}

				}
				INSTLINESS.FROMDATE = INST.WDATEFROM;
				INSTLINESS.FINALDATE = INST.BLCKDATE;
				}

				if (DsCateg.mtrcategory==109)  // Adaos Comision
				{
				if (INSTLINESS.CCCPAID!=0)
				X.EXCEPTION('Modificare nepermisa, exista tranzactii!');

				if (INSTLINESS.CCCPAID==0||INSTLINESS.CCCPAID==null || INSTLINESS.CCCPAID=='')
				{
				INSTLINESS.DELETE;
				INSTLINESS.PRIOR;
				}
				}

			INSTLINESS.NEXT;
			}
		}

		if (sumCom==0)
		{
		aplicare_comision();
		}

		if (sumCmi==0)
		aplicare_comision_int();

		if (sumCma==0)
		{
			if (INST.BOOL03==1)
			aplicare_comision_adm();
		}

		if (sumCmad==0)
		{
		// Adaos comision valoare minima
			/*if (INST.CCCPAYTYPE == 3) // Doar la Lichidare
			aplicare_comision_adaos();	*/

		// Adaos comision valoare minima
		// Nou! La intocmire contract / act / incasare / lichidare
			aplicare_comision_adaos();
		}

		if (sumDsc==0)
		{
		if (INST.INST>0)
		{
		validare_use_promo();
		//if (INST.CCCVOUCHER>0)
	  aplicare_discount_voucher();
		if (INST.CCCCARDUSE>0)
		aplicare_discount_card();
		}
		}

		vdel=0;
}

function aplicare_comision()
{
	INSTLINESS.EDIT;
	INSTLINESS.APPEND;
	ceCod = 'COM';
	DsSrv = X.GETSQLDATASET("select mtrl from mtrl where sodtype=52 and company="+X.SYS.COMPANY+" and code='"+ceCod+"'",null);
	INSTLINESS.MTRL = DsSrv.mtrl;
	INSTLINESS.QTY = 1;

	INSTLINESS.FROMDATE = INST.WDATEFROM;
	INSTLINESS.FINALDATE = INST.BLCKDATE;

	//INSTLINESS.POST;
}


function aplicare_comision_int()
{
  ceData1 = X.FORMATDATE('yymmdd',INST.BLCKDATE);
	dataCntr1 = X.FORMATDATE('yymmdd',INST.WDATEFROM);
	dataCntr2 = X.FORMATDATE('yymmdd',INST.WDATETO);
	dataGr1 = X.FORMATDATE('yymmdd',INST.GDATEFROM);
	dataGr2 = X.FORMATDATE('yymmdd',INST.GDATETO);
	dataComm1 = X.FORMATDATE('yymmdd',INSTLINESS.FROMDATE);
	dataComm2 = X.FORMATDATE('yymmdd',INSTLINESS.FINALDATE);

	//if ((dataComm2>dataGr2)&&(dataComm1==dataCntr1))
	if (ceData1>dataGr2)
	{
	X.WARNING('Termen contractual depasit! Se aplica comision intarziere');
	//INSTLINESS.FINALDATE = INST.GDATETO;

	// Comision intarziere agentie
	//DsCommInt = X.GETSQLDATASET('select commprc from cccacomm where branch='+X.SYS.BRANCH, null);

	//ceComm = DsCommInt.commprc;
	//INSTLINESS.LAST;

	//aplicare_comision();

	INSTLINESS.APPEND;
	ceCod = 'CMI';
	DsSrv = X.GETSQLDATASET("select mtrl from mtrl where sodtype=52 and company="+X.SYS.COMPANY+" and code='"+ceCod+"'",null);
	INSTLINESS.MTRL = DsSrv.mtrl;
	INSTLINESS.QTY = 1;


	DsData = X.GETSQLDATASET("select dateadd(d,1,'"+dataGr2+"') as data",null);
	//ceData = X.FORMATDATE('dd.mm.yyyy',DsData.data);
	//INSTLINESS.FROMDATE = INST.GDATETO;
	INSTLINESS.FROMDATE = DsData.data;
	INSTLINESS.FINALDATE = INST.BLCKDATE;

	}
}

function aplicare_comision_adm()
{
	//INSTLINESS.EDIT;
	INSTLINESS.APPEND;
	ceCod = 'CMA';
	DsSrv = X.GETSQLDATASET("select mtrl from mtrl where sodtype=52 and company="+X.SYS.COMPANY+" and code='"+ceCod+"'",null);
	INSTLINESS.MTRL = DsSrv.mtrl;
	INSTLINESS.QTY = 1;

	INSTLINESS.FROMDATE = INST.WDATEFROM;
	INSTLINESS.FINALDATE = INST.WDATETO;
	//INSTLINESS.POST;
}

function aplicare_comision_adaos()
{
	// Aplicare doar la contracte cu durata normala
	DsTipDurata = X.GETSQLDATASET('select type from cccdurata where durata='+INST.UTBL01,null);
	if (DsTipDurata.type==2)
	{
	qZile = 0;
	valCom = 0;
	cePretAdaos=0;
	ceValAdaosZ=0;
	ceDifZ=0;
	ceDifV=0;
	aplicZ = 0;
	aplicV = 0;


	dataCntr = X.FORMATDATE('yyyymmdd',INST.FROMDATE);
	dataCntr = String.fromCharCode(39)+dataCntr+String.fromCharCode(39);

	if (INST.CCCACOMM>0)
	DsDurataM = X.GETSQLDATASET('select top 1 gdays from cccacomm where cccacomm='+INST.CCCACOMM,null); // minim zile
	else
	DsDurataM = X.GETSQLDATASET('select top 1 gdays from cccacomm where branch='+INST.BRANCH+' and convert(varchar(10),fromdate,112)<='+dataCntr+' order by fromdate desc',null); // minim zile
	minZile = DsDurataM.gdays;

	if (INST.CCCACOMM>0)
	DsMinim = X.GETSQLDATASET('select top 1 isnull(minval,0) as minval, isnull(mintype,0) as mintype from cccacomm where cccacomm='+INST.CCCACOMM,null); // minim valoare
	else
	DsMinim = X.GETSQLDATASET('select top 1 isnull(minval,0) as minval, isnull(mintype,0) as mintype from cccacomm where branch='+INST.BRANCH+' and convert(varchar(10),fromdate,112)<='+dataCntr+'  order by fromdate desc',null); // minim valoare

	INSTLINESS.FIRST;
	while(!INSTLINESS.Eof)
	{
	DsCateg = X.GETSQLDATASET('select mtrcategory from mtrl where mtrl='+INSTLINESS.MTRL,null);
		if (DsCateg.mtrcategory==106 || DsCateg.mtrcategory==107)
		{
		qZile+=INSTLINESS.CCCQTY;
		if (DsMinim.mintype==0)
		valCom+=INSTLINESS.PRICE;
		if (DsMinim.mintype==1)
		{
		if (DsCateg.mtrcategory==106)
		valCom+=INSTLINESS.CCCPRICE;
		}
		if (DsCateg.mtrcategory==106)
		cePretAdaos = INSTLINESS.CCCPRICE;
		}
			//INSTLINESS.LOCATE('INSTLINES',ceLineC);
		INSTLINESS.NEXT;
	}


	ceCod = 'ADC';
	DsSrv = X.GETSQLDATASET("select mtrl from mtrl where sodtype=52 and company="+X.SYS.COMPANY+" and code='"+ceCod+"'",null);

	if (qZile<minZile&& DsDurataM.gdays>0)
	{
	ceDifZ=minZile-qZile;
	ceValAdaosZ = Math.round(ceDifZ*cePretAdaos*100)/100;
	}

	if (valCom < DsMinim.minval && DsMinim.minval>0)
	ceDifV = Math.round((DsMinim.minval - valCom)*100)/100;

	if (DsMinim.mintype==0) // Aplicare Minim Valoric SAU Minim Zile
	{
	if (ceValAdaosZ>=ceDifV&&ceDifZ>0)
	aplicZ = 1;
	if (ceValAdaosZ<ceDifV&&ceDifV>0)
	aplicV = 1;
	}

	if (DsMinim.mintype==1) // Aplicare Minim Valoric SI Minim Zile
	{
	if (ceDifV>0)
	aplicV = 1;
	if (ceDifZ>0)
	aplicZ = 1;
	}

	// Conditie pt. a nu aplica minim daca se lichideaza inainte de valabilitatea contractului (Nou)
	if (INST.BLCKDATE<INST.WDATEFROM)
	{
	aplicZ=0;
	aplicV=0;
	}

	if (aplicZ==1 || aplicV==1)
	{
	//Aplicare zile minime comision adaos
	if (aplicZ==1)
	{
	//X.WARNING('Limita zile minime comision! Se aplica comision adaos.');
	INSTLINESS.APPEND;
	INSTLINESS.MTRL = DsSrv.mtrl;
	INSTLINESS.CCCPRICE = cePretAdaos;
	INSTLINESS.CCCQTY = ceDifZ;
	INSTLINESS.QTY = 1;

	INSTLINESS.FROMDATE = INST.WDATEFROM;
	 if (INST.BLCKDATE>0)
	 INSTLINESS.FINALDATE = INST.BLCKDATE;
	 else
	 INSTLINESS.FINALDATE = INST.WDATETO;
	}

	//Aplicare valaore minima comision adaos
	if (aplicV==1)
	{
	//X.WARNING('Limita valoare minima comision! Se aplica comision adaos.');
	INSTLINESS.APPEND;
	INSTLINESS.MTRL = DsSrv.mtrl;
	INSTLINESS.CCCPRICE = ceDifV;
	INSTLINESS.CCCQTY = 1;
	INSTLINESS.QTY = 1;

	INSTLINESS.FROMDATE = INST.WDATEFROM;
	 if (INST.BLCKDATE>0)
	 INSTLINESS.FINALDATE = INST.BLCKDATE;
	 else
	 INSTLINESS.FINALDATE = INST.WDATETO;
	}

	 /*INSTLINESS.FROMDATE = INST.WDATEFROM;
	 if (INST.BLCKDATE>0)
	 INSTLINESS.FINALDATE = INST.BLCKDATE;
	 else
	 INSTLINESS.FINALDATE = INST.WDATETO;*/
	}
	}
}

function aplicare_comision_lichidare()
{
	// Aplicare diferenta comision vs incasare OP
	if (INST.UTBL05==200)
	{
	DsOP = X.GETSQLDATASET('select sum(llineval) as opval from trdtlines where inst='+vID+' and sosource=1413', null);
	ceVal = DsOP.opval - INST.CCCSUMAMNT;
	if (ceVal > 0) // Diferenta pozitiva => Adaos
	{
	ceCod = 'ADL';
	DsSrv = X.GETSQLDATASET("select mtrl from mtrl where sodtype=52 and company="+X.SYS.COMPANY+" and code='"+ceCod+"'",null);
	INSTLINESS.APPEND;
	INSTLINESS.MTRL = DsSrv.mtrl;
	INSTLINESS.CCCPRICE = ceVal;
	INSTLINESS.CCCQTY = 1;
	INSTLINESS.QTY = 1;

	INSTLINESS.FROMDATE = INST.WDATEFROM;
	 if (INST.BLCKDATE>0)
	 INSTLINESS.FINALDATE = INST.BLCKDATE;
	 else
	 INSTLINESS.FINALDATE = INST.WDATETO;
	}
	if (ceVal<0 && (DsOP.opval>INST.CCCITESUM || DsOP.opval==INST.CCCITESUM)) // Diferenta negativa => Discount; se accepta doar daca acopera valoare imprumut
	{
	ceCod = 'DSL';
	DsSrv = X.GETSQLDATASET("select mtrl from mtrl where sodtype=52 and company="+X.SYS.COMPANY+" and code='"+ceCod+"'",null);
	INSTLINESS.APPEND;
	INSTLINESS.MTRL = DsSrv.mtrl;
	INSTLINESS.CCCPRICE = (-1)*ceVal;
	INSTLINESS.CCCQTY = -1;
	INSTLINESS.QTY = -1;

	INSTLINESS.FROMDATE = INST.WDATEFROM;
	 if (INST.BLCKDATE>0)
	 INSTLINESS.FINALDATE = INST.BLCKDATE;
	 else
	 INSTLINESS.FINALDATE = INST.WDATETO;
	}
	}

}

function calcul_total()
{
	INSTLINES.DISABLECONTROLS;
	try{

	sumI = 0;
	sumC = 0;
	sumT = 0;
	INSTLINES.FIRST;
	while (!INSTLINES.Eof)
	{
	sumI+=INSTLINES.PRICE;

	INSTLINES.NEXT;
	}

		}
	finally{INSTLINES.ENABLECONTROLS;}

	INSTLINESS.DISABLECONTROLS;
		try{

		INSTLINESS.FIRST;
		while(!INSTLINESS.Eof)
		{
		sumC+=INSTLINESS.PRICE;

		INSTLINESS.NEXT;
		}
			}
			finally{INSTLINESS.ENABLECONTROLS;}



	INST.CCCITESUM = Math.round(sumI*100)/100;
	INST.CCCSRVSUM = Math.round(sumC*100)/100;
	INST.CCCSUMAMNT = Math.round((sumI + sumC)*100)/100;

}

function prelungire_contract(showNext)
{

	DsCond = X.GETSQLDATASET('select sum(isnull(price,0)-isnull(cccpaid,0)) as dif from instlines where sodtype=52 and inst='+vID,null);
	cePrel = DsCond.dif;


	// Conditie suplimentara: doar daca nu este deja generat alt act aditional
	docID();
	/*DsCond2 = X.GETSQLDATASET('select inst from inst where isnull(cccinsts,0)>0 and cccinsts='+vID,null);
	ceCond = DsCond2.RECORDCOUNT;

	if (ceCond>0)
	X.EXCEPTION('Contractul a fost deja prelungit!');*/


	//X.WARNING(cePrel);
	// Prelungire contract - Client: creare act aditional
	if (cePrel == 0)
	{
	//X.EXEC('button:Save');

	headerRO(0);

	if (INST.CCCPRSN>0)
	cePrsn = INST.CCCPRSN;
	else
	cePrsn = '';

	if (INST.CCCPRSN1>0)
	cePrsn1 = INST.CCCPRSN1;
	else
	cePrsn1 = '';

	if (INST.CCCPRSN2>0)
	cePrsn2 = INST.CCCPRSN2;
	else
	cePrsn2 = '';

  if (showNext) {
	   X.EXEC('XCMD:INST[AUTOEXEC=2,FORM=S1 - Contracte amanet,FORCEVALUES=CCCCNTRTYPE:2?BRANCH:'+INST.BRANCH+'?INSTTYPE:'+INST.INSTTYPE+'?TRDR:'+INST.TRDR+'?CCCPRSN:'+cePrsn+'?CCCPRSN1:'+cePrsn1+'?CCCPRSN2:'+cePrsn2+'?UTBL01:'+INST.UTBL01+'?CCCMTRGROUP:+'+INST.CCCMTRGROUP+'?CCCBRATE:'+INST.CCCBRATE+'?BOOL01:1?BOOL04:'+INST.BOOL04+'?CCCCOMSPEC:'+INST.CCCCOMSPEC+'?CCCAPR1:'+INST.CCCAPR1+'?CCCAPR:'+INST.CCCAPR+'?CCCINST:'+INST.CCCINST+'?CCCINSTS:'+INST.INST+'?CCCCNTRTYPE:2?UTBL04:3100?COMMENTS:]');
  } else {
    var myObj = X.CreateObj('INST;S1 - Contracte amanet');
    try {
	myObj.DBINSERT;
	var TblFin = myObj.FindTable('INST');
	TblFin.Edit;
	TblFin.BRANCH = INST.BRANCH;
	TblFin.INSTTYPE = INST.INSTTYPE;
	TblFin.TRDR = INST.TRDR;
	TblFin.CCCPRSN = cePrsn;
	TblFin.CCCPRSN1 = cePrsn1;
	TblFin.CCCPRSN2 = cePrsn2;
	TblFin.UTBL01 = INST.UTBL01;
	TblFin.CCCMTRGROUP=INST.CCCMTRGROUP;
  TblFin.CCCBRATE=INST.CCCBRATE;
  TblFin.BOOL01=1;
  TblFin.BOOL04=INST.BOOL04;
  TblFin.CCCCOMSPEC=INST.CCCCOMSPEC;
  TblFin.CCCAPR1=INST.CCCAPR1;
  TblFin.CCCAPR=INST.CCCAPR;
  TblFin.CCCINST=INST.CCCINST;
  debugger;
  TblFin.CCCINSTS=INST.INST;
  TblFin.CCCCNTRTYPE=2;
  TblFin.UTBL04=3100;

	var id = myObj.DBPOST;
	X.WARNING('New id is:' + id);
} catch (e) {
	X.WARNING("Error: " + myObj.GETLASTERROR + " - " + e.message);
}
finally {
	myObj.FREE;
}
  }
	//headerRO(1);
	//INST.SETREADONLY('UTBL01',0);
	}

	//if (cePrel!=0)
	else
	{
	// Repunere data finala contract
	INST.BLCKDATE = INST.WDATETO;
	X.EXCEPTION('Contractul nu poate fi prelungit!');
	}

}

function date_prelungire()
{
		// Codificare Act Aditional
		DsAA = X.GETSQLDATASET('select inst from inst where ccccntrtype=2 and cccinst='+INST.CCCINST,null);
		DsCC = X.GETSQLDATASET('select code from inst where inst='+INST.CCCINST,null);
		if (DsAA.RECORDCOUNT == 0)
		ceNum = 1;
		else
		ceNum = DsAA.RECORDCOUNT + 1;

		ceCod = DsCC.code;
		ceCod = ceCod.replace('C','A') + '/' + ceNum;
		INST.CODE = ceCod;


		/*ceData = X.FORMATDATE('yymmdd',INST.WDATEFROM);
		DsData = X.GETSQLDATASET("select dateadd(d,1,'"+ceData+"') as data",null);*/

		DsDif = X.GETSQLDATASET('select datediff(d,gdateto,GetDate()) as dif from inst where inst='+INST.CCCINSTS,null);

		if (DsDif.dif<0)
		DsData = X.GETSQLDATASET('select dateadd(d,1,min(finaldate)) as data from instlines where inst='+INST.CCCINSTS,null);
		else
		DsData = X.GETSQLDATASET('select dateadd(d,1,max(finaldate)) as data from instlines where inst='+INST.CCCINSTS,null);

		//DsData = X.GETSQLDATASET('select dateadd(d,1,blckdate) as data from inst where inst='+INST.CCCINSTS,null);
		ceData = DsData.data;
	//X.WARNING(ceData);
		INST.WDATEFROM = ceData;
		//X.WARNING('1'+INST.WDATEFROM);

		/*
		DsData = X.GETSQLDATASET('select dateadd(d,1,max(finaldate)) as data from instlines where inst='+INST.CCCINST,null);
		//ceData = X.FORMATDATE('yymmdd',INST.WDATEFROM);
		//DsData = X.GETSQLDATASET("select dateadd(d,1,'"+ceData+"') as data",null);
		ceData = DsData.data;
		INST.WDATEFROM = ceData;*/
		//X.WARNING('2'+INST.WDATEFROM);

		ceDurata = INST.UTBL01;
		//INST.UTBL01 = 30;
		INST.UTBL01 = ceDurata;

		//X.WARNING('3'+INST.WDATEFROM);


		INST.CCCCNTRTYPE=2;

		// Preluare date grid
		DsArt = X.GETSQLDATASET('select mtrl, qty, cccweight, cccgweight, cccqty, cccprice, cccaddprc, price, cccpaid, cccdesc, comments, ccceval from instlines where sodtype=51 and inst='+INST.CCCINSTS,null);
		DsSrv = X.GETSQLDATASET('select mtrl, qty, cccweight, cccgweight, cccpay from instlines where sodtype=52 and inst='+INST.CCCINSTS,null);
		if (DsArt.RECORDCOUNT > 0)
		{
				DsArt.FIRST;
				while (!DsArt.Eof)
				{
					ceRest = DsArt.price - DsArt.cccpaid;
					if (ceRest!=0)
					{
					INSTLINES.APPEND;
					INSTLINES.MTRL = DsArt.mtrl;
					INSTLINES.CCCGWEIGHT = DsArt.cccgweight;
					INSTLINES.CCCWEIGHT = DsArt.cccweight;
					INSTLINES.QTY = DsArt.qty;
					INSTLINES.CCCQTY = DsArt.cccqty;
					INSTLINES.CCCPRICE = DsArt.cccprice;
					//INSTLINES.CCCADDPRC = DsArt.cccaddprc;
					INSTLINES.PRICE = DsArt.price - DsArt.cccpaid;
					INSTLINES.CCCDESC = DsArt.cccdesc;
					INSTLINES.COMMENTS = DsArt.comments;
					INSTLINES.CCCEVAL = DsArt.ccceval;
					//INSTLINES.POST;
					}

					DsArt.NEXT;
				}
		}

		/*
		if (DsSrv.RECORDCOUNT > 0)
		{
				DsSrv.FIRST;
				while (!DsSrv.Eof)
				{
					SRVLINES.APPEND;
					SRVLINES.MTRL = DsSrv.mtrl;
					SRVLINES.QTY1 = DsSrv.qty;
					SRVLINES.PRICE = DsSrv.cccpay;
					SRVLINES.POST;

					DsSrv.NEXT;
				}
		}*/
}

function lichidare_contract()
{

	DsCond = X.GETSQLDATASET('select sum(isnull(price,0)-isnull(cccpaid,0)) as dif from instlines where inst='+vID,null);
	celichidez = DsCond.dif;
	//X.WARNING(celichidez);

	// Lichidare contract - Client: achitare integrala; returnare la client
	if (celichidez == 0)
	{
	//X.EXEC('button:Save');

	DsSeries = X.GETSQLDATASET('select top 1 cccseriesnlc, cccseriesnlc1 from cccacomm where branch='+X.SYS.BRANCH+' order by fromdate desc',null);
	if (INST.INSTTYPE==1000)
	ceSerie = DsSeries.cccseriesnlc;
	if (INST.INSTTYPE==2000)
	ceSerie = DsSeries.cccseriesnlc1;

	X.EXEC('XCMD:SALDOC[AUTOEXEC=2,FORM=S1 - Lichidare,FORCEVALUES=SERIES:'+ceSerie+'?TRDR:'+INST.TRDR+'?SALESMAN:'+INST.SALESMAN+'?BOOL01:1?INST:'+INST.INST+'?COMMENTS:]');
	}

	else
	{
	INST.BLCKDATE = INST.WDATETO;
	X.EXCEPTION('Contractul nu poate fi lichidat!');
	}

}

function lichidare_contract_partial()
{
	DsCond = X.GETSQLDATASET('select (isnull(price,0)-isnull(cccpaid,0)) as dif from instlines where inst='+vID+' and sodtype=51 group by instlines, price, cccpaid',null);
	if (DsCond.RECORDCOUNT>0)
	{
	ceLichidez = 0;
	DsCond.FIRST;
	while(!DsCond.Eof)
	{
		if (DsCond.dif == 0 && ceLichidez==0)
		{
		DsSeries = X.GETSQLDATASET('select top 1 cccseriesnlc, cccseriesnlc1 from cccacomm where branch='+X.SYS.BRANCH+' order by fromdate desc',null);

		if (INST.INSTTYPE==1000)
		ceSerie = DsSeries.cccseriesnlc;
		if (INST.INSTTYPE==2000)
		ceSerie = DsSeries.cccseriesnlc1;

		X.EXEC('XCMD:SALDOC[AUTOEXEC=2,FORM=S1 - Lichidare,FORCEVALUES=SERIES:'+ceSerie+'?TRDR:'+INST.TRDR+'?SALESMAN:'+INST.SALESMAN+'?BOOL01:1?INST:'+INST.INST+'?COMMENTS:]');
		ceLichidez+=1;
		}
	DsCond.NEXT;
	}
	}
}


function plata_imprumut()
{
		docID();
	  //X.EXEC('button:Save');

		if (INST.CCCINSTS > 0)
		DsImprumut = X.GETSQLDATASET('select findoc from findoc where sosource=1351 and fprms=9000 and inst='+INST.CCCINST,null);
		else
		DsImprumut = X.GETSQLDATASET('select findoc from findoc where sosource=1351 and fprms=9000 and inst='+vID,null);

		if (DsImprumut.RECORDCOUNT > 0)
		X.EXCEPTION('Imprumutul a fost deja acordat!');

		else
		{
		DsSeries = X.GETSQLDATASET('select top 1 cccseriesdp from cccacomm where branch='+X.SYS.BRANCH+' order by fromdate desc',null);
		ceSerie = DsSeries.cccseriesdp;

		X.EXEC('XCMD:RETAILDOC[AUTOEXEC=2,FORM=S1 - Amanet,FORCEVALUES=SERIES:'+ceSerie+'?TRDR:'+INST.TRDR+'?SALESMAN:'+INST.SALESMAN+'?BOOL01:1?INST:'+vID+'?COMMENTS:]');
		//X.EXEC('XCMD:RETAILDOC[AUTOEXEC=2,FORM=S1 - Amanet,FORCEVALUES=SERIES:'+ceSerie+'?TRDR:'+INST.TRDR+'?BOOL01:1?COMMENTS:]');


		if (INST.CCCINSTS > 0)
		DsImprumut = X.GETSQLDATASET('select findoc from findoc where sosource=1351 and fprms=9000 and inst='+INST.CCCINST,null);
		else
		DsImprumut = X.GETSQLDATASET('select findoc from findoc where sosource=1351 and fprms=9000 and inst='+vID,null);
		if (DsImprumut.RECORDCOUNT > 0)
		{
		//INST.UTBL04 = 1000;
		//X.EXEC('button:Save');
		X.RUNSQL('update inst set utbl04=1000 where inst='+vID,null);

		if (INST.BOOL04==1) // Autosave doar coditii speciale, pt. printare automata
		X.EXEC('button:Save');
		}
		else
		plata_imprumut();
		}
}

function distribuire_incasare()
{
	CCCVPAYSUM.NEXT;
	zileInit = cateZile;
	//zileInit = CCCVPAYSUM.DAYS;


	//X.WARNING('Pay='+CCCVPAYSUM.PAYAMNT+' Cnormal='+ceSumC+'; Cint='+ceSumCI+'; Cadm='+ceSumCA);
	//ceSum = 0;   // Suma totala incasare
	//ceSumI = 0;  // Suma imprumut de incasat
	//ceSumC = 0;  // Suma comision de incasat
	//ceSumCI = 0; // Suma comision intarziere
	//ceSumCA = 0; // Suma comision administare


	if (CCCVPAYSUM.PAYAMNT > ceSum)
	X.EXCEPTION('Suma depaseste valoarea de incasat!');

	if (CCCVPAYSUM.PAYAMNT < CCCVPAYSUM.SRVAMNT)
	X.EXCEPTION('Nu se accepta comision partial!');


	if (CCCVPAYSUM.PAYAMNT < 0 || CCCVPAYSUM.PAYAMNT==0 || CCCVPAYSUM.PAYAMNT == null || CCCVPAYSUM.PAYAMNT=='')
	X.EXCEPTION('Suma necorespunzatoare de incasat!');

	if (CCCVPAYSUM.PAYAMNT < ceSum || CCCVPAYSUM.PAYAMNT == ceSum)
	{
			ceSumCom = ceSumC + ceSumCI + ceSumCA;
			// Achitare comision integral la zi
			//if (CCCVPAYSUM.PAYAMNT > ceSumCom)
			if (CCCVPAYSUM.PAYAMNT > ceSumCom||CCCVPAYSUM.PAYAMNT == ceSumCom)
			{
			//X.WARNING(1);
			ceCalc = 0;
			/*
			ceDif = CCCVPAYSUM.PAYAMNT - ceSumCom;
			ceCalc = 0;
			k = Math.round((ceDif / ceSumI)*10000)/10000;*/
			CCCVPAYSUM.DAYS = zileInit;

			ceRep = 0;

			CCCVPAY.DISABLECONTROLS;
			try{

			CCCVPAY.FIRST;
			while(!CCCVPAY.Eof)
			{
			if (CCCVPAY.SODTYPE==51)
			{
					ceDif = Math.round((CCCVPAYSUM.PAYAMNT - ceSumCom - ceRep)*100)/100;

					if (CCCVPAY.SELECT==1)
					{
					if (ceDif > CCCVPAY.TOPAY || ceDif == CCCVPAY.TOPAY)
					CCCVPAY.PRICE = CCCVPAY.TOPAY;
					else
					CCCVPAY.PRICE = ceDif;

					ceRep+=CCCVPAY.PRICE;
					}

					else
					{
					k = Math.round((ceDif / (ceSumI - ceRep))*10000)/10000;
					//X.WARNING(k);
					//CCCVPAY.PRICE = Math.round(CCCVPAY.VALUE * k *100)/100;
					CCCVPAY.PRICE = Math.round(CCCVPAY.TOPAY * k *100)/100;
					}
			}


			if (CCCVPAY.SODTYPE==52)
			{
			DsCod = X.GETSQLDATASET('select code from mtrl where mtrl='+CCCVPAY.MTRL,null);
			if (DsCod.code == 'COM')
			CCCVPAY.CCCQTY = zileInit;
			CCCVPAY.VALUE = Math.round(CCCVPAY.CCCQTY * CCCVPAY.CCCPRICE * 100)/100;
			CCCVPAY.TOPAY = CCCVPAY.VALUE - CCCVPAY.PAID;
			CCCVPAY.PRICE = Math.round(CCCVPAY.CCCQTY * CCCVPAY.CCCPRICE * 100)/100 - CCCVPAY.PAID;
			}

			ceCalc = ceCalc + CCCVPAY.PRICE;

			CCCVPAY.NEXT;
			}

			}
			finally{CCCVPAY.ENABLECONTROLS;}

			// Redistribuire in functie de pozitie bifa imprumut incasat "integral"
			if (CCCVPAYSUM.PAYAMNT!=ceCalc && ceRep!=0)
			{
					ceCalc = 0;
			    ceAplic = 0;

					CCCVPAY.DISABLECONTROLS;
					try{

					CCCVPAY.FIRST;
					while(!CCCVPAY.Eof)
					{
						if ((CCCVPAY.SELECT==0||CCCVPAY.SELECT==null||CCCVPAY.SELECT=='')&&CCCVPAY.SODTYPE==51)
						{
						ceDif = CCCVPAYSUM.PAYAMNT - ceSumCom - ceRep;
						k = Math.round((ceDif / (ceSumI - ceRep))*10000)/10000;
						CCCVPAY.PRICE = Math.round(CCCVPAY.TOPAY * k *100)/100;

						}
						ceCalc = ceCalc + CCCVPAY.PRICE;
						CCCVPAY.NEXT;
					}

					}
					finally{CCCVPAY.ENABLECONTROLS;}
			}

			// Distribuire diferenta zecimale la calcul (0,01 lei)
			if (CCCVPAYSUM.PAYAMNT!=ceCalc)
			{
					ceAplic = 0;

					CCCVPAY.DISABLECONTROLS;
					try{

					CCCVPAY.FIRST;
					while(!CCCVPAY.Eof)
					{
						ceValR = Math.round((CCCVPAY.PRICE + CCCVPAYSUM.PAYAMNT - ceCalc)*100)/100;
						//if ((CCCVPAY.SELECT==0||CCCVPAY.SELECT==null||CCCVPAY.SELECT=='')&&CCCVPAY.SODTYPE==51&&ceAplic==0)
						if (ceValR<CCCVPAY.TOPAY&&CCCVPAY.SODTYPE==51&&ceAplic==0)
						{
						CCCVPAY.PRICE= Math.round(ceValR*100)/100;
						ceAplic+=1;
						}
						CCCVPAY.NEXT;
					}

					}
					finally{CCCVPAY.ENABLECONTROLS;}
			}


			}

			// Achitare comision partial
			if (CCCVPAYSUM.PAYAMNT < ceSumCI)
			X.EXCEPTION('Suma nu acopera comisionul de intarziere!');

			if (CCCVPAYSUM.PAYAMNT < ceSumCA)
			X.EXCEPTION('Suma nu acopera comisionul de administrare!');

			ceComIA = ceSumCI + ceSumCA
			if (CCCVPAYSUM.PAYAMNT < ceComIA)
			X.EXCEPTION('Suma nu acopera comisionul de administrare si de intarziere!');

			//comZi = Math.round(ceSumC*100/CCCVPAYSUM.DAYS)/100;
			comZi = Math.round(ceSumC*100/zileInit)/100;
			if (CCCVPAYSUM.PAYAMNT < comZi)
			X.EXCEPTION('Suma nu acopera comisionul zilnic!');

			comMin = comZi + ceSumCI + ceSumCA;
			if (CCCVPAYSUM.PAYAMNT < comMin)
			X.EXCEPTION('Suma nu acopera comisionul minim!');



			if (CCCVPAYSUM.PAYAMNT < ceSumCom)
			{
			//X.WARNING(2);

			ceComIA = ceSumCI + ceSumCA;
			CCCVPAYSUM.DAYS = zileInit;
			ceDif = CCCVPAYSUM.PAYAMNT - ceComIA;
			cateDays = Math.floor((ceDif * CCCVPAYSUM.DAYS)/ceSumC);
			cePayAmnt = Math.round(((cateDays * ceSumC)/CCCVPAYSUM.DAYS + ceComIA)*100)/100;



			if (CCCVPAYSUM.PAYAMNT != cePayAmnt)
			{
			CCCVPAYSUM.PAYAMNT = cePayAmnt;
			CCCVPAYSUM.DAYS = cateDays;
			}

			//k = Math.round((cePayAmnt / ceSumC)*10000)/10000;
			CCCVPAY.DISABLECONTROLS;
			try{

			ceDistrib = 0;

			CCCVPAY.FIRST;
			while(!CCCVPAY.Eof)
			{
			if (CCCVPAY.SODTYPE==51)
			{
	    CCCVPAY.PRICE = 0;
			}
			if (CCCVPAY.SODTYPE==52)
			{
			DsCateg = X.GETSQLDATASET('select mtrcategory from mtrl where mtrl='+CCCVPAY.MTRL,null);
	    //CCCVPAY.PRICE = Math.round(CCCVPAY.VALUE * k *100)/100;
			DsCod = X.GETSQLDATASET('select code, name from mtrl where mtrl='+CCCVPAY.MTRL,null);

			if (DsCod.code == 'COM')
			CCCVPAY.CCCQTY = cateDays;

			if (DsCateg.mtrcategory==101&&CCCVPAY.CCCQTY!=0) // Discounturi - nu se acorda la comision partial
			{
			X.EXCEPTION('Comision partial, nu se acorda discounturi! ----> In lucru.....');
			/*
			var ans;
			ans = X.ASK('Comision partial','Nu se acorda '+DsCod.name+'! Continuati?');
			if (ans==6)
			{
			//X.WARNING('Comision partial, nu se acorda discounturi!');
			CCCVPAY.CCCQTY = 0;
			CCCVPAY.CCCPRICE = 0;
			ceDistrib+=1;
			}*/
			CCCVPAY.CCCQTY = 0;
			CCCVPAY.CCCPRICE = 0;
			ceDistrib+=1;
			}

			CCCVPAY.VALUE = Math.round(CCCVPAY.CCCQTY * CCCVPAY.CCCPRICE * 100)/100;
			CCCVPAY.TOPAY = CCCVPAY.VALUE - CCCVPAY.PAID;
			CCCVPAY.PRICE = Math.round(CCCVPAY.CCCQTY * CCCVPAY.CCCPRICE * 100)/100 - CCCVPAY.PAID ;
			}

			CCCVPAY.NEXT;
			}

			if (ceDistrib>0)  // Recalculare distribuire dupa eliminare discounturi
			{
			X.WARNING('Comision partial, nu se acorda discounturi!');
			X.CLOSESUBFORM('SFCCCVPAY');

			INSTLINESS.FIRST;
				while (!INSTLINESS.Eof)
				{
				DsCateg = X.GETSQLDATASET('select mtrcategory from mtrl where mtrl='+INSTLINESS.MTRL,null);


				if (DsCateg.mtrcategory==101) // Discounturi
				{
				INSTLINESS.DELETE;
				INSTLINESS.PRIOR;
				}
				INSTLINESS.NEXT;
				}

			//distribuire_incasare();
			X.OPENSUBFORM('SFCCCVPAY');
			}

			}
			finally{CCCVPAY.ENABLECONTROLS;}

			}
	}
}

function validare_use_promo()
{
	vdel=1;
		DsSrv = X.GETSQLDATASET('select top 1 prosrv from cccacomm where branch=1000 order by fromdate desc',null);

			//INSTLINES.FIRST;

			INSTLINESS.FIRST;
			while(!INSTLINESS.Eof)
			{
				if (INSTLINESS.MTRL == DsSrv.prosrv)
				INSTLINESS.DELETE;
				else
				INSTLINESS.NEXT;
			}

		// Aplicare doar la contracte cu durata normala
		DsTipDurata = X.GETSQLDATASET('select type from cccdurata where durata='+INST.UTBL01,null);
		if (DsTipDurata.type==2)
		aplicare_discount_promotii();

	vdel=0;
}

function aplicare_discount_promotii()
{
  calcul_promotii();

	if (DsPrjc.RECORDCOUNT > 0)
	{
	X.OPENSUBFORM('SFPROMO');
	}
	//else
	//X.WARNING('Nu exista promotii eligibile!');
}

function calcul_promotii()
{
	//X.EXEC('button:Save');
	//validare_use_promo();
	//docID();

	// Data contract: 1000
	ceDataCntr = X.FORMATDATE('yyyymmdd',INST.FROMDATE);
	ceDataCntr = String.fromCharCode(39)+ceDataCntr+String.fromCharCode(39);

	// Durata contract: 1020
	ceDurata = INST.UTBL01;

	// Valoare contract: 1030
	//DsValCntr = X.GETSQLDATASET('select sum(price) as val from instlines where inst='+vID,null);
	//ceValCntr = DsValCntr.val;
	ceValCntr = INST.CCCITESUM;

	// Nr. tot. contracte client: 1050
	if (INST.INST>0)
	i=1;
	else
	i=0;

	DsNrTotCntr = X.GETSQLDATASET('select count(inst)-'+i+' as nr from inst where trdr='+INST.TRDR+' and CCCCNTRTYPE in(1,3)',null);
	ceNrTotCntr = DsNrTotCntr.nr;

	// Val. tot. contracte client: 1060
	DsValTotCntr = X.GETSQLDATASET('select sum(il.price) as val from instlines il join inst i on i.inst=il.inst where i.trdr='+INST.TRDR+' and il.sodtype=51 and CCCCNTRTYPE in(1,3)',null);
	ceValTotCntr = DsValTotCntr.val;

	// Val. tot. comisioane incasate client: 1070
	DsCom = X.GETSQLDATASET('select sum(il.cccpaid) as val from instlines il join inst i on i.inst=il.inst where i.trdr='+INST.TRDR+' and il.sodtype=52',null);
	ceCom = DsCom.val;

	// Val. comision contract
	//DsComCntr = X.GETSQLDATASET('select sum(il.price) as val from instlines il join inst i on i.inst=il.inst '+
	//' join mtrl m on m.mtrl=il.mtrl '+
	//' where i.trdr='+INST.TRDR+' and il.sodtype=52 and m.mtrcategory=106 and i.inst='+vID,null);
	//ceComCntr = DsComCntr.val;
	//ceComCntr = INST.CCCSRVSUM;
	valoare_comision_initial();

	// Data nasterii: 1090
	DsDataClient = X.GETSQLDATASET('select date02 from trdextra where trdr='+INST.TRDR,null);
	ceDataCl = DsDataClient.date02;
	ceDataCl = X.FORMATDATE('yyyymmdd',ceDataCl);
	ceDataCl = String.fromCharCode(39)+ceDataCl+String.fromCharCode(39);

	// Varsta: 1080
	//DsVarsta = X.GETSQLDATASET('select datediff(year,'+ceDataCl+',GetDate()) as varsta',null);
	DsVarsta = X.GETSQLDATASET('select (0+Convert(Char(8),GetDate(),112) - Convert(Char(8),'+ceDataCl+',112)) / 10000 as varsta',null);
	ceVarstaCl = DsVarsta.varsta;

	// Sex: 1100
	DsSexCl = X.GETSQLDATASET('select isnull(cccsextype,0) as sex from trdr where trdr='+INST.TRDR,null)
	ceSexCl = DsSexCl.sex;

	// Departament
	DsDep = X.GETSQLDATASET('select isnull(cccdepart,0) as depart from mtrgroup where mtrgroup='+INST.CCCMTRGROUP+' and company='+INST.COMPANY+' and sodtype=51',null);

	dep = DsDep.depart;


	lcString = 'select x.prjc,  x.nr_crit, count(x.prjc) as nr_elig, x.cccvoutype, x.cccdisc, x.value from '+
					'(select distinct pl.prjcstage, '+
					'(select count(prjcstage) from prjlines where prjc=p.prjc) as nr_crit, '+
					' p.prjc, p.cccvoutype, p.cccdisc, '+
					//'(select case when p.cccvoutype=1 then p.cccdisc else 0 end) as value, '+
					//'(select case when p.cccvoutype=2 then p.cccdisc else 0 end) as discprc, '+
					'(select case when p.cccvoutype=1 then round(p.cccdisc*'+ceComCntr+'/100,2) else p.cccdisc end) as value '+

					' from prjlines pl '+
					' join prjc p on p.prjc=pl.prjc '+
					' join cccaprjc ap on ap.prjc = p.prjc '+
					' join cccdepprjc dep on dep.prjc = p.prjc '+
					' join ccctypeprjc tp on tp.prjc= p.prjc '+
					' where p.prjcrm=1 and p.prjcategory=100 and p.isactive=1 '+
					' and ap.branch='+INST.BRANCH+' and ap.company='+X.SYS.COMPANY+
					' and tp.prjstate=(case when '+INST.CCCCNTRTYPE+'=1 then 100 else 110 end) '+
					' and dep.depart='+dep+

					// Data contract: 1000
					//' and '+ceDataCntr+' between pl.fromdate and pl.finaldate '+
					' and ('+ceDataCntr+' between (case when pl.prjcstage=1000 then p.fromdate else '+ceDataCntr+' end) '+
					' and (case when pl.prjcstage=1000 then isnull(p.finaldate,'+ceDataCntr+') else '+ceDataCntr+' end)) '+

					// Durata contract: 1020
					' and ('+ceDurata+'>=(case when pl.prjcstage=1020 then isnull(pl.num01,0) else 0 end) '+
					' and '+ceDurata+'<=(case when pl.prjcstage=1020 then isnull(pl.num02,'+ceDurata+') else '+ceDurata+' end))' +

					// Valoare contract: 1030
					' and ('+ceValCntr+'>=(case when pl.prjcstage=1030 then isnull(pl.num01,0) else 0 end) '+
					' and '+ceValCntr+'<=(case when pl.prjcstage=1030 then isnull(pl.num02,'+ceValCntr+') else '+ceValCntr+' end))' +

					// Nr. tot. contracte: 1050
					' and ('+ceNrTotCntr+'>=(case when pl.prjcstage=1050 then isnull(pl.num01,0) else 0 end) '+
					' and '+ceNrTotCntr+'<=(case when pl.prjcstage=1050 then isnull(pl.num02,'+ceNrTotCntr+') else '+ceNrTotCntr+' end))' +

					// Val. tot. contracte: 1060
					' and ('+ceValTotCntr+'>=(case when pl.prjcstage=1060 then isnull(pl.num01,0) else 0 end) '+
					' and '+ceValTotCntr+'<=(case when pl.prjcstage=1060 then isnull(pl.num02,'+ceValTotCntr+') else '+ceValTotCntr+' end))';

					// Val. tot. comisioane incasate client: 1070
					' and ('+ceCom+'>=(case when pl.prjcstage=1070 then isnull(pl.num01,0) else 0 end) '+
					' and '+ceCom+'<=(case when pl.prjcstage=1070 then isnull(pl.num02,'+ceCom+') else '+ceCom+' end))';

					// Varsta: 1080
					lcString = lcString +
					' and ('+ceVarstaCl+'>=(case when pl.prjcstage=1080 then isnull(pl.num01,0) else 0 end) '+
					' and '+ceVarstaCl+'<=(case when pl.prjcstage=1080 then isnull(pl.num02,'+ceVarstaCl+') else '+ceVarstaCl+' end) and Year('+ceDataCntr+')>1900)';

					// Data nasterii: 1090
					lcString = lcString +
					' and (Month('+ceDataCntr+')=(case when pl.prjcstage=1090 then Month('+ceDataCl+') else Month('+ceDataCntr+') end)'+
					' and Day('+ceDataCntr+')=(case when pl.prjcstage=1090 then Day('+ceDataCl+') else Day('+ceDataCntr+') end) and Year('+ceDataCntr+')>1900)';

					// Sex: 1100
					lcString = lcString +
					' and '+ceSexCl+'=(case when pl.prjcstage=1100 then isnull(pl.num01,0) else '+ceSexCl+' end)) x ';

					lcString = lcString +
					//' group by p.prjc, p.cccvoutype, p.cccdisc order by value desc';
					'group by x.prjc, x.nr_crit, x.cccvoutype, x.cccdisc, x.value '+
					'having x.nr_crit=count(x.prjc) '+
					'order by value desc';

	DsPrjc = X.GETSQLDATASET(lcString,null);
}

function calc_points()
{
docID();
DsCalc = X.GETSQLDATASET('select isnull(tb.opoints,0)+sum(isnull(f.cardpoints,0)-isnull(f.negcardpoints,0)) as points, tb.trdr '+
		'from trdrbonuscard tb '+
		'left join findoc f on tb.trdr=f.trdr and tb.bonuscard=f.bonuscard '+
		'where tb.trdr='+INST.TRDR+' and tb.bonuscard='+INST.CCCBONUSCARD+
		' group by tb.trdr, tb.bonuscard, tb.opoints',null);

X.RUNSQL('update trdrbonuscard set points='+DsCalc.points+' where bonuscard='+INST.CCCBONUSCARD+' and trdr='+INST.TRDR,null);
//catePCard=DsCalc.points;
//return(catePCard);

}

function card_points()
{
	if (INST.CCCBONUSCARD>0)
	{
	DsPoints = X.GETSQLDATASET('select points from trdrbonuscard where bonuscard='+INST.CCCBONUSCARD+' and trdr='+INST.TRDR,null);
	catePCard=DsPoints.points;
	return(catePCard);
	}
}


function validare_use_points()
{
	vdel=1;
		DsSrv = X.GETSQLDATASET('select top 1 cardsrv from cccacomm where branch=1000  order by fromdate desc',null);
		INSTLINESS.FIRST;
		while(!INSTLINESS.Eof)
		{
			if (INSTLINESS.MTRL == DsSrv.cardsrv)
				INSTLINESS.DELETE;
				else
				INSTLINESS.NEXT;
		}

		if (INST.CCCCARDUSE==1)
		aplicare_discount_card();

	vdel=0;
}

function add_points()
{
	DsAddRate = X.GETSQLDATASET('select value from cardcategory where cardcategory=100',null);
	ceRata = DsAddRate.value;
	catePuncte = Math.round(INST.CCCSRVSUM * ceRata)/100;
	//INST.CARDPOINTS = catePuncte;

	docID();
	X.RUNSQL('update inst set ccccardpoints='+catePuncte+' where inst='+vID,null);
}

function aplicare_card_fidelitate()
{
// Aplicare card fidelitate
		DsCard = X.GETSQLDATASET('select top 1 t.trdr, b.bonuscard from trdrbonuscard t join bonuscard b on t.bonuscard=b.bonuscard '+
						'where t.trdr='+INST.TRDR+' and isactive=1 order by b.fromdate desc',null);
		if (DsCard.bonuscard>0)
		INST.CCCBONUSCARD = DsCard.bonuscard;
}

function aplicare_discount_card()
{
	DsUseRate = X.GETSQLDATASET('select points from cardcategory where cardcategory=100',null);
	ceRata = DsUseRate.points;

	// Total puncte card
	ceVal = Math.round(INST.CCCBONUSPOINTS * 100 * ceRata)/100;
	catePct = INST.CCCBONUSPOINTS;

	// Max puncte utilizare conform valoare de incasat comison
	if (INST.CCCSRVSUM < ceVal)
	{
	ceVal = INST.CCCSRVSUM;
	maxUsePoints = Math.round(ceVal*100/ceRata)/100;
	catePct = maxUsePoints;
	}

	X.OPENSUBFORM('SFCARDUSE');
	/*usePoints = 0;
	usePoints = X.INPUTQUERY('Card fidelitate','Utilizare puncte: ', catePct,0);
	if (usePoints>0||usePoints!='')
	{
	if (usePoints > catePct)
	INST.CCCNEGCARDPOINTS = catePct;
	else
	INST.CCCNEGCARDPOINTS = usePoints;
	}

	ceVal = Math.round(INST.CCCNEGCARDPOINTS * 100 * ceRata)/100;

	//usePoints = INST.CCCNEGCARDPOINTS;
	//ceVal = Math.round(usePoints * 100 * ceRata)/100;

	 if (ceVal>0)
	 {
	 DsSrv = X.GETSQLDATASET('select top 1 cardsrv from cccacomm where branch=1000 order by fromdate desc',null);
	 INSTLINESS.APPEND;
	 INSTLINESS.MTRL = DsSrv.cardsrv;
	 //INSTLINESS.QTY1 = -1;
	 //INSTLINESS.PRICE = ceVal;
	 //INSTLINESS.POST;
	 INSTLINESS.FROMDATE = INST.WDATEFROM;
	 if (INST.BLCKDATE>0)
	 INSTLINESS.FINALDATE = INST.BLCKDATE;
	 else
	 INSTLINESS.FINALDATE = INST.WDATETO;
	 }*/
}

function ON_SFCARDUSE_SHOW()
{
		INST.SETREADONLY('CCCVALPOINTS',0);

		ceValMax = 0;
		DsUseRate = X.GETSQLDATASET('select points from cardcategory where cardcategory=100',null);
		ceRata = DsUseRate.points;

		ceValMax = Math.round(INST.CCCBONUSPOINTS * ceRata * 100)/100;

		if (INST.CCCSRVSUM<ceValMax)
		{
		ceValMax = INST.CCCSRVSUM;
		}

		INST.CCCVALPOINTS = ceValMax;

		//if (SALDOC.CCCVALPOINTS<0)
		//SALDOC.CCCVALPOINTS = 0;
}

function ON_SFCARDUSE_CANCEL()
{
		INST.SETREADONLY('CCCVALPOINTS',1);
}


function ON_SFCARDUSE_ACCEPT()
{
	if (ceValMax < INST.CCCVALPOINTS)
	{
	INST.CCCVALPOINTS = Math.round(ceValMax*100)/100;
	X.EXCEPTION('Valoarea maxima este: '+ceValMax);
	}

	if (INST.CCCVALPOINTS<0)
	{
	INST.CCCVALPOINTS = Math.round(ceValMax*100)/100;
	X.EXCEPTION('Valoare negativa nepermisa!');
	}

	INST.CCCVALPOINTS = Math.round(INST.CCCVALPOINTS *100)/100;

	//X.WARNING('valoare:'+useVal);
	//usePoints = Math.round(useVal * 100 / ceRata)/100;

	usePoints = Math.round(INST.CCCVALPOINTS * 100 / ceRata)/100;

	if (usePoints<0) {}
	else
	{
	//if (usePoints > catePct)
	//SALDOC.NEGCARDPOINTS = catePct;
	//else
	INST.CCCNEGCARDPOINTS = usePoints;
	}


	//ceVal = Math.round(SALDOC.NEGCARDPOINTS * 100 * ceRata)/100;
	ceVal = INST.CCCVALPOINTS;

	 if (ceVal>0)
	 {
	 DsSrv = X.GETSQLDATASET('select top 1 cardsrv from cccacomm where branch=1000 order by fromdate desc',null);
	 INSTLINESS.APPEND;
	 INSTLINESS.MTRL = DsSrv.cardsrv;
	 INSTLINESS.FROMDATE = INST.WDATEFROM;
	 if (INST.BLCKDATE>0)
	 INSTLINESS.FINALDATE = INST.BLCKDATE;
	 else
	 INSTLINESS.FINALDATE = INST.WDATETO;
	 }

	 INST.SETREADONLY('CCCVALPOINTS',1);
}

function aplicare_discount_voucher()
{
	 //validare_use_voucher();
	 valoare_comision_initial();

	 DsSrv = X.GETSQLDATASET('select top 1 vousrv from cccacomm where branch=1000 order by fromdate desc',null);
	// DsVoucher = X.GETSQLDATASET('select voucherval from voucher where voucher='+INST.CCCVOUCHER,null);

	 DsVoucher = X.GETSQLDATASET('select case when cccvoutype=1 then round(voucherval*'+ceComCntr+'/100,2) else voucherval end as value from voucher where voucher='+INST.CCCVOUCHER,null);

	 ceVal = DsVoucher.value;
	 if (INST.CCCSRVSUM < ceVal)
	 ceVal = INST.CCCSRVSUM;

	 if (ceVal>0)
	 {
	 INSTLINESS.APPEND;
	 INSTLINESS.MTRL = DsSrv.vousrv;
	 //INSTLINESS.CCCQTY = -1;
	 //INSTLINES.QTY1 = -1;
	 //INSTLINESS.CCCPRICE = ceVal;
	 //INSTLINESS.POST;

	 INSTLINESS.FROMDATE = INST.WDATEFROM;
	 if (INST.BLCKDATE>0)
	 INSTLINESS.FINALDATE = INST.BLCKDATE;
	 else
	 INSTLINESS.FINALDATE = INST.WDATETO;
	 }
}

function getGDPR()
{
		DsGDPR = X.GETSQLDATASET('select isnull(consent,0) as consent, noconsent from trdr where trdr='+INST.TRDR,null);
		X.RUNSQL('update inst set CCCCONSENT ='+DsGDPR.consent+', cccnoconsent='+String.fromCharCode(39)+DsGDPR.noconsent+String.fromCharCode(39)+' where inst='+vID,null);
}


function set_field_color()
{
		X.FIELDCOLOR('INSTLINES.PRICE',  	15119249);
		X.FIELDCOLOR('INSTLINESS.PRICE',  15119249);

		ceColor1 = 0;
		ceColor2 = 0;
		INSTLINES.FIRST;
		while(!INSTLINES.Eof)
		{
				if (INSTLINES.PRICE != INSTLINES.CCCPAID)
				ceColor1 = ceColor1 +1;

		INSTLINES.NEXT;
		}

		INSTLINESS.FIRST;
		while(!INSTLINESS.Eof)
				{
						if (INSTLINESS.PRICE != INSTLINESS.CCCPAID)
						ceColor2 = ceColor2 +1;

						INSTLINESS.NEXT;
				}


		if (ceColor1 == 0)
		X.FIELDCOLOR('INSTLINES.CCCPAID', 9497000);

		if (ceColor1 > 0)
		X.FIELDCOLOR('INSTLINES.CCCPAID', 8224255);

		if (ceColor2 == 0)
		X.FIELDCOLOR('INSTLINESS.CCCPAID', 9497000);

		if (ceColor2 > 0)
		X.FIELDCOLOR('INSTLINESS.CCCPAID', 8224255);
}

function set_field_editor()
{
	  /*if (INST.INST>0)
		X.SETFIELDEDITOR('INST.INSTTYPE','INSTTYPE');

		else
		{
		if (INST.CCCINSTS>0)
		X.SETFIELDEDITOR('INST.INSTTYPE','INSTTYPE(W[INSTTYPE=2000 OR INSTTYPE=2100])');
		else
		X.SETFIELDEDITOR('INST.INSTTYPE','INSTTYPE(W[INSTTYPE=1000 OR INSTTYPE=1100])');
		}*/
		/*
		if (INST.CCCINSTS>0)
		{
		X.SETFIELDEDITOR('INST.INSTTYPE','INSTTYPE');
		//X.SETFIELDEDITOR('INST.INSTTYPE','INSTTYPE(W[INSTTYPE=2000 OR INSTTYPE=2100])');
		}
		else
		X.SETFIELDEDITOR('INST.INSTTYPE','INSTTYPE(W[INSTTYPE=1000 OR INSTTYPE=1100])');*/
}

function dsRO(ds,RO)
{
	for (i = 0; i < ds.FIELDCOUNT - 1; i++)
			{
				ds.SETREADONLY(ds.FIELDNAME(i), RO);
			}
}

function statusRO()
{
		if (INST.UTBL04==''||INST.UTBL04==null)
		{
		dsRO(INST,0);
		headerRO(0);
		dsRO(INSTLINES,0);
		//dsRO(INSTLINESS,0);
		}

		if (INST.UTBL04==1100 || INST.UTBL04==1200)
		{
		headerRO_SP(0);
		dsRO(INSTLINES,0);
		}

		if (INST.UTBL04>1200 || INST.UTBL04==1000)
		{
		headerRO(1);
		gridRO(INSTLINES,1);

		if (INST.INST<0)
		{
		INST.SETREADONLY('UTBL01',0);
		//INST.SETREADONLY('NAME',0);
		INST.SETREADONLY('CCCPRSN',0);
		}
		}
}

function headerRO(RO)
{
	//INST.SETREADONLY('NAME',RO);
	INST.SETREADONLY('TRDR',RO);
	INST.SETREADONLY('INSTTYPE',RO);
	INST.SETREADONLY('UTBL01',RO);   // Durata contract
	//INST.SETREADONLY('WDATEFROM',RO);
	//INST.SETREADONLY('WDATETO',RO);
	//INST.SETREADONLY('GDATEFROM',RO);
	//INST.SETREADONLY('GDATETO',RO);
	INST.SETREADONLY('CCCMTRGROUP',RO);
	INST.SETREADONLY('SALESMAN',RO);
	//INST.SETREADONLY('BOOL03',RO);
	INST.SETREADONLY('CCCPRSN',RO);
	INST.SETREADONLY('CCCCOMSPEC',RO); // Comision special
	INST.SETREADONLY('BOOL04',RO);   	// Conditii speciale
	INST.SETREADONLY('CCCAPR1',RO);  // operare speciala
	INST.SETREADONLY('CCCAPR',RO);  // Aprobare speciala
	INST.SETREADONLY('CCCCNTRTYPE',RO);  // Tip Act
}

function headerRO_SP(RO)
{
	INST.SETREADONLY('CCCCOMSPEC',RO); // Comision special
	INST.SETREADONLY('BOOL04',RO);   	// Conditii speciale
	INST.SETREADONLY('CCCAPR1',RO);  // operare speciala
	INST.SETREADONLY('CCCAPR',RO);  // Aprobare speciala
}

function gridRO(ds,RO)
{
	ds.SETREADONLY('MTRL',RO);
	ds.SETREADONLY('CCCGWEIGHT',RO);
	ds.SETREADONLY('CCCWEIGHT',RO);
	ds.SETREADONLY('CCCDESC',RO);
	//ds.SETREADONLY('CCCQTY',RO);
	ds.SETREADONLY('CCCPRICE',RO);
	//ds.SETREADONLY('QTY',RO);
	//ds.SETREADONLY('CCCDISCPRC',RO);
	//ds.SETREADONLY('CCCADDPRC',RO);
	ds.SETREADONLY('PRICE',RO);
}

function cardRO(RO)
{
	INST.SETREADONLY('CCCNEGCARDPOINTS',RO);
}

function interogare_SMS()
{
		if (INST.BOOL03=='')
		{
		// Aplicare doar la contracte cu durata normala
		DsTipDurata = X.GETSQLDATASET('select type from cccdurata where durata='+INST.UTBL01,null);
		if (DsTipDurata.type==2)
		{
		/*var ans;
		ans = X.ASK('Alerta SMS','Doriti sa primiti o alerta SMS cu o zi inainte de expirarea contractului?');
		if (ans==6)
		INST.BOOL03=1;
		else
		INST.BOOL03=0;*/

		// Nou: aplicare taxa SMS obligatoriu
		INST.BOOL03=1;
		}
		}
}

function validare_perioada()
{
		ceData1 = X.FORMATDATE('yymmdd',INST.WDATEFROM);
		ceData2 = X.FORMATDATE('yymmdd',INST.WDATETO);
		DsDataDif = X.GETSQLDATASET("select datediff(d,'"+ceData1+"','"+ceData2+"')+1 as zile",null);

		if (INST.UTBL01!=DsDataDif.zile)
		X.EXCEPTION('Durata contractului nu corespunde cu perioada contractuala!')
}

function conditiiPrint()
{
		printform = 0;
		printform2 = 0;
		docID();

		// Contracte noi / import
		if (INST.CCCCNTRTYPE==1||INST.CCCCNTRTYPE==3)
		{
		//Bijuterii
		if (INST.INSTTYPE==1000)
		printform=11;

		//Obiecte
		if (INST.INSTTYPE==2000)
		printform=12;
		}


		// Prelungiri
		if (INST.CCCCNTRTYPE==2)
		{
		rpr=0;
		lch=0;

		DsRPR = X.GETSQLDATASET('select io.cccrpr from inst io '+
														' join inst i on io.inst=i.cccinsts '+
														' where isnull(io.cccrpr,0)=1 and i.inst='+vID,null);
		if (DsRPR.RECORDCOUNT>0)
		rpr=1;

		DsLCH = X.GETSQLDATASET(' select f.findoc from findoc f '+
														' join inst io on io.inst=f.inst '+
														' join inst i on io.inst=i.cccinsts '+
														' where f.sosource=1351 and f.fprms in (2000,2100) '+
														' and i.inst='+vID,null);
		if (DsLCH.RECORDCOUNT>0)
		lch=1;

		// Prelungire Bijuterii
		if (INST.INSTTYPE==1000)
		{
			if (rpr==0 && lch==0)
			printform=21;
			if (rpr==0 && lch==1)
			{
			printform=23;
			printform2=40;
			}
			if (rpr==1 && lch==0)
			printform=25;
			if (rpr==1 && lch==1)
			printform=27;
		}

		// Prelungire Obiecte
		if (INST.INSTTYPE==2000)
		{
			if (rpr==0 && lch==0)
			printform=22;
			if (rpr==0 && lch==1)
			{
			printform=24;
			printform2=40;
			}
			if (rpr==1 && lch==0)
			printform=26;
			if (rpr==1 && lch==1)
			printform=28;
		}
		}


		// Lichidare
		DsStatus = X.GETSQLDATASET('select utbl04 from inst where inst='+vID,null);
		if (DsStatus.utbl04==4000)
		{

		rpr=0;

		DsRPR = X.GETSQLDATASET('select cccrpr from inst where isnull(cccrpr,0)=1 and inst='+vID,null);
		if (DsRPR.RECORDCOUNT>0)
		rpr=1;

		if (rpr==1)
		printform=29;

		if (rpr==0)
		printform=30;

		}


		if (printform==0)
		X.EXCEPTION('Utilizati tiparire manuala!');
		else
		var check =  printMe(printform,printform2);

		if (check.succes) {
			X.RUNSQL('update inst set cccprint=1, cccprintform='+printform+' where inst='+vID,null);
		} else {
			//X.WARNING('Tiparire nereusita.');
		}
}

function printMe(printform, printform2)
{
		var iCopies = "";
		iCopies = X.INPUTQUERY('Tiparire contract', 'Numar copii: ', 2, 0);

		docID();
		var ret = {}, print=0;
		ObjCntr = X.CreateObj('INST');

		try{
		ObjCntr.DBLocate(vID);
		var i = 1;
		while (i <= iCopies) {
				ObjCntr.PRINTFORM(printform, 'S1Printer', '');
				print++;
				i++;
			}

			if (printform2>0)
			ObjCntr.PRINTFORM(printform2, 'S1Printer', '');

			if (print>0)
			ret.succes = true;

		}	catch (e) {
		ret.succes = false;
		}
		finally {
		ObjCntr.FREE;
		ObjCntr = null;
	}

	return ret;
}

function saveMe(printform) {
	//tiparire
	docID();

	inst = String(vID);
	DsCode = X.GETSQLDATASET('select code from inst where inst='+vID,null);
	filename= String(DsCode.code);
	var ret = {},
	path = folderPath + filename,
	ObjSaldoc = X.CreateObj('INST'),
	f1 = path + '.PDF';
	try {
		//X.WARNING(path);
		//X.WARNING(f1);
		ObjSaldoc.DBLocate(vID);
		ObjSaldoc.PRINTFORM(printform, 'PDF file', f1);   // Salvare fisier

		ret.succes = true;
		ret.f1 = f1;
		//ret.f2 = f2;
		//X.RUNSQL('update inst set cccprint=1 where inst='+vID,null);
	} catch (e) {
		//X.WARNING(e.message + '\nAsigurati-va ca exista urmatoarea cale pe disk: ' + folderPath); // Salvare fisier
		ret.succes = false;
		ret.f1 = null;
	}
	finally {
		ObjSaldoc.FREE;
		ObjSaldoc = null;
	}

	return ret;
}

function comm1(mod) {
	//debugger;
	if (!tipInst) {
		xx();
	}
	if (!getEmail()) {
		return;
	}

	var id = INST.INST > 0 ? INST.INST : X.NEWID;

	var ante = X.GETSQLDATASET('select TOP 1 isnull(INST, 0) INST, BASE64 from CCCPDFINST where isnull(INST, 0)=' + INST.INST +
			' ORDER BY FROMDATE DESC', null);

	if (ante.RECORDCOUNT) {
		if (mod == 0) {
			//a fost trimis anterior, foloseste butonul/trimite manual
			return;
		} else if (mod == 1) {
			//daca a mai fost salvat in db, trimite de acolo spre site
			sendJson(false, id, urlEmail, ante.BASE64);
			return;
		} else if (mod == 2) {
			//am info in tabel dar vreau sa o refac
			X.RUNSQL('delete from CCCPDFINST where INST=' + INST.INST, null);
		}
	}

	var t1 = new Date().getTime();
	var pdf = printToPDF('INST', id, tipInst);
	var t2 = new Date().getTime();
	var diff = t2-t1;
	countms += 'print pdf duration [ms]: '+diff+'\n';

	if (pdf) {
		t1 = new Date().getTime();
		var b64 = convBinTob64(pdf);
		t2 = new Date().getTime();
		diff = t2-t1;
		countms+='convert pdf to thin air duration [ms]: '+diff+'\n';

		//salveaza-le ultima versiune in db, pentru preluare pe web service apis

		var q = "INSERT INTO CCCPDFINST (INST, ORIG, BASE64, SENTDATE, FROMDATE) VALUES (" + id + "," +
			INST.CCCINST + ",'" + b64 + "','" + formatDate(new Date()) + "', '" + X.FORMATDATE('yyyymmdd', INST.FROMDATE) + "')";
		X.RUNSQL(q, null);
	}

	//trimte spre site
	sendJson(false, id, urlEmail, b64, pdf);
	X.WARNING(countms);
	countms = '';
}

function sendJson(dummy, inst, url, b64, pdf) {
	//debugger;
	try {
		var xmlhttp = new ActiveXObject("MSXML2.XMLHTTP.6.0");
		var dataToSend = dummy ? 'dummy' : composeJsonDocs(b64, inst);
		xmlhttp.open("POST", url, true);
		xmlhttp.setRequestHeader("Content-Type", "application/json");
		xmlhttp.onreadystatechange = function () {
			X.PROCESSMESSAGES;

			if (xmlhttp.readyState != 4)
				return;
			if (xmlhttp.status != 200 & xmlhttp.status != 304) {
				X.WARNING('HTTP error ' + xmlhttp.status);
			}

			X.PROCESSMESSAGES;

			if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
				if (!dummy) {
					X.PROCESSMESSAGES;
					callback(xmlhttp, arguments.length, pdf);
					X.PROCESSMESSAGES;
				} else {
					X.PROCESSMESSAGES;
					dummyCallback(xmlhttp);
					X.PROCESSMESSAGES;
				}
			}
		}

		var t1 = new Date().getTime();

		xmlhttp.send(dataToSend);

		var t2 = new Date().getTime();
		var diff = t2-t1;
		var xxx = dummy ? 'send dummy b64 data online duration [ms]: '+diff+'\n' : 'send real b64 data online duration [ms]: '+diff+'\n';
		countms+=xxx;

	} catch (err) {
		X.WARNING(err.message);
	}
}

function dummyCallback(xmlhttp) {
	debugger;
	comm1(0);
}

function callback(xmlhttp, xx, file) {
	//X.WARNING(xmlhttp.responseText);
	X.PROCESSMESSAGES;
	try {
		if (xx > 4) {
			stergePDFs(file);
		}
	} catch (err) {}
}

function stergePDFs(file) {
	var fso;
	try {
		fso = new ActiveXObject("Scripting.FileSystemObject");
		fso.DeleteFile(file);
	} catch (err) {}
}

function getEmail() {
	return X.SQL("select isnull(email, '') email from trdr where trdr=" + INST.TRDR, null);
}

function composeJsonDocs(f64, inst) {
	//debugger;
	var subiect = '';
	if (tipInst == 21 || tipInst == 22) {
		subiect = 'aa_amanet';
	} else {
		subiect = 'contract_amanet';
	}
	var doc = X.SQL('select code from inst where inst='+inst, null);
	var cusEmail = getEmail();
	var unescapedStr = '{' +
		'"data_trimiterii":"' + formatDate(new Date()) + '",' +
		'"nr_contract":"' + INST.CCCINST_INST_CODE + '",' +
		'"nr_doc":"' + INST.CODE + '",' +
		'"agentie":"' + X.SQL('select name from branch where branch='+INST.BRANCH, null) + '",' +
		'"data_scadenta":"' + X.FORMATDATE('dd/mm/yyyy', INST.WDATETO) + '",' +
		'"data_docs":"' + X.FORMATDATE('dd/mm/yyyy', INST.FROMDATE) + '",' +
		'"TRDR":"' + INST.TRDR + '",' +
		'"name":"' + INST.TRDR_CUSTOMER_NAME + '",' +
		'"email":"' + cusEmail + '",' +
		//'"email":"marketing@creditamanet.ro",' +
		//'"email":"cosmin.ve@gmail.com",' +
		'"scope":"' + subiect + '",' +
		'"idDoc":"' + inst + '",' +
		'"docs":[' +
		'{' +
		'"name":"' + doc + '",' +
		'"base64":"' + f64 + '"' +
		'}' +
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

function pauseMs(millis) {
	var date = new Date();
	var curDate = null;

	do {
		curDate = new Date();
		X.PROCESSMESSAGES;
	} while (curDate - date < millis);
}

function printToPDF(modul, findoc, tipartitura) {
	//tiparire
	var ret = false,
	path = folderPath + findoc,
	oMod = X.CreateObj(modul),
	file = path + '-' + tipartitura + '.PDF';
	try {
		oMod.DBLocate(findoc);
		X.PROCESSMESSAGES;
		try {
			oMod.PRINTFORM(tipartitura, 'PDF file', file);
			ret =  file;
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

function convBinTob64(filePath) {
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

function xx() {
	tipInst = (function () {
		//contract bijuterii = 11
		//contract obiecte = 12
		//act ad bijuterii = 21
		//act ad obiecte = 22
		if (INST.CCCCNTRTYPE == 1) {
			//contract
			if (INST.INSTTYPE == 1000) {
				//bijuterii
				return 11;
			} else if (INST.INSTTYPE == 2000) {
				//obiecte
				return 12;
			}
		} else {
			//act ad
			if (INST.INSTTYPE == 1000) {
				//bijuterii
				return 21;
			} else if (INST.INSTTYPE == 2000) {
				//obiecte
				return 22;
			}
		}
	})();
}

/*
itsMe = false,
urlDummy='https://dev.creditamanet.ro/api/test',
urlEmail='https://dev.creditamanet.ro/api/sendDocsOnEmail',
countms = '',
tipInst;

function ON_AFTERPOST() {
	itsMe = true;
}

function ON_LOCATE() {
	xx();

	if (itsMe) {
		//comm1(0);
		//debugger;
		sendJson(true, 123, urlDummy);
		itsMe = false;
	}
}
*/
