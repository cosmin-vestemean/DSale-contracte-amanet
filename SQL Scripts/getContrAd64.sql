select base64, inst, orig, (select trdr from inst where inst={inst}) trdr from CCCPDFINST
where inst={inst}
