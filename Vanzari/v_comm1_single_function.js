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
