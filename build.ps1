# =====================================================================
#  SALA | GIACO — Dashboard data engine (2 funis numa dash so)
#  Cruza 4 fontes Google (CSV gviz) e escreve data.js (window.SALA):
#   - SALA LP    : queries Meta (LP) x leads da landing page  (atrib. por UTM)
#   - SALA FORM5 : queries Meta (FORM5) x leads do form nativo (join direto)
#  Mesmo Leadscore (A/B/C/D/E) nos dois — 4 perguntas, +1 por SIM.
#  Somente leitura — NAO altera nenhuma planilha. Roda em PS5.1 e no Actions.
# =====================================================================
param([ValidateSet('all')][string]$Mode='all')
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$BR = [Globalization.CultureInfo]::GetCultureInfo('pt-BR')
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$dataDir = Join-Path $root 'data'
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

# ---- Fontes (somente leitura) --------------------------------------
$MASTER      = '1Uep5K2-fJqBxNX-j8rDa-7V-Q2-iCRlz9S6KzR37VsQ'         # planilha master (queries + leads FORM5 + leadscoring)
$LP_LEADS_ID = '1GSk6HrOkVAig5YX98fUNAvFf95t5t6OlN05Svp1fPIY'         # leads da landing page (planilha separada)
$LP_Q_GID = '420969158'    # aba "Sala LP | Meta Ads Queries"
$LP_L_GID = '407413519'    # leads LP antigos/retroativos (dentro de LP_LEADS_ID)
$LP_L2_ID = '1B3ICzk0JfzAQ2bhfZH_13YpCOctiAXV9jdIQl4Xp_Wk'  # planilha NOVA de leads da LP (form ABI)
$LP_L2_GID = '510515881'
$AGENCY_MAIL = 'agenciaup13'  # testes da propria agencia -> NAO contabilizar como lead
$F5_Q_GID = '1219257520'   # aba "Queries FORM5 | Meta Ads"
$F5_L_GID = '1377076151'   # aba "SDC - FORM5 - LEADS" (leads antigos/retroativos)
$F5_L2_NAME = 'FORM6-COPY' # aba nova onde caem os novos leads do FORM5 (por nome)
$IMR_Q_GID = '1269370345'  # aba "QUERIES | IMERSAO | Meta ads" (funil de VENDAS, sem cruzamento)
$TAX = 1.1385              # imposto Meta (+13,85%) aplicado em TODO gasto

# ---- helpers -------------------------------------------------------
function Get-Sheet($id,$gid,$out){
  $url = "https://docs.google.com/spreadsheets/d/$id/gviz/tq?tqx=out:csv&gid=$gid"
  Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing -TimeoutSec 120
  if((Get-Item $out).Length -lt 20){ throw "Download muito pequeno: $out" }
}
function Get-SheetNamed($id,$name,$out){
  $enc=[Uri]::EscapeDataString($name)
  $url = "https://docs.google.com/spreadsheets/d/$id/gviz/tq?tqx=out:csv&sheet=$enc"
  Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing -TimeoutSec 120
  if((Get-Item $out).Length -lt 20){ throw "Download muito pequeno: $out" }
}
Add-Type -AssemblyName Microsoft.VisualBasic
function Read-Csv($path){
  $rows = New-Object System.Collections.Generic.List[object]
  $p = New-Object Microsoft.VisualBasic.FileIO.TextFieldParser($path,[System.Text.Encoding]::UTF8)
  $p.TextFieldType='Delimited'; $p.SetDelimiters(','); $p.HasFieldsEnclosedInQuotes=$true
  while(-not $p.EndOfData){ $rows.Add($p.ReadFields()) }
  $p.Close(); return $rows
}
function Norm($s){ if($null -eq $s){return ''}; return ($s -replace [char]0x200b,'').Trim() }
function MoneyBR($s){ $s=Norm $s; if($s -eq ''){return 0.0}; return [double]($s -replace '\.','' -replace ',','.') }
function ToInt($s){ $s=Norm $s; if($s -eq ''){return 0}; $s=$s -replace '\.','' -replace ',','.'; $d=0.0; if([double]::TryParse($s,[ref]$d)){ return [int]$d }; return 0 }
# indice do 1o header que casa (por fragmento ASCII, robusto p/ PS5.1 sem BOM)
function HdrLike($hdr,$pat){ for($i=0;$i -lt $hdr.Count;$i++){ if((Norm $hdr[$i]) -like $pat){ return $i } }; return -1 }
function Field($r,$i){ if($i -lt 0 -or $i -ge $r.Count){return ''}; return Norm $r[$i] }
function Deaccent($s){ if($null -eq $s){return ''}; $s=$s.Normalize([Text.NormalizationForm]::FormD); $sb=New-Object Text.StringBuilder
  foreach($c in $s.ToCharArray()){ if([Globalization.CharUnicodeInfo]::GetUnicodeCategory($c) -ne [Globalization.UnicodeCategory]::NonSpacingMark){ [void]$sb.Append($c) } }
  return $sb.ToString().ToLower().Trim() }
