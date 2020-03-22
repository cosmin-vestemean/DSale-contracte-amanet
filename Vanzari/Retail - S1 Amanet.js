function ON_LOCATE()
{
		visible_tab();
}

function ON_INSERT()
{
		//visible_tab();
}

function ON_SALDOC_INST()
{

		if (SALDOC.FPRMS==9500 || SALDOC.FPRMS==9100)
		achitare_contract();

		if (SALDOC.FPRMS == 9100)
		{
		VBUFSET.ADVPAY = SALDOC.SUMAMNT;
		VBUFSET.CASHPAYED = 0;
		}

		if (SALDOC.FPRMS==9000)
		plata_imprumut();
}

function ON_SALDOC_TRDR()
{
		/*DsPrsn = X.GETSQLDATASET('select prsn from prsn where users='+X.SYS.USER,null);
		if (DsPrsn.RECORDCOUNT>0)
		SALDOC.SALESMAN = DsPrsn.prsn;*/

		if (SALDOC.FPRMS == 9500 || SALDOC.FPRMS == 9100)
		{
		if (SALDOC.BONUSCARD > 0) {}
		else
		aplicare_card_fidelitate();
		}
}

function achitare_contract()
{
		DsCard = X.GETSQLDATASET('select cccbonuscard as card, isnull(cccnegcardpoints,0) as pointsu, isnull(ccccardpoints,0) as pointsa, cccvoucher as voucher from inst where inst='+SALDOC.INST,null);

		if (DsCard.card>0)
		{
		SALDOC.BONUSCARD = DsCard.card;
		SALDOC.NEGCARDPOINTS = DsCard.pointsu;
		SALDOC.CARDPOINTS = DsCard.pointsa;
		}
		if (DsCard.voucher>0)
		SALDOC.CCCVOUCHER = DsCard.voucher;


		DsArt = X.GETSQLDATASET('select mtrl, qty, cccqty, cccpay, cccprice, instlines from instlines where sodtype=51 and isnull(cccpay,0)<>0 and inst='+SALDOC.INST,null);
		DsSrv = X.GETSQLDATASET('select mtrl, qty, cccqty, cccpay, cccprice, instlines from instlines where sodtype=52 and isnull(cccpay,0)<>0 and inst='+SALDOC.INST,null);
		if (DsArt.RECORDCOUNT > 0)
		{
				DsArt.FIRST;
				while (!DsArt.Eof)
				{
					ITELINES.APPEND;
					ITELINES.MTRL = DsArt.mtrl;
					ITELINES.QTY1 = DsArt.qty;
					ITELINES.PRICE = DsArt.cccpay;
					ITELINES.MTRLINESS = DsArt.instlines;
					ITELINES.POST;

					DsArt.NEXT;
				}
		}

		if (DsSrv.RECORDCOUNT > 0)
		{
				DsSrv.FIRST;
				while (!DsSrv.Eof)
				{
					SRVLINES.APPEND;
					SRVLINES.MTRL = DsSrv.mtrl;
					SRVLINES.QTY1 = DsSrv.cccqty;
					SRVLINES.PRICE = DsSrv.cccprice;
					SRVLINES.MTRLINESS = DsSrv.instlines;
					SRVLINES.POST;

					DsSrv.NEXT;
				}
		}


		if (ITELINES.MTRL>0) {}
		else
		visible_tab();
}

function plata_imprumut()
{
		DsArt = X.GETSQLDATASET('select mtrl, qty, price, instlines from instlines where sodtype=51 and isnull(price,0)>0 and inst='+SALDOC.INST,null);
		if (DsArt.RECORDCOUNT > 0)
		{
				DsArt.FIRST;
				while (!DsArt.Eof)
				{
					ITELINES.APPEND;
					ITELINES.MTRL = DsArt.mtrl;
					ITELINES.QTY1 = DsArt.qty;
					ITELINES.PRICE = DsArt.price;
					ITELINES.MTRLINESS = DsArt.instlines;
					ITELINES.POST;

					DsArt.NEXT;
				}
		}
		//X.EXEC('button:Save');
}

function ON_POST()
{
	// Conditie supimentara pt. prevenire dublare chitante
	DsCond = X.GETSQLDATASET('select findoc from findoc where sosource=1351 and fprms in (9500,9100) and inst='+SALDOC.INST,null);
	if (DsCond.RECORDCOUNT>0)
	X.EXCEPTION('Exista deja incasare pentru acest contract!');
}

function ON_AFTERPOST()
{
		// Update valori achitate - Contract
		if (SALDOC.FPRMS == 9500 || SALDOC.FPRMS == 9100 || SALDOC.FPRMS == 9600)
		{
		docID();
		DsDate = X.GETSQLDATASET('select llineval, mtrliness from mtrlines where findoc='+vID,null);
		DsDate.FIRST;
		while (!DsDate.Eof)
			{
			DsActual = X.GETSQLDATASET('select cccpaid from instlines where instlines='+DsDate.mtrliness+' and inst='+SALDOC.INST,null);
			cePaid = DsActual.cccpaid;
			cePay = DsActual.cccpaid+DsDate.llineval;
			X.RUNSQL('update instlines set cccpaid='+cePay+' where instlines='+DsDate.mtrliness+' and inst='+SALDOC.INST,null);
			DsDate.NEXT;
			}


		//X.RUNSQL('update inst set utbl04=3000, isactive=0 where inst='+SALDOC.INST,null); // se realizeaza dupa salvarea actului aditional
		}

		if (SALDOC.FPRMS == 9500 || SALDOC.FPRMS == 9100)
		{
		add_points();
		calc_points();
		inactivare_voucher();
		}
}

