select {tipDoc}, idcomanda, (select trdr from findoc where findoc={findoc}) trdr from CCCPDFFACTURA
where idcomanda={findoc}