# dd/mm/yyyy (com ou sem ", HH:MM:SS") -> yyyy-mm-dd
function DateBR($s){ $s=Norm $s; if($s -match '(\d{2})[/-](\d{2})[/-](\d{4})'){ return "$($Matches[3])-$($Matches[2])-$($Matches[1])" }; return '' }
# ISO "2026-06-18T17:02:12-05:00" -> yyyy-mm-dd
function DateIso($s){ $s=Norm $s; if($s -match '^(\d{4})-(\d{2})-(\d{2})'){ return "$($Matches[1])-$($Matches[2])-$($Matches[3])" }; return '' }
function IsTest($s){ return ((Deaccent $s) -match 'test lead|dummy data') }

# ---- Leadscore (regras da aba "Lead scoring", +1 por SIM) ----------
#   +1  Cargo de conselheiro (Consultor / Diretor Executivo-C-Level / Mentor)
#   +1  Tem conhecimento sobre Conselho Consultivo (Basico / Medio / Avancado)
#   +1  Ja oferece conselhos de graca (quer passar a cobrar)
#   +1  Deseja atuar como conselheiro
#   Nota: 4=A  3=B  2=C  1=D  0=E   |   Qualificado = A+B
function Score($cargo,$nivel,$inter,$cons){
  $c=Deaccent $cargo; $n=Deaccent $nivel; $i=Deaccent $inter; $g=Deaccent $cons
  $qc=[bool]($c -match 'consultor|mentor|diretor|c-lev|clevel|c_lev')
  $qn=[bool]($n -match 'basico|medio|avancado')
  $qi=[bool]($i -match '^sim')
  $qg=[bool]($g -match '^sim')
  $s=0; if($qc){$s++}; if($qn){$s++}; if($qi){$s++}; if($qg){$s++}
  return [pscustomobject]@{ s=$s; qc=$qc; qn=$qn; qi=$qi; qg=$qg }
}
function Tier($s){ if($s -ge 4){'A'}elseif($s -eq 3){'B'}elseif($s -eq 2){'C'}elseif($s -eq 1){'D'}else{'E'} }

#  NS = lead do formulario NOVO da LP (nao tem as 4 perguntas do leadscore) -> conta como lead, mas sem nota A-E
function NewDay($d){ [pscustomobject]@{date=$d;spend=0.0;impr=0;reach=0;clicks=0;lpv=0;v3=0;v75=0;metaLeads=0;leads=0;A=0;B=0;C=0;D=0;E=0;NS=0} }
function NewNode($d,$c,$s,$a){ [pscustomobject]@{date=$d;campaign=$c;adset=$s;ad=$a;spend=0.0;impr=0;reach=0;clicks=0;lpv=0;v3=0;v75=0;metaLeads=0;leads=0;A=0;B=0;C=0;D=0;E=0;NS=0} }
function DistArr($h){ $out=@(); foreach($e in ($h.GetEnumerator()|Sort-Object Value -Descending)){ $out+=[pscustomobject]@{label=$e.Key;n=$e.Value} }; return ,@($out) }

