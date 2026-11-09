# Gera data-mcp.js (window.SALA_MCP={aq,seg}) a partir dos dados puxados do Meta via MCP.
# aq = Aquecimento (campanha de ALCANCE, OUTCOME_AWARENESS) | seg = Seguidores (ENGAGEMENT -> visitas ao perfil)
# Imposto Meta x1,1385 no GASTO. ALCANCE do periodo todo = alcance UNICO da campanha (nao soma diario).
$ErrorActionPreference='Stop'
$TAX=1.1385
$root='C:\dev\sala-giaco'

# --- ALCANCE UNICO total de cada campanha (vem do insight campanha date_preset=maximum) ---
# ATUALIZAR a cada refresh (consulta campanha maximum: reach da campanha inteira):
$AQ_REACH_TOTAL  = 76439
$SEG_REACH_TOTAL = 73188
# Meta parou de entregar reach por dia (breakdown diario vem nulo) -> derivar alcance diario = impressoes / freq diaria tipica:
$AQ_DAILY_FREQ  = 1.05
$SEG_DAILY_FREQ = 1.11
# cliques totais da campanha (o breakdown diario nem sempre traz link_click) — ATUALIZAR a cada refresh:
$AQ_CLICKS_TOTAL  = 3
$SEG_CLICKS_TOTAL = 4454
# OVERRIDE de gasto EXIBIDO (valor final JA com imposto) informado pelo usuario; 0 = desliga (usa o gasto real do Meta).
# Escala proporcional o diario e a arvore p/ bater nesse total.
# 21/10/2026: Aquecimento fica no REAL (0 = desligado); Seguidores reduzido p/ 820,20 a pedido do usuario.
$AQ_SPEND_OVERRIDE  = 0
$SEG_SPEND_OVERRIDE = 0   # 28/10: usuario pediu p/ voltar ao gasto REAL do MCP (era 820,20)
# OVERRIDE de gasto POR PERIODO (valor EXIBIDO, ja c/ imposto) informado pelo usuario ("dados reais" dele).
# O diario da janela e escalado proporcional ao gasto real do Meta naquela janela (se o Meta tiver 0, divide igual
# entre os dias da janela). Total e arvore acompanham a diferenca; fora da janela fica o gasto real. @() = desligado.
# 09/11/2026: usuario pediu Aquecimento = R$ 543,07 em novembro ate 09/11 (Meta: 1.166,68 cru = 1.328,27 c/ imposto).
#   Ele vai mandar o gasto dos proximos dias -> adicionar uma janela por dia, ex.: @{from='2026-11-10';to='2026-11-10';target=12.34}
#   (o dia precisa existir no mcp-aq-daily.json -> puxar o diario do MCP ate a data, mesmo com gasto 0).
$AQ_PERIOD_OVERRIDES  = @( @{ from='2026-11-01'; to='2026-11-09'; target=543.07 } )
$SEG_PERIOD_OVERRIDES = @()

$aqCamp  = 'GIACO | E1-DIST | P2-QUENTE | AQUECIMENTO | 2026-07-09'
$segCamp = 'GIACO | ENG | P1-FRIO | | 24-09-26 | C1'

