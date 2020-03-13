/*
CREATE TABLE CCCPDFFACTURA(
CCCPDFFACTURA int identity(1,1) primary key,
IDFACTURA INT NOT NULL,
IDCOMANDA INT NOT NULL,
FACTURA64 VARCHAR(MAX),
GARANTIA64 VARCHAR(MAX),
SENTDATE DATETIME
)
 */

var folderPath = 'C:\\S1Print\\ftp\\',
urlMtrls = 'https://dev.creditamanet.ro/Backend_controller/ping_for_items_s1',
urlDocs = 'https://dev.creditamanet.ro/api/sendDocsOnEmail',
tipartituraFac = 510,
tipartituraGar = 301;

function docID() {
	if (SALDOC.FINDOC < 0)
		vID = X.NEWID;
	else
		vID = SALDOC.FINDOC;
	return vID;
}

function EXECCOMMAND(cmd) {
	if (cmd == '20200212') {
		X.PROCESSMESSAGES;
		comm1(false);
		X.PROCESSMESSAGES;
		X.SETPROPERTY('MERGECHANGELOG', 'True');
		X.PROCESSMESSAGES;
	}

	if (cmd == '20190329')
		X.EXEC('XCMD:CONVERTDLG,SOSOURCE:1351');

	if (cmd == '20190711') {
		SALDOC.CCCCARDUSE = 0;

		ceCodScan = X.INPUTQUERY('Scanare', 'Scanare Card ', '', 1);
		ceCodScan = String.fromCharCode(39) + ceCodScan + String.fromCharCode(39);
		DsCard = X.GETSQLDATASET('select bonuscard from bonuscard where code=' + ceCodScan, null);
		if (DsCard.RECORDCOUNT == 1) {
			SALDOC.bonuscard = DsCard.bonuscard;
			SALDOC.CCCCARDUSE = 1;
		} else {
			X.WARNING('Cardul nu este identificat!');

			VBUFSET.BONUSPOINTS = 0;

			SALDOC.SETREADONLY('CCCVALPOINTS', 0);
			SALDOC.CCCVALPOINTS = 0;
			SALDOC.SETREADONLY('CCCVALPOINTS', 1);

			SALDOC.NEGCARDPOINTS = 0;
			SALDOC.CCCCARDUSE = 0;
		}
	}

	// Aplicare voucher
	if (cmd == '201907111') {
		if (SALDOC.BOOL02 == 1)
			X.EXCEPTION('Modificare nepermisa, bon tiparit!');

		ceCodScan = X.INPUTQUERY('Scanare', 'Scanare Voucher ', '', 1);
		ceCodScan = String.fromCharCode(39) + ceCodScan + String.fromCharCode(39);
		DsVoucher = X.GETSQLDATASET('select voucher from voucher where VOUCHERSTATES=1 and code=' + ceCodScan, null);

		if (DsVoucher.RECORDCOUNT == 1)
			SALDOC.CCCVOUCHER = DsVoucher.voucher;
		else {
			X.WARNING('Voucherul nu a fost identificat!');
			validare_use_voucher();
			SALDOC.CCCVOUCHER = null;
		}
	}

	// Aplicare promotii
	if (cmd == '201907112') {
		if (SALDOC.BOOL02 == 1)
			X.EXCEPTION('Modificare nepermisa, bon tiparit!');

		aplicare_discount_promotii();
	}
}

function ON_INSERT() {
	SALDOC.SETREADONLY('CCCVALPOINTS', 1);
}

function ON_LOCATE() {
	SALDOC.SETREADONLY('CCCVALPOINTS', 1);
}

function ON_POST() {
	//validare_regim_tva();


	// Mutare in Submodul Retail la modificare in Cash
	if (SALDOC.FPRMS == 7000 && SALDOC.UFTBL01 == 100)
		SALDOC.SOREDIR = 10000;

	// Discounturi
	if (ITELINES.MTRL > 0) {
		SALDOC.DISC1VAL = 0;
		validare_use_disc();

		aplicare_discount_promotii();
		aplicare_discount_voucher();
		aplicare_discount_card();

		X.OPENSUBFORM('SFPAY');
	} else
		X.WARNING('Articole necompletate!');

	calcul_regim_special();
}