# =====================================================================
#  Processa 1 funil (queries + leads) -> objeto com daily/grain/totais
# =====================================================================
function Build-Funnel($qCsv,$lCsvList,$kind){
  $q=Read-Csv $qCsv; $qh=$q[0]; $qd=$q[1..($q.Count-1)]

  # -- indices das queries (mesmo layout base nos 2; LP tem LPV/video, F5 tem Reach) --
  $Q_DAY=HdrLike $qh 'Day'; $Q_CAMP=HdrLike $qh 'Campaign Name'; $Q_SET=HdrLike $qh 'Ad Set Name'; $Q_AD=HdrLike $qh 'Ad Name'
  $Q_SPEND=HdrLike $qh 'Amount Spent'; $Q_IMP=HdrLike $qh 'Impressions'; $Q_CLK=HdrLike $qh 'Link Clicks'
  $Q_LPV=HdrLike $qh 'Landing Page Views'; $Q_ML=HdrLike $qh 'Leads'; $Q_REACH=HdrLike $qh 'Reach'
  $Q_V3=HdrLike $qh '3-Second Video*'; $Q_V75=HdrLike $qh 'Video Watches at 75*'

  $daily=@{}; $grain=@{}
  function GDay($d){ if(-not $daily.ContainsKey($d)){ $daily[$d]=NewDay $d }; return $daily[$d] }
  function GNode($d,$c,$s,$a){ $k="$d`u$c`u$s`u$a"; if(-not $grain.ContainsKey($k)){ $grain[$k]=NewNode $d $c $s $a }; return $grain[$k] }

  # nomes reais das queries (p/ atribuicao + fallback de adset)
  $campSet=@($qd | ForEach-Object { Field $_ $Q_CAMP } | Where-Object {$_ -ne ''} | Select-Object -Unique)
  $setSet =@($qd | ForEach-Object { Field $_ $Q_SET  } | Where-Object {$_ -ne ''} | Select-Object -Unique)
  $adSet  =@($qd | ForEach-Object { Field $_ $Q_AD   } | Where-Object {$_ -ne ''} | Select-Object -Unique)
  $campDe=@{}; foreach($c in $campSet){ $campDe[(Deaccent $c)]=$c }
  $setDe =@{}; foreach($s in $setSet ){ $setDe[(Deaccent $s)]=$s }
  $adDe  =@{}; foreach($a in $adSet  ){ $adDe[(Deaccent $a)]=$a }
  $adToSet=@{}; foreach($r in $qd){ $c=Field $r $Q_CAMP; $a=Field $r $Q_AD; $s=Field $r $Q_SET; if($a -ne ''){ $adToSet["$c`u$a"]=$s } }

  # -- gasto/impressoes por dia+leaf (lado das queries) --
  foreach($r in $qd){ $d=DateBR (Field $r $Q_DAY); if($d -eq ''){continue}
    $sp=(MoneyBR (Field $r $Q_SPEND))*$TAX; $im=ToInt(Field $r $Q_IMP); $rc=ToInt(Field $r $Q_REACH); $ck=ToInt(Field $r $Q_CLK)
    $lp=ToInt(Field $r $Q_LPV); $v3=ToInt(Field $r $Q_V3); $v75=ToInt(Field $r $Q_V75); $ml=ToInt(Field $r $Q_ML)
    $o=GDay $d; $o.spend+=$sp;$o.impr+=$im;$o.reach+=$rc;$o.clicks+=$ck;$o.lpv+=$lp;$o.v3+=$v3;$o.v75+=$v75;$o.metaLeads+=$ml
    $g=GNode $d (Field $r $Q_CAMP) (Field $r $Q_SET) (Field $r $Q_AD)
    $g.spend+=$sp;$g.impr+=$im;$g.reach+=$rc;$g.clicks+=$ck;$g.lpv+=$lp;$g.v3+=$v3;$g.v75+=$v75;$g.metaLeads+=$ml }

  $distCargo=@{}; $distArea=@{}; $distNivel=@{}
  $cntMet=@{ qc=0; qn=0; qi=0; qg=0 }   # quantos leads bateram cada criterio
  $totLeads=0; $tierTot=@{A=0;B=0;C=0;D=0;E=0;NS=0}; $attributed=0

  # processa CADA aba de leads do funil (F5 = SDC-FORM5 retroativo + FORM6-COPY novos, somados)
  foreach($lCsv in $lCsvList){
   $l=Read-Csv $lCsv; $lh=$l[0]; $ld=$l[1..($l.Count-1)]
   # -- indices dos leads (por arquivo; LP = perguntas com acento + UTM ; F5 = underscore + nomes nativos) --
   if($kind -eq 'lp'){
     $L_DATE=HdrLike $lh '*Data*'; $L_NAME=HdrLike $lh '*nome*'; $L_MAIL=HdrLike $lh '*email*'; $L_TEL=HdrLike $lh '*telefone*'
     $L_CARGO=HdrLike $lh '*cargo*'; $L_AREA=HdrLike $lh '*tua*'; $L_NIVEL=HdrLike $lh '*conhecimento*'
     $L_TAM=HdrLike $lh '*tamanho*'
     # form ANTIGO tem "conhecimento sobre Conselho Consultivo"; o NOVO (ABI) nao tem as 4 perguntas do leadscore
     $isOldForm = ($L_NIVEL -ge 0)
     if($isOldForm){
       $L_INT=HdrLike $lh '*interesse*'; $L_CONS=HdrLike $lh '*oferece*'
       $L_UCAMP=HdrLike $lh '*utm_camp*'; $L_UMED=HdrLike $lh '*utm_medium*'; $L_UCONT=HdrLike $lh '*utm_content*'
     } else {
       # NOVO form: nao pontua (perguntas do leadscore nao existem). UTMs vem nas 5 ULTIMAS colunas, SEM cabecalho:
       # [n-5]=source [n-4]=medium(adset) [n-3]=campaign [n-2]=content(ad) [n-1]=term
       $L_INT=-1; $L_CONS=-1
       $n=$lh.Count; $L_UMED=$n-4; $L_UCAMP=$n-3; $L_UCONT=$n-2
     }
   } else {
     $isOldForm = $true
     $L_DATE=HdrLike $lh '*created_time*'; $L_NAME=HdrLike $lh '*nome*'; $L_MAIL=HdrLike $lh '*email*'; $L_TEL=HdrLike $lh '*telefone*'
     $L_CARGO=HdrLike $lh '*cargo*'; $L_AREA=HdrLike $lh '*tua*'; $L_NIVEL=HdrLike $lh '*conhecimento*'
     $L_INT=HdrLike $lh '*interesse*'; $L_CONS=HdrLike $lh '*oferece*'; $L_TAM=HdrLike $lh '*tamanho*'
     $L_FCAMP=HdrLike $lh '*campaign_name*'; $L_FSET=HdrLike $lh '*adset_name*'; $L_FAD=HdrLike $lh '*ad_name*'
   }

   foreach($r in $ld){
    $cargo=Field $r $L_CARGO
    if($cargo -eq '' -and (Field $r $L_NIVEL) -eq '' -and (Field $r $L_MAIL) -eq ''){ continue }  # linha vazia
    if(IsTest $cargo){ continue }
    # testes da propria agencia (agenciaup13@...) NAO contam como lead
    if((Deaccent (Field $r $L_MAIL)) -match $AGENCY_MAIL){ continue }
    if($kind -eq 'lp'){ $d=DateBR (Field $r $L_DATE) } else { $d=DateIso (Field $r $L_DATE) }
    if($d -eq ''){ $d='sem-data' }

    if($isOldForm){
      $sc=Score $cargo (Field $r $L_NIVEL) (Field $r $L_INT) (Field $r $L_CONS); $tier=Tier $sc.s
      if($sc.qc){$cntMet.qc++}; if($sc.qn){$cntMet.qn++}; if($sc.qi){$cntMet.qi++}; if($sc.qg){$cntMet.qg++}
    } else {
      $tier='NS'   # form novo: conta como lead, mas sem nota A-E (perguntas do leadscore mudaram)
    }
    $totLeads++; $tierTot[$tier]++

    # atribuicao
    if($kind -eq 'lp'){
      $uc=Field $r $L_UCAMP; $ucD=Deaccent $uc; $isMacro=($uc -match '\{\{|\}\}')
      $camp='SEM_RASTREIO'
      if(-not $isMacro -and $uc -ne ''){ if($campSet -contains $uc){$camp=$uc}elseif($campDe.ContainsKey($ucD)){$camp=$campDe[$ucD]} }
      $ad='SEM_RASTREIO'; $uco=Field $r $L_UCONT; $ucoD=Deaccent $uco
      if($uco -ne ''){ if($adSet -contains $uco){$ad=$uco}elseif($adDe.ContainsKey($ucoD)){$ad=$adDe[$ucoD]} }
      $adset='SEM_RASTREIO'
      if($camp -ne 'SEM_RASTREIO'){
        if($adToSet.ContainsKey("$camp`u$ad")){ $adset=$adToSet["$camp`u$ad"] }
        else { $um=Field $r $L_UMED; $umD=Deaccent $um; if($setSet -contains $um){$adset=$um}elseif($setDe.ContainsKey($umD)){$adset=$setDe[$umD]} }
      }
    } else {
      $camp=Field $r $L_FCAMP; $adset=Field $r $L_FSET; $ad=Field $r $L_FAD
      if($camp -eq ''){ $camp='SEM_RASTREIO' }; if($adset -eq ''){ $adset='SEM_RASTREIO' }; if($ad -eq ''){ $ad='SEM_RASTREIO' }
    }
    if($camp -ne 'SEM_RASTREIO'){ $attributed++ }

    if($d -ne 'sem-data'){ $o=GDay $d; $o.leads++; $o.$tier++ }
    $g=GNode $d $camp $adset $ad; $g.leads++; $g.$tier++

    if($tier -eq 'A' -or $tier -eq 'B'){
      $ck=Field $r $L_CARGO; if($ck -ne ''){ if(-not $distCargo.ContainsKey($ck)){$distCargo[$ck]=0}; $distCargo[$ck]++ }
      $ak=Field $r $L_AREA;  if($ak -ne ''){ if(-not $distArea.ContainsKey($ak)){$distArea[$ak]=0}; $distArea[$ak]++ }
      $nk=Field $r $L_NIVEL; if($nk -ne ''){ if(-not $distNivel.ContainsKey($nk)){$distNivel[$nk]=0}; $distNivel[$nk]++ }
    }
   }
  }

  $dailyArr=@($daily.Values | Sort-Object date)
  $grainArr=@($grain.Values | Where-Object { $_.spend -gt 0 -or $_.leads -gt 0 } | Sort-Object date)
  $dates=@($dailyArr | Where-Object { $_.date -match '^\d{4}-\d{2}-\d{2}$' } | ForEach-Object { $_.date } | Sort-Object)
  $ldDates=@($grainArr | Where-Object { $_.date -match '^\d{4}-\d{2}-\d{2}$' -and $_.leads -gt 0 } | ForEach-Object { $_.date } | Sort-Object)

  $tot=[pscustomobject]@{
    spend=(($dailyArr|Measure-Object spend -Sum).Sum); impr=(($dailyArr|Measure-Object impr -Sum).Sum)
    reach=(($dailyArr|Measure-Object reach -Sum).Sum); clicks=(($dailyArr|Measure-Object clicks -Sum).Sum)
    lpv=(($dailyArr|Measure-Object lpv -Sum).Sum); v3=(($dailyArr|Measure-Object v3 -Sum).Sum); v75=(($dailyArr|Measure-Object v75 -Sum).Sum)
    metaLeads=(($dailyArr|Measure-Object metaLeads -Sum).Sum); leads=$totLeads
    A=$tierTot.A; B=$tierTot.B; C=$tierTot.C; D=$tierTot.D; E=$tierTot.E; NS=$tierTot.NS; attributed=$attributed
  }
  # criterios sao % sobre os leads PONTUADOS (exclui os do form novo, que nao tem as perguntas)
  $scored = $totLeads - $tierTot.NS
  $totLeadsSafe = if($scored -gt 0){$scored}else{1}
  $criteria=@(
    [pscustomobject]@{label='Cargo de conselheiro';hint='Consultor, Diretor/C-Level ou Mentor';n=$cntMet.qc;pct=[math]::Round($cntMet.qc*100.0/$totLeadsSafe,1)}
    [pscustomobject]@{label='Conhece Conselho Consultivo';hint='Basico, Medio ou Avancado';n=$cntMet.qn;pct=[math]::Round($cntMet.qn*100.0/$totLeadsSafe,1)}
    [pscustomobject]@{label='Ja da conselho (sem cobrar)';hint='Quer passar a cobrar';n=$cntMet.qg;pct=[math]::Round($cntMet.qg*100.0/$totLeadsSafe,1)}
    [pscustomobject]@{label='Deseja ser conselheiro';hint='Interesse em atuar';n=$cntMet.qi;pct=[math]::Round($cntMet.qi*100.0/$totLeadsSafe,1)}
  )

  return [pscustomobject]@{
    kind=$kind; hasLPV=($kind -eq 'lp'); hasReach=($kind -eq 'f5'); hasVideo=($kind -eq 'lp')
    dateMin=$(if($dates.Count){$dates[0]}else{''}); dateMax=$(if($dates.Count){$dates[-1]}else{''})
    leadDateMin=$(if($ldDates.Count){$ldDates[0]}else{''}); leadDateMax=$(if($ldDates.Count){$ldDates[-1]}else{''})
    totals=$tot; criteria=@($criteria)
    qualifCargo=(DistArr $distCargo); qualifArea=(DistArr $distArea); qualifNivel=(DistArr $distNivel)
    daily=@($dailyArr); grain=@($grainArr)
  }
}