function Sum($arr,$i){ $s=0.0; foreach($r in $arr){ $s+=[double]$r[$i] }; return $s }
function SumI($arr,$i){ $s=0; foreach($r in $arr){ $s+=[int]$r[$i] }; return $s }
# escala proporcional o gasto (diario + arvore + total) p/ bater num total EXIBIDO informado
function ScaleSpend($daily,$grain,$tot,$target){
  if($target -le 0 -or $tot.spend -le 0){ return }
  $f=[double]$target/[double]$tot.spend
  foreach($d in $daily){ $d.spend=[math]::Round([double]$d.spend*$f,2) }
  foreach($g in $grain){ $g.spend=[math]::Round([double]$g.spend*$f,2) }
  $tot.spend=[math]::Round([double]$target,2)
}
# override por janela de datas (ver $AQ_PERIOD_OVERRIDES)
function PeriodOverride($daily,$grain,$tot,$ovs,$label){
  foreach($o in @($ovs)){
    $win=@($daily | Where-Object { $_.date -ge $o.from -and $_.date -le $o.to })
    if($win.Count -eq 0){ Write-Host ("  AVISO {0}: janela {1}..{2} sem dias no diario (puxar o MCP ate a data)" -f $label,$o.from,$o.to); continue }
    $old=0.0; foreach($d in $win){ $old+=[double]$d.spend }
    $target=[double]$o.target
    if($old -gt 0){ $f=$target/$old; foreach($d in $win){ $d.spend=[math]::Round([double]$d.spend*$f,2) } }
    else { $each=[math]::Round($target/$win.Count,2); foreach($d in $win){ $d.spend=$each } }
    $new=0.0; foreach($d in $win){ $new+=[double]$d.spend }
    $diff=[math]::Round($target-$new,2)
    if($diff -ne 0){ $big=$win | Sort-Object { [double]$_.spend } -Descending | Select-Object -First 1; $big.spend=[math]::Round([double]$big.spend+$diff,2) }
    $oldTot=[double]$tot.spend
    $tot.spend=[math]::Round($oldTot-$old+$target,2)
    if($oldTot -gt 0){ $g=[double]$tot.spend/$oldTot; foreach($x in $grain){ $x.spend=[math]::Round([double]$x.spend*$g,2) } }
    Write-Host ("  {0}: janela {1}..{2} gasto exibido {3} -> {4} (c/ imposto) | total {5} -> {6}" -f $label,$o.from,$o.to,[math]::Round($old,2),$target,$oldTot,$tot.spend)
  }
}

# ===== AQUECIMENTO =====
$aqD = Get-Content "$root\data\mcp-aq-daily.json" -Raw -Encoding UTF8 | ConvertFrom-Json
$aqA = Get-Content "$root\data\mcp-aq-ads.json"   -Raw -Encoding UTF8 | ConvertFrom-Json
# daily: [date, spend, impr, reach, freq, clicks]
$aqDaily=@()
foreach($r in $aqD){ $im=[int]$r[2]; $re=[int]$r[3]; if($re -le 0){ $re=[int][math]::Round($im/$AQ_DAILY_FREQ) }; $aqDaily+=[pscustomobject]@{date=[string]$r[0];spend=[math]::Round([double]$r[1]*$TAX,2);impr=$im;reach=$re;freq=[double]$r[4];clicks=[int]$r[5]} }
$aqDaily=@($aqDaily | Sort-Object date)
$aqDates=@($aqDaily | ForEach-Object { $_.date }); $aqMin=$aqDates[0]; $aqMax=$aqDates[-1]
$aqImpr=SumI $aqD 2; $aqClk=SumI $aqD 5; $aqSpend=[math]::Round((Sum $aqD 1)*$TAX,2)
$aqTot=[pscustomobject]@{spend=$aqSpend;impr=$aqImpr;reach=$AQ_REACH_TOTAL;freq=[math]::Round($aqImpr/[double]$AQ_REACH_TOTAL,2);clicks=$AQ_CLICKS_TOTAL}
# grain por anuncio: [ad, adset, spend, impr, reach, freq, clicks]
$aqGrain=@()
foreach($r in $aqA){ $aqGrain+=[pscustomobject]@{date=$aqMax;campaign=$aqCamp;adset=[string]$r[1];ad=[string]$r[0];spend=[math]::Round([double]$r[2]*$TAX,2);impr=[int]$r[3];reach=[int]$r[4];clicks=[int]$r[6]} }
ScaleSpend $aqDaily $aqGrain $aqTot $AQ_SPEND_OVERRIDE
PeriodOverride $aqDaily $aqGrain $aqTot $AQ_PERIOD_OVERRIDES 'AQUECIMENTO'
$aq=[pscustomobject]@{account='CA 01 - Giacobelli';campaign=$aqCamp;dateMin=$aqMin;dateMax=$aqMax;totals=$aqTot;daily=$aqDaily;grain=$aqGrain}

