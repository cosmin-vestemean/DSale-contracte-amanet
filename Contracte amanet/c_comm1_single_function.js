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