# =====================================================================
#  IMERSAO — funil de VENDAS (so queries do gerenciador, sem cruzamento).
#  Metrica-chave = Purchases (compras). Imposto ×TAX no gasto. Sem leadscore.
# =====================================================================
function Build-Sales($qCsv,$kind){
  $q=Read-Csv $qCsv; $qh=$q[0]; $qd=$q[1..($q.Count-1)]
  $Q_DAY=HdrLike $qh 'Day'; $Q_CAMP=HdrLike $qh 'Campaign Name'; $Q_SET=HdrLike $qh 'Ad Set Name'; $Q_AD=HdrLike $qh 'Ad Name'
  $Q_SPEND=HdrLike $qh 'Amount Spent'; $Q_IMP=HdrLike $qh 'Impressions'; $Q_CLK=HdrLike $qh 'Link Clicks'
  $Q_LPV=HdrLike $qh 'Landing Page Views'; $Q_V3=HdrLike $qh '3-Second Video*'; $Q_PUR=HdrLike $qh 'Purchases'

  $daily=@{}; $grain=@{}
  function SDay($d){ if(-not $daily.ContainsKey($d)){ $daily[$d]=[pscustomobject]@{date=$d;spend=0.0;impr=0;clicks=0;lpv=0;v3=0;purchases=0} }; return $daily[$d] }
  function SNode($d,$c,$s,$a){ $k="$d`u$c`u$s`u$a"; if(-not $grain.ContainsKey($k)){ $grain[$k]=[pscustomobject]@{date=$d;campaign=$c;adset=$s;ad=$a;spend=0.0;impr=0;clicks=0;lpv=0;v3=0;purchases=0} }; return $grain[$k] }

  foreach($r in $qd){ $d=DateBR (Field $r $Q_DAY); if($d -eq ''){continue}
    $sp=(MoneyBR (Field $r $Q_SPEND))*$TAX; $im=ToInt(Field $r $Q_IMP); $ck=ToInt(Field $r $Q_CLK)
    $lp=ToInt(Field $r $Q_LPV); $v3=ToInt(Field $r $Q_V3); $pu=ToInt(Field $r $Q_PUR)
    $o=SDay $d; $o.spend+=$sp;$o.impr+=$im;$o.clicks+=$ck;$o.lpv+=$lp;$o.v3+=$v3;$o.purchases+=$pu
    $g=SNode $d (Field $r $Q_CAMP) (Field $r $Q_SET) (Field $r $Q_AD)
    $g.spend+=$sp;$g.impr+=$im;$g.clicks+=$ck;$g.lpv+=$lp;$g.v3+=$v3;$g.purchases+=$pu }

  $dailyArr=@($daily.Values | Sort-Object date)
  $grainArr=@($grain.Values | Where-Object { $_.spend -gt 0 -or $_.purchases -gt 0 } | Sort-Object date)
  $dates=@($dailyArr | Where-Object { $_.date -match '^\d{4}-\d{2}-\d{2}$' } | ForEach-Object { $_.date } | Sort-Object)
  $tot=[pscustomobject]@{
    spend=(($dailyArr|Measure-Object spend -Sum).Sum); impr=(($dailyArr|Measure-Object impr -Sum).Sum)
    clicks=(($dailyArr|Measure-Object clicks -Sum).Sum); lpv=(($dailyArr|Measure-Object lpv -Sum).Sum)
    v3=(($dailyArr|Measure-Object v3 -Sum).Sum); purchases=(($dailyArr|Measure-Object purchases -Sum).Sum)
  }
  return [pscustomobject]@{
    kind=$kind
    dateMin=$(if($dates.Count){$dates[0]}else{''}); dateMax=$(if($dates.Count){$dates[-1]}else{''})
    totals=$tot; daily=@($dailyArr); grain=@($grainArr)
  }
}

