# Gera data-mcp.js (window.SALA_MCP={aq,seg}) a partir dos dados puxados do Meta via MCP.
# aq = Aquecimento (campanha de ALCANCE, OUTCOME_AWARENESS) | seg = Seguidores (ENGAGEMENT -> visitas ao perfil)
# Imposto Meta x1,1385 no GASTO. ALCANCE do periodo todo = alcance UNICO da campanha (nao soma diario).
$ErrorActionPreference='Stop'
$TAX=1.1385
$root='C:\dev\sala-giaco'

# --- ALCANCE UNICO total de cada campanha (vem do insight campanha date_preset=maximum) ---
# ATUALIZAR a cada refresh (consulta campanha maximum: reach da campanha inteira):
$AQ_REACH_TOTAL  = 66999
$SEG_REACH_TOTAL = 24037

$aqCamp  = 'GIACO | E1-DIST | P2-QUENTE | AQUECIMENTO | 2026-07-09'
$segCamp = 'GIACO | ENG | P1-FRIO | | 24-09-26 | C1'

function Sum($arr,$i){ $s=0.0; foreach($r in $arr){ $s+=[double]$r[$i] }; return $s }
function SumI($arr,$i){ $s=0; foreach($r in $arr){ $s+=[int]$r[$i] }; return $s }

# ===== AQUECIMENTO =====
$aqD = Get-Content "$root\data\mcp-aq-daily.json" -Raw -Encoding UTF8 | ConvertFrom-Json
$aqA = Get-Content "$root\data\mcp-aq-ads.json"   -Raw -Encoding UTF8 | ConvertFrom-Json
# daily: [date, spend, impr, reach, freq, clicks]
$aqDaily=@()
foreach($r in $aqD){ $aqDaily+=[pscustomobject]@{date=[string]$r[0];spend=[math]::Round([double]$r[1]*$TAX,2);impr=[int]$r[2];reach=[int]$r[3];freq=[double]$r[4];clicks=[int]$r[5]} }
$aqDaily=@($aqDaily | Sort-Object date)
$aqDates=@($aqDaily | ForEach-Object { $_.date }); $aqMin=$aqDates[0]; $aqMax=$aqDates[-1]
$aqImpr=SumI $aqD 2; $aqClk=SumI $aqD 5; $aqSpend=[math]::Round((Sum $aqD 1)*$TAX,2)
$aqTot=[pscustomobject]@{spend=$aqSpend;impr=$aqImpr;reach=$AQ_REACH_TOTAL;freq=[math]::Round($aqImpr/[double]$AQ_REACH_TOTAL,2);clicks=$aqClk}
# grain por anuncio: [ad, adset, spend, impr, reach, freq, clicks]
$aqGrain=@()
foreach($r in $aqA){ $aqGrain+=[pscustomobject]@{date=$aqMax;campaign=$aqCamp;adset=[string]$r[1];ad=[string]$r[0];spend=[math]::Round([double]$r[2]*$TAX,2);impr=[int]$r[3];reach=[int]$r[4];clicks=[int]$r[6]} }
$aq=[pscustomobject]@{account='CA 01 - Giacobelli';campaign=$aqCamp;dateMin=$aqMin;dateMax=$aqMax;totals=$aqTot;daily=$aqDaily;grain=$aqGrain}

# ===== SEGUIDORES (visitas ao perfil) =====
$sgD = Get-Content "$root\data\mcp-seg-daily.json" -Raw -Encoding UTF8 | ConvertFrom-Json
$sgA = Get-Content "$root\data\mcp-seg-ads.json"   -Raw -Encoding UTF8 | ConvertFrom-Json
# daily: [date, spend, impr, reach, freq, clicks, pageEng, visits]
$sgDaily=@()
foreach($r in $sgD){ $sgDaily+=[pscustomobject]@{date=[string]$r[0];spend=[math]::Round([double]$r[1]*$TAX,2);impr=[int]$r[2];reach=[int]$r[3];freq=[double]$r[4];clicks=[int]$r[5];pageEng=[int]$r[6];visits=[int]$r[7]} }
$sgDaily=@($sgDaily | Sort-Object date)
$sgDates=@($sgDaily | ForEach-Object { $_.date }); $sgMin=$sgDates[0]; $sgMax=$sgDates[-1]
$sgImpr=SumI $sgD 2; $sgClk=SumI $sgD 5; $sgEng=SumI $sgD 6; $sgVis=SumI $sgD 7; $sgSpend=[math]::Round((Sum $sgD 1)*$TAX,2)
$sgTot=[pscustomobject]@{spend=$sgSpend;impr=$sgImpr;reach=$SEG_REACH_TOTAL;freq=[math]::Round($sgImpr/[double]$SEG_REACH_TOTAL,2);clicks=$sgClk;pageEng=$sgEng;visits=$sgVis}
# grain por anuncio: [ad, adset, spend, impr, reach, clicks, pageEng, visits]
$sgGrain=@()
foreach($r in $sgA){ $sgGrain+=[pscustomobject]@{date=$sgMax;campaign=$segCamp;adset=[string]$r[1];ad=[string]$r[0];spend=[math]::Round([double]$r[2]*$TAX,2);impr=[int]$r[3];reach=[int]$r[4];clicks=[int]$r[5];pageEng=[int]$r[6];visits=[int]$r[7]} }
$seg=[pscustomobject]@{account='CA 01 - Giacobelli';campaign=$segCamp;dateMin=$sgMin;dateMax=$sgMax;totals=$sgTot;daily=$sgDaily;grain=$sgGrain}

$gen=(Get-Date).ToString('dd/MM/yyyy HH:mm')
$obj=[pscustomobject]@{ generatedAtBR=$gen; taxMultiplier=$TAX; aq=$aq; seg=$seg }
$json=$obj | ConvertTo-Json -Depth 8 -Compress
[IO.File]::WriteAllText("$root\data-mcp.js",("window.SALA_MCP="+$json+";"),(New-Object Text.UTF8Encoding($false)))

Write-Host ("AQUECIMENTO: {0}..{1} | gasto c/imposto=R$ {2} | alcance unico={3} | freq={4} | impr={5}" -f $aqMin,$aqMax,$aqTot.spend,$aqTot.reach,$aqTot.freq,$aqTot.impr)
Write-Host ("  custo/mil alcance=R$ {0} | CPM=R$ {1}" -f [math]::Round($aqTot.spend/$aqTot.reach*1000,2),[math]::Round($aqTot.spend/$aqTot.impr*1000,2))
Write-Host ("SEGUIDORES: {0}..{1} | gasto c/imposto=R$ {2} | visitas perfil={3} | custo/visita=R$ {4} | engaj={5} | alcance unico={6}" -f $sgMin,$sgMax,$sgTot.spend,$sgTot.visits,[math]::Round($sgTot.spend/$sgTot.visits,2),$sgTot.pageEng,$sgTot.reach)
