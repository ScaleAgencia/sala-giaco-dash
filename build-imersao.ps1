# Gera data-imersao.js (window.SALA_IMR) a partir dos dados puxados do Meta via MCP.
# Fonte: data\imr-daily.json (campanha x dia) e data\imr-ads.json (por anuncio, periodo todo).
# Imposto Meta x1,1385 aplicado no GASTO. Receita = purchase_roas * gasto_bruto (nao leva imposto).
$ErrorActionPreference='Stop'
$TAX=1.1385
$root='C:\dev\sala-giaco'
$daily = Get-Content "$root\data\imr-daily.json" -Raw -Encoding UTF8 | ConvertFrom-Json
$ads   = Get-Content "$root\data\imr-ads.json"   -Raw -Encoding UTF8 | ConvertFrom-Json

$pag = 'IMRS | E6-VEN | P2-FRIO | CONV | CBO | 2026-07-01 | Teste de p'+[char]0x00E1+'gina'
$campMap=@{
 'pagina' = $pag
 'isolado'='IMRS | E6-VEN | P2-FRIO | CONV | CBO | 25-09-2026 | Isolado'
 'ads3'   ='IMRS | E6-VEN | P2-FRIO | CONV | CBO | 2026-07-01 | Teste de ads  3'
 'ads2'   ='IMRS | E6-VEN | P2-FRIO | CONV | CBO | 2026-07-01 | Teste de ads  2'
 'ads1'   ='IMRS | E6-VEN | P2-FRIO | CONV | CBO | 2026-06-22 | Teste de ads'
 'pquente'='IMRS | E6-VEN | P1-QUENTE | CONV | CBO | 2026-07-01 | pquente'
}

# ---- diario (agrega campanhas por data) ----
$dmap=[ordered]@{}
foreach($r in $daily){
  $d=[string]$r[0]; $sp=[double]$r[1]; $im=[int]$r[2]; $ck=[int]$r[3]; $lp=[int]$r[4]; $pu=[int]$r[5]; $ro=[double]$r[6]; $re=[int]$r[7]
  if(-not $dmap.Contains($d)){ $dmap[$d]=[pscustomobject]@{date=$d;spend=0.0;impr=0;clicks=0;lpv=0;v3=0;purchases=0;revenue=0.0;reach=0} }
  $o=$dmap[$d]
  $o.spend+=$sp*$TAX; $o.impr+=$im; $o.clicks+=$ck; $o.lpv+=$lp; $o.purchases+=$pu; $o.revenue+=($ro*$sp); $o.reach+=$re
}
$dailyArr=@()
foreach($k in ($dmap.Keys | Sort-Object)){ $o=$dmap[$k]; $o.spend=[math]::Round($o.spend,2); $o.revenue=[math]::Round($o.revenue,2); $dailyArr+=$o }
$dates=@($dailyArr | ForEach-Object { $_.date }); $dateMin=$dates[0]; $dateMax=$dates[-1]

# ---- grao por anuncio (periodo todo, date=dateMax) ----
$grain=@()
foreach($r in $ads){
  $ad=[string]$r[0]; $key=[string]$r[1]; $adset=[string]$r[2]; $sp=[double]$r[3]; $im=[int]$r[4]; $ck=[int]$r[5]; $lp=[int]$r[6]; $pu=[int]$r[7]; $ro=[double]$r[8]
  $camp=$campMap[$key]; if(-not $camp){ $camp=$key }
  $grain+=[pscustomobject]@{date=$dateMax;campaign=$camp;adset=$adset;ad=$ad;spend=[math]::Round($sp*$TAX,2);impr=$im;clicks=$ck;lpv=$lp;purchases=$pu;revenue=[math]::Round($ro*$sp,2)}
}

# ---- totais (do diario) ----
$tot=[pscustomobject]@{
  spend=[math]::Round((($dailyArr|Measure-Object spend -Sum).Sum),2)
  impr=(($dailyArr|Measure-Object impr -Sum).Sum); clicks=(($dailyArr|Measure-Object clicks -Sum).Sum)
  lpv=(($dailyArr|Measure-Object lpv -Sum).Sum); purchases=(($dailyArr|Measure-Object purchases -Sum).Sum)
  revenue=[math]::Round((($dailyArr|Measure-Object revenue -Sum).Sum),2); reach=(($dailyArr|Measure-Object reach -Sum).Sum)
}

$gen=(Get-Date).ToString('dd/MM/yyyy HH:mm')
$obj=[pscustomobject]@{ generatedAtBR=$gen; taxMultiplier=$TAX; account='CA 01 - Giacobelli'; tag='IMRS'; dateMin=$dateMin; dateMax=$dateMax; totals=$tot; daily=$dailyArr; grain=$grain }
$json=$obj | ConvertTo-Json -Depth 6 -Compress
[IO.File]::WriteAllText("$root\data-imersao.js",("window.SALA_IMR="+$json+";"),(New-Object Text.UTF8Encoding($false)))

Write-Host ("Imersao OK: dias={0} ({1}..{2}) anuncios={3}" -f $dailyArr.Count,$dateMin,$dateMax,$grain.Count)
Write-Host ("Totais c/imposto: gasto=R$ {0} | compras={1} | receita=R$ {2} | ROAS={3} | impr={4} | cliques={5} | LPV={6}" -f $tot.spend,$tot.purchases,$tot.revenue,[math]::Round($tot.revenue/$tot.spend,3),$tot.impr,$tot.clicks,$tot.lpv)
$rawSpend=[math]::Round((($daily|ForEach-Object{[double]$_[1]}|Measure-Object -Sum).Sum),2)
$adsRaw=[math]::Round((($ads|ForEach-Object{[double]$_[3]}|Measure-Object -Sum).Sum),2)
Write-Host ("Conferencia gasto BRUTO: diario=R$ {0} | anuncios=R$ {1} (Meta esperado ~13480,59)" -f $rawSpend,$adsRaw)