Write-Host "Baixando planilhas (LP q+leads; FORM5 q + 2 abas de leads; IMERSAO q)..."
$qLpCsv=Join-Path $dataDir 'q_lp.csv'; $lLpCsv=Join-Path $dataDir 'leads_lp.csv'
$qF5Csv=Join-Path $dataDir 'q_f5.csv'; $lF5Csv=Join-Path $dataDir 'leads_f5.csv'; $lF6Csv=Join-Path $dataDir 'leads_form6.csv'
$lLpNewCsv=Join-Path $dataDir 'leads_lp_new.csv'
Get-Sheet      $MASTER      $LP_Q_GID   $qLpCsv
Get-Sheet      $LP_LEADS_ID $LP_L_GID   $lLpCsv     # leads LP antigos (retroativo)
Get-Sheet      $LP_L2_ID    $LP_L2_GID  $lLpNewCsv  # leads LP novos (form ABI)
Get-Sheet      $MASTER      $F5_Q_GID   $qF5Csv
Get-Sheet      $MASTER      $F5_L_GID   $lF5Csv    # SDC-FORM5-LEADS (retroativo)
Get-SheetNamed $MASTER      $F5_L2_NAME $lF6Csv    # FORM6-COPY (novos leads)
$qImrCsv=Join-Path $dataDir 'q_imersao.csv'
Get-Sheet      $MASTER      $IMR_Q_GID  $qImrCsv   # QUERIES IMERSAO (funil de vendas)