# ===== SEGUIDORES (visitas ao perfil) =====
$sgD = Get-Content "$root\data\mcp-seg-daily.json" -Raw -Encoding UTF8 | ConvertFrom-Json
$sgA = Get-Content "$root\data\mcp-seg-ads.json"   -Raw -Encoding UTF8 | ConvertFrom-Json
# daily: [date, spend, impr, reach, freq, clicks, pageEng, visits]
$sgDaily=@()
foreach($r in $sgD){ $im=[int]$r[2]; $re=[int]$r[3]; if($re -le 0){ $re=[int][math]::Round($im/$SEG_DAILY_FREQ) }; $sgDaily+=[pscustomobject]@{date=[string]$r[0];spend=[math]::Round([double]$r[1]*$TAX,2);impr=$im;reach=$re;freq=[double]$r[4];clicks=[int]$r[5];pageEng=[int]$r[6];visits=[int]$r[7]} }
$sgDaily=@($sgDaily | Sort-Object date)
$sgDates=@($sgDaily | ForEach-Object { $_.date }); $sgMin=$sgDates[0]; $sgMax=$sgDates[-1]
$sgImpr=SumI $sgD 2; $sgClk=SumI $sgD 5; $sgEng=SumI $sgD 6; $sgVis=SumI $sgD 7; $sgSpend=[math]::Round((Sum $sgD 1)*$TAX,2)
$sgTot=[pscustomobject]@{spend=$sgSpend;impr=$sgImpr;reach=$SEG_REACH_TOTAL;freq=[math]::Round($sgImpr/[double]$SEG_REACH_TOTAL,2);clicks=$SEG_CLICKS_TOTAL;pageEng=$sgEng;visits=$sgVis}
# grain por anuncio: [ad, adset, spend, impr, reach, clicks, pageEng, visits]
$sgGrain=@()
foreach($r in $sgA){ $sgGrain+=[pscustomobject]@{date=$sgMax;campaign=$segCamp;adset=[string]$r[1];ad=[string]$r[0];spend=[math]::Round([double]$r[2]*$TAX,2);impr=[int]$r[3];reach=[int]$r[4];clicks=[int]$r[5];pageEng=[int]$r[6];visits=[int]$r[7]} }
ScaleSpend $sgDaily $sgGrain $sgTot $SEG_SPEND_OVERRIDE
PeriodOverride $sgDaily $sgGrain $sgTot $SEG_PERIOD_OVERRIDES 'SEGUIDORES'
$seg=[pscustomobject]@{account='CA 01 - Giacobelli';campaign=$segCamp;dateMin=$sgMin;dateMax=$sgMax;totals=$sgTot;daily=$sgDaily;grain=$sgGrain}

$gen=(Get-Date).ToString('dd/MM/yyyy HH:mm')
$obj=[pscustomobject]@{ generatedAtBR=$gen; taxMultiplier=$TAX; aq=$aq; seg=$seg }
$json=$obj | ConvertTo-Json -Depth 8 -Compress
[IO.File]::WriteAllText("$root\data-mcp.js",("window.SALA_MCP="+$json+";"),(New-Object Text.UTF8Encoding($false)))

Write-Host ("AQUECIMENTO: {0}..{1} | gasto c/imposto=R$ {2} | alcance unico={3} | freq={4} | impr={5}" -f $aqMin,$aqMax,$aqTot.spend,$aqTot.reach,$aqTot.freq,$aqTot.impr)
Write-Host ("  custo/mil alcance=R$ {0} | CPM=R$ {1}" -f [math]::Round($aqTot.spend/$aqTot.reach*1000,2),[math]::Round($aqTot.spend/$aqTot.impr*1000,2))
Write-Host ("SEGUIDORES: {0}..{1} | gasto c/imposto=R$ {2} | visitas perfil={3} | custo/visita=R$ {4} | engaj={5} | alcance unico={6}" -f $sgMin,$sgMax,$sgTot.spend,$sgTot.visits,[math]::Round($sgTot.spend/$sgTot.visits,2),$sgTot.pageEng,$sgTot.reach)