function ON_AFTERDELETE() {

	status_contracte();

	// Transmitere array articole pentru update stoc pe website
	if (SALDOC.FPRMS == 7000 || SALDOC.FPRMS == 7900) {
		var fin = SALDOC.FINDOC ? SALDOC.FINDOC : X.NEWID;
		sendJson(fin, urlMtrls, 1);
		X.PROCESSMESSAGES;
	}

}

function ON_SALDOC_UFTBL01() {
	// Scadenta 0 zile la mmodificare modalitate in Cash (cu mutare in submodul Retail)
	if (SALDOC.UFTBL01 == 100)
		SALDOC.PAYMENT = 0;
}

function ON_SALDOC_TRDR_VALIDATE() {
	if (SALDOC.CCCCARDUSE == 1)
		X.EXCEPTION('Modificare nepermisa, cardul a fost scanat!');
}

function ON_SALDOC_TRDR() {
	aplicare_card_fidelitate();
}

function ON_ITELINES_MTRL_VALIDATE() {
	if (SALDOC.SERIES > 0) {}
	else
		X.EXCEPTION('Selectati serie document!');
}

function ON_ITELINES_MTRL() {

	// Preluare cost
	calcul_cost();
	ITELINES.SALESCVAL = ceCost;

	// preluare adaos si TVA neexigibil
	DsNx = X.GETSQLDATASET('select cccadd, cccvat from mtrl where mtrl=' + ITELINES.MTRL, null);
	ITELINES.NUM03 = DsNx.cccadd;
	ITELINES.NUM04 = DsNx.cccvat;
}

function ON_ITELINES_QTY1() {
	// Preluare cost
	calcul_cost();
	ITELINES.SALESCVAL = ceCost * ITELINES.QTY1;

	// preluare adaos si TVA neexigibil
	DsNx = X.GETSQLDATASET('select cccadd, cccvat from mtrl where mtrl=' + ITELINES.MTRL, null);
	ITELINES.NUM03 = DsNx.cccadd;
	ITELINES.NUM04 = DsNx.cccvat;
}

function ON_ITELINES_POST() {
	/*DsTipVat = X.GETSQLDATASET('select cccshtype from vat where vat='+ITELINES.VAT,null);
	if (DsTipVat.cccshtype==1){
	DsVatPrc = X.GETSQLDATASET('select percnt from vat where vat=(select vats2 from vat where vat='+ITELINES.VAT+')',null);
	cePrc = DsVatPrc.percnt;
	ceMarja = Math.round((ITELINES.LTRNLINEVAL - ITELINES.SALESCVAL)*100)/100;
	ceVat = Math.round(ceMarja * cePrc)/100;

	ITELINES.PLSMVAL = ceMarja;
	ITELINES.PLSMVAT = ceVat;
	}*/
}