function ON_DELETE()
{
		// Update valori incasate - Contract
		if (SALDOC.FPRMS == 9500 || SALDOC.FPRMS == 9100)
		{
		DsValidare = X.GETSQLDATASET('select inst from inst where cccinsts='+SALDOC.INST,null);
		if (DsValidare.RECORDCOUNT>0)
		X.EXCEPTION('Stergere nepermisa, exista act aditional generat!');

		docID();
		/*DsDate = X.GETSQLDATASET('select llineval, mtrliness from mtrlines where findoc='+vID,null);
		DsDate.FIRST;
		while (!DsDate.Eof)
			{
			DsActual = X.GETSQLDATASET('select cccpaid from instlines where instlines='+DsDate.mtrliness+' and inst='+SALDOC.INST,null);
			cePaid = DsActual.cccpaid;
			cePay = DsActual.cccpaid-DsDate.llineval;
			X.RUNSQL('update instlines set cccpaid='+cePay+' where instlines='+DsDate.mtrliness+' and inst='+SALDOC.INST,null);
			DsDate.NEXT;
			}*/

			//Simplificat - poate fi o singura chitanta / contract
			X.RUNSQL('update instlines set cccpaid=0 where inst='+SALDOC.INST,null);

			// Update status contract
			DsTip = X.GETSQLDATASET('select isnull(ccccntrtype,0) as tip from inst where inst='+SALDOC.INST,null);
			ceTip = DsTip.tip;
			X.RUNSQL('update inst set isactive=1, utbl04=(case when '+ceTip+'=1 then 1000 else 3100 end) where inst='+SALDOC.INST,null);
		}

		if (SALDOC.FPRMS==9000)
		{
		docID();
		X.RUNSQL('update inst set utbl04=null where inst='+SALDOC.INST,null);
		}

}

function ON_AFTERDELETE()
{
		if (SALDOC.FPRMS == 9500 || SALDOC.FPRMS == 9100)
		{

		}

}


function ON_CANCEL()
{
	// Interdictie renuntare salvare Dispozitie de plata
	docID();
	if (vID>0) {}
	else
	{
	if (SALDOC.INST>0&&SALDOC.FPRMS==9000)
	X.EXCEPTION('Salvati documentul!');
	}
}

function ON_ITELINES_BEFOREDELETE()
{
	X.EXCEPTION('Stergere nepermisa!');
}

function ON_SRVLINES_BEFOREDELETE()
{
	X.EXCEPTION('Stergere nepermisa!');
}

function add_points()
{
	DsAddRate = X.GETSQLDATASET('select value from cardcategory where cardcategory=100',null);
	ceRata = DsAddRate.value;

	docID();
	DsVal = X.GETSQLDATASET('select sum(netlineval) as sum from mtrlines where sodtype=52 and findoc='+vID,null);
	catePuncte = Math.round(DsVal.sum * ceRata)/100;

	X.RUNSQL('update findoc set cardpoints='+catePuncte+' where findoc='+vID,null);
}

function calc_points()
{
docID();
DsCalc = X.GETSQLDATASET('select isnull(opoints,0)+sum(isnull(cardpoints,0)-isnull(negcardpoints,0)) as points, f.trdr '+
		'from trdrbonuscard tb '+
		'join findoc f on tb.trdr=f.trdr and tb.bonuscard=f.bonuscard '+
		'where f.bonuscard>0 and f.trdr='+SALDOC.TRDR+' and f.bonuscard='+SALDOC.BONUSCARD+
		' group by f.trdr, f.bonuscard, tb.opoints',null);

X.RUNSQL('update trdrbonuscard set points='+DsCalc.points+' where bonuscard='+SALDOC.BONUSCARD+' and trdr='+SALDOC.TRDR,null);
//catePCard=DsCalc.points;
//return(catePCard);

}

function inactivare_voucher()
{
	if (SALDOC.CCCVOUCHER>0)
	X.RUNSQL('update voucher set voucherstates=3 , upddate=GETDATE() where voucher='+SALDOC.CCCVOUCHER,null);
}

function docID()
{
    if (SALDOC.FINDOC < 0)
        vID = X.NEWID;
    else
        vID = SALDOC.FINDOC;
    return vID;
}

function aplicare_card_fidelitate()
{
// Aplicare card fidelitate
		DsCard = X.GETSQLDATASET('select top 1 t.trdr, b.bonuscard from trdrbonuscard t join bonuscard b on t.bonuscard=b.bonuscard '+
						'where t.trdr='+SALDOC.TRDR+' and isactive=1 order by b.fromdate desc',null);
		if (DsCard.bonuscard>0)
		SALDOC.BONUSCARD = DsCard.bonuscard;
}

function visible_tab()
{
	if (ITELINES.MTRL > 0)
	X.SETPROPERTY('PANEL','Page1','VISIBLE',1);
	else
	X.SETPROPERTY('PANEL','Page1','VISIBLE',0);
}