Write-Host "Processando SALA LP (leads antigos retroativo + planilha nova)..."
$lp = Build-Funnel $qLpCsv @($lLpCsv,$lLpNewCsv) 'lp'
Write-Host "Processando SALA FORM5 (SDC-FORM5 retroativo + FORM6-COPY novos)..."
$f5 = Build-Funnel $qF5Csv @($lF5Csv,$lF6Csv) 'f5'
Write-Host "Processando IMERSAO (funil de vendas)..."
$imr = Build-Sales $qImrCsv 'imersao'

$nowIso=(Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
$nowBR =[System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow,'E. South America Standard Time').ToString('dd/MM/yyyy HH:mm')
$utf8=[System.Text.UTF8Encoding]::new($false)

$payload=[pscustomobject]@{
  generatedAt=$nowIso; generatedAtBR=$nowBR; taxMultiplier=$TAX
  scoring=@(
    [pscustomobject]@{label='Cargo de conselheiro (Consultor / Diretor-C-Level / Mentor)';pts=1}
    [pscustomobject]@{label='Conhece Conselho Consultivo (Basico / Medio / Avancado)';pts=1}
    [pscustomobject]@{label='Ja oferece conselhos de graca (quer cobrar)';pts=1}
    [pscustomobject]@{label='Deseja atuar como conselheiro';pts=1}
  )
  tiers=@(
    [pscustomobject]@{tier='A';label='Quente';min=4}
    [pscustomobject]@{tier='B';label='Morno';min=3}
    [pscustomobject]@{tier='C';label='Medio';min=2}
    [pscustomobject]@{tier='D';label='Frio';min=1}
    [pscustomobject]@{tier='E';label='Desqualificado';min=0}
  )
  lp=$lp; form5=$f5; imersao=$imr
}
$json=$payload | ConvertTo-Json -Depth 12 -Compress
[IO.File]::WriteAllText((Join-Path $root 'data.js'), ("window.SALA="+$json+";"), $utf8)
Write-Host ("OK  LP: leads={0} A={1} B={2} spend=R$ {3}  |  FORM5: leads={4} A={5} B={6} spend=R$ {7}  |  IMERSAO: vendas={8} spend=R$ {9}" -f `
  $lp.totals.leads,$lp.totals.A,$lp.totals.B,($lp.totals.spend.ToString('N2',$BR)),`
  $f5.totals.leads,$f5.totals.A,$f5.totals.B,($f5.totals.spend.ToString('N2',$BR)),`
  $imr.totals.purchases,($imr.totals.spend.ToString('N2',$BR)))