function ON_SFPROMO_SHOW() {
	CCCVPROMO.FIRST;
	while (!CCCVPROMO.Eof) {
		CCCVPROMO.DELETE;
	}

	DsPrjc.FIRST;
	while (!DsPrjc.Eof) {
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

function ON_SFPROMO_ACCEPT() {
	ceVal = CCCVPROMO.VALUE;

	if (SALDOC.SUMAMNT < ceVal)
		ceVal = SALDOC.SUMAMNT;

	if (ceVal > 0) {
		DsSrv = X.GETSQLDATASET('select top 1 prosrv from cccacomm where branch=1000  order by fromdate desc', null);
		SRVLINES.APPEND;
		SRVLINES.MTRL = DsSrv.prosrv;
		SRVLINES.QTY1 = 0;
		SRVLINES.PRICE = ceVal;
		SRVLINES.POST;
		SALDOC.DISC1VAL = SALDOC.DISC1VAL + ceVal;
		SALDOC.PRJC = CCCVPROMO.PRJC;
	}
}

function ON_SFCARDUSE_SHOW() {
	SALDOC.SETREADONLY('CCCVALPOINTS', 0);

	ceValMax = 0;
	DsUseRate = X.GETSQLDATASET('select points from cardcategory where cardcategory=200', null);
	ceRata = DsUseRate.points;

	ceValMax = Math.round(VBUFSET.BONUSPOINTS * ceRata * 100) / 100;

	if (SALDOC.SUMAMNT < ceValMax) {
		ceValMax = SALDOC.SUMAMNT;
	}

	SALDOC.CCCVALPOINTS = ceValMax;

	//if (SALDOC.CCCVALPOINTS<0)
	//SALDOC.CCCVALPOINTS = 0;
}

function ON_SFCARDUSE_CANCEL() {
	SALDOC.SETREADONLY('CCCVALPOINTS', 1);
}

function ON_SFCARDUSE_ACCEPT() {
	if (ceValMax < SALDOC.CCCVALPOINTS) {
		SALDOC.CCCVALPOINTS = Math.round(ceValMax * 100) / 100;
		X.EXCEPTION('Valoarea maxima este: ' + ceValMax);
	}

	if (SALDOC.CCCVALPOINTS < 0) {
		SALDOC.CCCVALPOINTS = Math.round(ceValMax * 100) / 100;
		X.EXCEPTION('Valoare negativa nepermisa!');
	}

	SALDOC.CCCVALPOINTS = Math.round(SALDOC.CCCVALPOINTS * 100) / 100;

	//X.WARNING('valoare:'+useVal);
	//usePoints = Math.round(useVal * 100 / ceRata)/100;

	usePoints = Math.round(SALDOC.CCCVALPOINTS * 100 / ceRata) / 100;

	if (usePoints < 0) {}
	else {
		//if (usePoints > catePct)
		//SALDOC.NEGCARDPOINTS = catePct;
		//else
		SALDOC.NEGCARDPOINTS = usePoints;
	}

	//ceVal = Math.round(SALDOC.NEGCARDPOINTS * 100 * ceRata)/100;
	ceVal = SALDOC.CCCVALPOINTS;

	if (ceVal > 0) {
		DsSrv = X.GETSQLDATASET('select top 1 cardsrv from cccacomm where branch=1000  order by fromdate desc', null);
		SRVLINES.APPEND;
		SRVLINES.MTRL = DsSrv.cardsrv;
		SRVLINES.QTY1 = 0;
		SRVLINES.PRICE = ceVal;
		SRVLINES.POST;
		SALDOC.DISC1VAL = SALDOC.DISC1VAL + ceVal;
	}

	SALDOC.SETREADONLY('CCCVALPOINTS', 1);
}

function ON_SALDOC_SUMAMNT() {

	/*validare_use_disc();
	aplicare_discount_card();
	aplicare_discount_voucher();
	aplicare_discount_promotii();*/

}

function ON_SALDOC_CCCVOUCHER() {
	if (SALDOC.CCCVOUCHER > 0)
		aplicare_discount_voucher();
}

function ON_SALDOC_BONUSCARD() {
	if (SALDOC.BONUSCARD > 0) {
		calc_points();
		card_points();
		//VBUFSET.BONUSPOINTS = catePCard;

		DsUseRate = X.GETSQLDATASET('select points from cardcategory where cardcategory=200', null);
		ceRata = DsUseRate.points;
		ceVal = Math.round(catePCard * 100 * ceRata) / 100;

		SALDOC.SETREADONLY('CCCVALPOINTS', 0);
		SALDOC.CCCVALPOINTS = ceVal;
		SALDOC.SETREADONLY('CCCVALPOINTS', 1);

		if (SALDOC.BONUSCARD > 0 && SALDOC.CCCCARDUSE == 1)
			aplicare_discount_card();
	}
}

function calc_points() {
	docID();
	DsCalc = X.GETSQLDATASET('select isnull(tb.opoints,0)+sum(isnull(f.cardpoints,0)-isnull(f.negcardpoints,0)) as points, tb.trdr ' +
			'from trdrbonuscard tb ' +
			'left join findoc f on tb.bonuscard=f.bonuscard ' +
			'where tb.trdr=' + SALDOC.TRDR + ' and tb.bonuscard=' + SALDOC.BONUSCARD +
			' and isnull(f.iscancel,0)=0 ' +
			' group by tb.trdr, tb.bonuscard, tb.opoints', null);

	X.RUNSQL('update trdrbonuscard set points=' + DsCalc.points + ' where bonuscard=' + SALDOC.BONUSCARD + ' and trdr=' + SALDOC.TRDR, null);
	//catePCard=DsCalc.points;
	//return(catePCard);
}

function card_points() {
	if (SALDOC.BONUSCARD > 0) {
		DsPoints = X.GETSQLDATASET('select points from trdrbonuscard where bonuscard=' + SALDOC.BONUSCARD + ' and trdr=' + SALDOC.TRDR, null);
		catePCard = DsPoints.points;
		return (catePCard);
	}
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
			//ceMarja = Math.round(ceMarja * 100 / (1 + cePrc / 100)) / 100;
			//ceVat = Math.round(ceMarja * cePrc) / 100;

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

function validare_regim_tva() {
	ceRN = 0;
	ceRS = 0; // Regim special secon-hand
	ITELINES.FIRST;
	while (!ITELINES.Eof) {
		DsTipVat = X.GETSQLDATASET('select cccshtype from vat where vat=' + ITELINES.VAT, null);
		if (DsTipVat.cccshtype == 1) {
			ceRS += 1;
		} else
			ceRN += 1;

		ITELINES.NEXT;
	}

	if (ceRS > 0) {
		SALDOC.VATSTS = 0;
		SALDOC.BGOTHRVAT = 21;
	}
	if (ceRS == 0) {
		SALDOC.VATSTS = 1;
		SALDOC.BGOTHRVAT = null;
	}

	if (ceRS > 0 && ceRN > 0)
		X.EXCEPTION('Exista articole cu regim special! Se factureaza separat!');
}

function validare_use_disc() {
	DsSrv = X.GETSQLDATASET('select top 1 cardsrv, vousrv, prosrv from cccacomm where branch=1000  order by fromdate desc', null);

	SRVLINES.FIRST;
	while (!SRVLINES.Eof) {
		if (SRVLINES.MTRL == DsSrv.cardsrv || SRVLINES.MTRL == DsSrv.vousrv || SRVLINES.MTRL == DsSrv.prosrv)
			SRVLINES.DELETE;
		else
			SRVLINES.NEXT;
	}
}

function validare_use_points() {
	DsSrv = X.GETSQLDATASET('select top 1 cardsrv from cccacomm where branch=1000  order by fromdate desc', null);

	SRVLINES.FIRST;
	while (!SRVLINES.Eof) {
		if (SRVLINES.MTRL == DsSrv.cardsrv) {
			SALDOC.DISC1VAL = SALDOC.DISC1VAL - SRVLINES.PRICE;
			//X.WARNING('Stergere card:' + SRVLINES.PRICE);
			SRVLINES.DELETE;
		} else
			SRVLINES.NEXT;
	}
	//SALDOC.DISC1VAL = 0;
}

function validare_use_voucher() {
	DsSrv = X.GETSQLDATASET('select top 1 vousrv from cccacomm where branch=1000  order by fromdate desc', null);

	SRVLINES.FIRST;
	while (!SRVLINES.Eof) {
		if (SRVLINES.MTRL == DsSrv.vousrv) {
			SALDOC.DISC1VAL = SALDOC.DISC1VAL - SRVLINES.PRICE;
			SRVLINES.DELETE;
		} else
			SRVLINES.NEXT;
	}

	//SALDOC.DISC1VAL = 0;
}

function validare_use_promo() {
	DsSrv = X.GETSQLDATASET('select top 1 prosrv from cccacomm where branch=1000 order by fromdate desc', null);

	SRVLINES.FIRST;
	while (!SRVLINES.Eof) {
		if (SRVLINES.MTRL == DsSrv.prosrv) {
			SALDOC.DISC1VAL = SALDOC.DISC1VAL - SRVLINES.PRICE;
			//X.WARNING('Stergere promo:' + SRVLINES.PRICE);
			SRVLINES.DELETE;
		} else
			SRVLINES.NEXT;
	}

	//SALDOC.DISC1VAL = 0;
}

function use_points() {
	validare_use_points();

	if (SALDOC.CCCCARDUSE == 1) {
		/*DsUseRate = X.GETSQLDATASET('select points from cardcategory where cardcategory=200',null);
		ceRata = DsUseRate.points;
		usePoints = SALDOC.NEGCARDPOINTS;
		ceVal = Math.round(usePoints * 100 * ceRata)/100;

		if (ceVal!=0)*/
		aplicare_discount_card();
	}
}

function aplicare_card_fidelitate() {
	// Aplicare card fidelitate
	DsCard = X.GETSQLDATASET('select top 1 t.trdr, b.bonuscard from trdrbonuscard t join bonuscard b on t.bonuscard=b.bonuscard ' +
			'where t.trdr=' + SALDOC.TRDR + ' and isactive=1 order by b.fromdate desc', null);
	if (DsCard.bonuscard > 0) {
		if (SALDOC.BONUSCARD != DsCard.bonuscard)
			SALDOC.BONUSCARD = DsCard.bonuscard;
	} else {
		SALDOC.BONUSCARD = null;
		SALDOC.CCCCARDUSE = 0;

		SALDOC.SETREADONLY('CCCVALPOINTS', 0);
		SALDOC.CCCVALPOINTS = null;
		SALDOC.SETREADONLY('CCCVALPOINTS', 1);
	}
}

function aplicare_discount_card() {
	validare_use_points();

	if (SALDOC.CCCCARDUSE == 1) {
		DsUseRate = X.GETSQLDATASET('select points from cardcategory where cardcategory=200', null);
		ceRata = DsUseRate.points;

		// Total puncte card
		ceVal = Math.round(VBUFSET.BONUSPOINTS * 100 * ceRata) / 100;
		catePct = VBUFSET.BONUSPOINTS;

		// Max puncte utilizare conform valoare de incasat comison
		if (SALDOC.SUMAMNT < ceVal) {
			ceVal = SALDOC.SUMAMNT;
			maxUsePoints = Math.round(ceVal * 100 / ceRata) / 100;
			catePct = maxUsePoints;
		}

		//DsUseRate = X.GETSQLDATASET('select points from cardcategory where cardcategory=200',null);
		//ceRata = DsUseRate.points;


		if (SALDOC.SUMAMNT > 0) {
			//usePoints = 0;
			//usePoints = X.INPUTQUERY('Card fidelitate','Utilizare puncte: ', catePct,0);
			////////useVal = X.INPUTQUERY('Card fidelitate','Utilizare valoare: ', ceVal,0);

			X.OPENSUBFORM('SFCARDUSE');

			//usePoints = usePoints.replace(/,/, '');
			//useVal = X.EVAL('LTrim(FString(' + useVal + ',12,2))');

			/*var virgula = useVal.indexOf(",");
			if (virgula==-1)
		{
			useVal = Math.round(parseFloat(useVal));
			}
			else
		{
			useVal = useVal.replace(/,/, '');
			X.WARNING('Replace:'+useVal);
			useVal = Math.round(parseFloat(useVal))/100;
			}*/

			//usePoints = parseFloat(usePoints);
			//useVal = Math.round(parseFloat(useVal))/100;

			/*
			X.WARNING('valoare:'+useVal);
			usePoints = Math.round(useVal * 100 / ceRata)/100;

			if (usePoints>0)
		{
			if (usePoints > catePct)
			SALDOC.NEGCARDPOINTS = catePct;
			else
			SALDOC.NEGCARDPOINTS = usePoints;
			}
			}

			//ceVal = Math.round(SALDOC.NEGCARDPOINTS * 100 * ceRata)/100;
			ceVal = useVal;

			if (ceVal>0)
		{
			DsSrv = X.GETSQLDATASET('select top 1 cardsrv from cccacomm where branch=1000  order by fromdate desc',null);
			SRVLINES.APPEND;
			SRVLINES.MTRL = DsSrv.cardsrv;
			SRVLINES.QTY1 = 0;
			SRVLINES.PRICE = ceVal;
			SRVLINES.POST;
			SALDOC.DISC1VAL=SALDOC.DISC1VAL+ceVal;
			}*/
		}
	}
}

function aplicare_discount_voucher() {
	validare_use_voucher();
	valoare_articole();

	DsSrv = X.GETSQLDATASET('select top 1 vousrv from cccacomm where branch=1000  order by fromdate desc', null);
	DsVoucher = X.GETSQLDATASET('select case when cccvoutype=1 then round(voucherval*' + ceValArt + '/100,2) else voucherval end as value from voucher where voucher=' + SALDOC.CCCVOUCHER, null);

	ceVal = DsVoucher.value;
	if (SALDOC.SUMAMNT < ceVal)
		ceVal = SALDOC.SUMAMNT;

	if (ceVal > 0) {
		SRVLINES.APPEND;
		SRVLINES.MTRL = DsSrv.vousrv;
		SRVLINES.QTY1 = 0;
		SRVLINES.PRICE = ceVal;
		SRVLINES.POST;
		SALDOC.DISC1VAL = SALDOC.DISC1VAL + ceVal;
	}
}

function aplicare_discount_promotii() {
	valoare_articole();
	calcul_promotii();

	if (DsPrjc.RECORDCOUNT > 0) {
		X.OPENSUBFORM('SFPROMO');
	}
	//else
	//X.WARNING('Nu exista promotii eligibile!');
}

function valoare_articole() {
	// Pt. aplicare discounturi procentuale promotii / vouchere
	ceValArt = 0;
	ITELINES.FIRST;
	while (!ITELINES.Eof) {
		ceValArt += ITELINES.LINEVAL;
		ITELINES.NEXT;
	}
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

function calcul_promotii() {
	validare_use_promo();

	// Data vanzare: 2000
	ceDataVz = X.FORMATDATE('yyyymmdd', SALDOC.TRNDATE);
	ceDataVz = String.fromCharCode(39) + ceDataVz + String.fromCharCode(39);

	// Valoare vanzare: 2030
	ceValVz = SALDOC.SUMAMNT;

	// Nr. tot. vanzari: 2050
	DsNrTotVz = X.GETSQLDATASET('select count(findoc) as nr from findoc where trdr=' + SALDOC.TRDR + ' and tfprms in(131,102,103)', null);
	ceNrTotVz = DsNrTotVz.nr;

	// Val. tot. vanzari: 2060
	DsValTotVz = X.GETSQLDATASET('select sum(ldebit) as val from trdbalsheet where trdr=' + SALDOC.TRDR + ' and fiscprd=' + X.SYS.FISCPRD, null);
	ceValTotVz = DsValTotVz.val;

	// Data nasterii: 2090
	DsDataClient = X.GETSQLDATASET('select date02 from trdextra where trdr=' + SALDOC.TRDR, null);
	ceDataCl = DsDataClient.date02;
	ceDataCl = X.FORMATDATE('yyyymmdd', ceDataCl);
	ceDataCl = String.fromCharCode(39) + ceDataCl + String.fromCharCode(39);
	//ceZiCl = X.FORMATDATE('mmdd',ceDataCl);
	//ceZiCl = String.fromCharCode(39)+ceDataCl+String.fromCharCode(39);
	//ceZiVz = X.FORMATDATE('mmdd',SALDOC.TRNDATE);
	//ceZiVz = String.fromCharCode(39)+ceZiVz+String.fromCharCode(39);

	// Varsta: 2080
	DsVarsta = X.GETSQLDATASET('select datediff(year,' + ceDataCl + ',GetDate()) as varsta', null);
	ceVarstaCl = DsVarsta.varsta;

	// Sex: 2100
	DsSexCl = X.GETSQLDATASET('select isnull(cccsextype,0) as sex from trdr where trdr=' + SALDOC.TRDR, null)
		ceSexCl = DsSexCl.sex;

	lcString = 'select x.prjc,  x.nr_crit, count(x.prjc) as nr_elig, x.cccvoutype, x.cccdisc, x.value from ' +
		'(select pl.prjcstage, ' +
		'(select count(prjcstage) from prjlines where prjc=p.prjc) as nr_crit, ' +
		' p.prjc, p.cccvoutype, p.cccdisc, ' +
		'(select case when p.cccvoutype=1 then round(p.cccdisc*' + ceValArt + '/100,2) else p.cccdisc end) as value ' +
		' from prjlines pl ' +
		' join prjc p on p.prjc=pl.prjc ' +
		' join cccaprjc ap on ap.prjc = p.prjc ' +
		' join ccctypeprjc tp on tp.prjc= p.prjc ' +
		' where p.prjcrm=1 and p.prjcategory=200 and p.isactive=1 ' +
		' and ap.branch=' + X.SYS.BRANCH + ' and ap.company=' + X.SYS.COMPANY +
		' and tp.prjstate=200 ' +

		// Data vanzare: 2000
		//' and '+ceDataVz+' between p.fromdate and p.finaldate '+
		' and (' + ceDataVz + ' between (case when pl.prjcstage=2000 then p.fromdate else ' + ceDataVz + ' end) ' +
		' and (case when pl.prjcstage=2000 then isnull(p.finaldate,' + ceDataVz + ') else ' + ceDataVz + ' end)) ' +

		// Valoare vanzare: 2030
		' and (' + ceValVz + '>=(case when pl.prjcstage=2030 then pl.num01 else 0 end) ' +
		' and ' + ceValVz + '<=(case when pl.prjcstage=2030 then isnull(pl.num02,' + ceValVz + ') else ' + ceValVz + ' end))' +

		// Nr. tot. vanzari: 2050
		' and (' + ceNrTotVz + '>=(case when pl.prjcstage=2050 then pl.num01 else 0 end) ' +
		' and ' + ceNrTotVz + '<=(case when pl.prjcstage=2050 then isnull(pl.num02,' + ceNrTotVz + ') else ' + ceNrTotVz + ' end))' +

		// Val. tot. vanzari: 2060
		' and (' + ceValTotVz + '>=(case when pl.prjcstage=2060 then pl.num01 else 0 end) ' +
		' and ' + ceValTotVz + '<=(case when pl.prjcstage=2060 then isnull(pl.num02,' + ceValTotVz + ') else ' + ceValTotVz + ' end))';

	// Varsta: 2080
	lcString = lcString +
		' and (' + ceVarstaCl + '>=(case when pl.prjcstage=2080 then pl.num01 else 0 end) ' +
		' and ' + ceVarstaCl + '<=(case when pl.prjcstage=2080 then isnull(pl.num02,' + ceVarstaCl + ') else ' + ceVarstaCl + ' end) and Year(' + ceDataVz + ')>1900)';

	// Data nasterii: 2090
	lcString = lcString +
		' and (Month(' + ceDataVz + ')=(case when pl.prjcstage=2090 then Month(' + ceDataCl + ') else Month(' + ceDataVz + ') end)' +
		' and Day(' + ceDataVz + ')=(case when pl.prjcstage=2090 then Day(' + ceDataCl + ') else Day(' + ceDataVz + ') end) and Year(' + ceDataVz + ')>1900)';

	// Sex: 2100
	lcString = lcString +
		' and ' + ceSexCl + '=(case when pl.prjcstage=2100 then pl.int01 else ' + ceSexCl + ' end)) x ';

	lcString = lcString +
		//' group by p.prjc, p.cccvoutype, p.cccdisc order by value desc';
		'group by x.prjc, x.nr_crit, x.cccvoutype, x.cccdisc, x.value ' +
		'having x.nr_crit=count(x.prjc) ' +
		'order by value desc';

	DsPrjc = X.GETSQLDATASET(lcString, null);
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

function regim_special() {
	docID();

	// Regim special pe factura daca contine integral bunuri sh, eventual si 0%
	DsLS = X.GETSQLDATASET('select findoc from mtrlines where isnull(vat,0)<>198 and isnull(vat,0)<>0 and findoc=' + vID, null);
	if (DsLS.RECORDCOUNT == 0)
		X.RUNSQL('update findoc set BGOTHRVAT=21, VATSTS=0 where findoc=' + vID, null);
	else
		X.RUNSQL('update findoc set BGOTHRVAT=null, VATSTS=(select vatsts from trdr where trdr=findoc.trdr) where findoc=' + vID, null);

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

	//X.WARNING(jsonToSend);
	//return CUSTFINDOC.FINDOC;
	return jsonToSend;
}

function delFiles(f1, f2) {
	var objFSO = new ActiveXObject("Scripting.FileSystemObject");

	objFSO.DeleteFile(f1);
	objFSO.DeleteFile(f2);
}

function ON_AFTERPOST() {
	X.PROCESSMESSAGES;

	regim_special();
	add_points();
	calc_points();
	inactivare_voucher();

	status_contracte();

	if (SALDOC.FPRMS == 7000 || SALDOC.FPRMS == 7900) {
		comm1(true);
		X.PROCESSMESSAGES;
	}

	// Transmitere array articole pentru update stoc pe website
	if (SALDOC.FPRMS == 7000 || SALDOC.FPRMS == 7900) {
		var fin = SALDOC.FINDOC ? SALDOC.FINDOC : X.NEWID;
		sendJson(fin, urlMtrls, 1);
		X.PROCESSMESSAGES;
	}
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
