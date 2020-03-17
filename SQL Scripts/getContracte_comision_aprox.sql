SELECT XX.*
	,case when XX.isactive=1 then XX.TotalImprumut + XX.ComisionLaZi else 0 end as TotalLaZi
FROM (
	SELECT A.COMPANY
		,A.SODTYPE
		,A.INST
		,A.CODE AS CodContract
		,A.NAME AS DenumireContract
		,A.ISACTIVE
		,e.name Tip
		,A.TRDR
		,d.code CodClient
		,d.name NumeClient
		,D.AFM AS Cui
		,A.BRANCH
		,f.name Filiala
		,A.FROMDATE DataContract
		,A.GDATEFROM StartGratie
		,A.GDATETO EndGratie
		,A.WDATEFROM StartContract
		,A.WDATETO EndContract
		,(select name from utbl04 where sodtype=41 and company=a.company and utbl04=A.UTBL04) AS Status
		,ISNULL(A.CCCITESUM, 0) AS TotalImprumut
		,case when A.CCCCNTRTYPE=1 then 'Contract' else 'Act aditional' end as TipAct
		,B.INSTLINES Linie
		,C.MTRL
		,C.CODE CodArticol
		,C.NAME NumeArticol
		,ISNULL(B.PRICE, 0) AS Valoare
		,ISNULL(B.CCCQTY, 0) AS Cantitate
		,ISNULL(B.CCCPRICE, 0) AS Pret
		,ISNULL(B.CCCPAID, 0) AS Incasat
		,ISNULL(B.CCCWEIGHT, 0) AS Net
		,ISNULL(B.CCCGWEIGHT, 0) AS Brut
		,B.CCCDESC AS Descriere
		,ISNULL(B.CCCEVAL, 0) AS Evaluat
		,ISNULL((
				SELECT case when sum(x.value)>0 then sum(x.value) else 0 end
				FROM (
					SELECT m.mtrl
						,m.mtrcategory
						,il.cccprice
						,datediff(d, il.fromdate, GetDate()) + 1 AS zile
						,CASE
							WHEN m.mtrcategory = 106
								THEN (datediff(d, il.fromdate, GetDate()) + 1) * il.cccprice
							ELSE il.cccprice
							END AS value
					FROM instlines il
					JOIN mtrl m ON m.mtrl = il.mtrl
					JOIN inst i ON i.inst=il.inst
					WHERE il.inst = a.inst
						AND il.sodtype = 52
						AND i.isactive=1
						AND m.mtrcategory IN (
							106
							,108
							)
					) x
				), 0) AS ComisionLaZi
		,ISNULL((
				SELECT sum(llineval)
				FROM trdtlines
				WHERE inst = a.inst
					AND sosource = 1413
				), 0) AS OP
		,"Stare contract" = case when a.isactive = 1 and a.utbl04=5000 then 'In intarziere' when a.isactive=0 and a.utbl04=4000 then 'Inactiv lichidat'
			when a.isactive=1 and a.utbl04 not in (4100, 5000) then 'In termen' when a.utbl04=4100 then 'Inactiv pierdut' end
	FROM INST A
	LEFT OUTER JOIN INSTLINES B ON B.INST = A.INST
	LEFT OUTER JOIN MTRL C ON B.MTRL = C.MTRL
	LEFT OUTER JOIN TRDR D ON A.TRDR = D.TRDR
	LEFT OUTER JOIN INSTTYPE e ON (e.INSTTYPE = a.INSTTYPE)
	LEFT OUTER JOIN branch f ON (f.branch = a.branch)
	WHERE A.COMPANY = :X.SYS.COMPANY
		AND A.SODTYPE = 41
	) XX
WHERE XX.TRDR = {param1}
