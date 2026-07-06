/* SALA | GIACO — 2 funis (LP + FORM5) numa dash · render puro SVG sobre window.SALA */
(function(){
'use strict';
var D = window.SALA || {};
var arr = function(x){ return Array.isArray(x) ? x : (x ? [x] : []); };
var clamp = function(x){ return Math.max(0, Math.min(1, x)); };
var nf0 = new Intl.NumberFormat('pt-BR');
var nf1 = new Intl.NumberFormat('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});
var nf2 = new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
var nf4 = new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:4});
var money = function(v){ return 'R$ ' + nf2.format(v||0); };
var money0 = function(v){ return 'R$ ' + nf0.format(Math.round(v||0)); };
var intf = function(v){ return nf0.format(Math.round(v||0)); };
var pct = function(v){ return nf1.format(v||0) + '%'; };
var dv = function(a,b){ return b>0 ? a/b : 0; };
function isDate(x){ return /^\d{4}-\d{2}-\d{2}$/.test(x); }
function fmtBR(iso){ if(!isDate(iso)) return iso; var p=iso.split('-'); return p[2]+'/'+p[1]; }
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }
function addDays(iso,n){ var p=iso.split('-'); var dt=new Date(Date.UTC(+p[0],+p[1]-1,+p[2])); dt.setUTCDate(dt.getUTCDate()+n); return dt.toISOString().slice(0,10); }
function daysBetween(a,b){ var pa=a.split('-'),pb=b.split('-'); return Math.round((Date.UTC(+pb[0],+pb[1]-1,+pb[2])-Date.UTC(+pa[0],+pa[1]-1,+pa[2]))/86400000); }
function inRange(dt,r){ return dt>=r[0] && dt<=r[1]; }
/* limpa rótulos underscore/minúsculo dos forms nativos p/ exibição */
function prettify(s){ if(s==null) return ''; s=String(s).replace(/_/g,' ').replace(/\s*\/\s*/g,' / ').replace(/\s+/g,' ').trim();
  if(s==='') return ''; return s.split(' ').map(function(w){ return w ? w.charAt(0).toUpperCase()+w.slice(1) : w; }).join(' '); }
var TC={A:'#e8b64a',B:'#34d3b0',C:'#5b9bf0',D:'#8b93a7',E:'#4a5169'};

var PRESETS = [
  {k:'hoje',label:'Hoje'},{k:'ontem',label:'Ontem'},{k:'7d',label:'7 dias'},
  {k:'30d',label:'30 dias'},{k:'leads',label:'Período dos leads'},{k:'tudo',label:'Tudo'}
];

/* tooltip global dos gráficos */
var _tip=null;
function tipEl(){ if(!_tip){ _tip=document.createElement('div'); _tip.className='chart-tip'; _tip.style.display='none'; document.body.appendChild(_tip); } return _tip; }
function tipShow(html,x,y){ var t=tipEl(); t.innerHTML=html; t.style.display='block'; var w=t.offsetWidth,h=t.offsetHeight,nx=x+14,ny=y+14;
  if(nx+w>window.innerWidth-8) nx=x-w-14; if(ny+h>window.innerHeight-8) ny=y-h-14; t.style.left=Math.max(6,nx)+'px'; t.style.top=Math.max(6,ny)+'px'; }
function tipHide(){ if(_tip) _tip.style.display='none'; }

function cplClass(v,lo,hi){ if(v==null||!isFinite(v)||v<=0) return 'cpl-n'; if(v<=lo) return 'cpl-g'; if(v<=hi) return 'cpl-a'; return 'cpl-r'; }
function heatBg(rgb,frac){ return 'background:rgba('+rgb+','+(0.10+0.42*clamp(frac)).toFixed(3)+')'; }
function trendHTML(cur, prev, higherBetter){
  if(prev==null || !isFinite(prev) || prev===0 || !isFinite(cur)) return '';
  var ch=(cur-prev)/Math.abs(prev)*100; if(Math.abs(ch)<0.1) return '';
  var up=ch>0, good = higherBetter?up:!up;
  return '<span class="trend '+(good?'up':'down')+'">'+(up?'▲':'▼')+' '+nf1.format(Math.abs(ch))+'%</span>';
}

/* donut reutilizável (nível de módulo) */
function donutHTML(frac,color,cv,cl,size){ size=size||160; var sw=15,r=(size-sw)/2,cx=size/2,c=2*Math.PI*r,off=c*(1-clamp(frac));
  return '<div class="gauge" style="width:'+size+'px;height:'+size+'px"><svg width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'">'
    +'<circle cx="'+cx+'" cy="'+cx+'" r="'+r+'" fill="none" stroke="#1d2740" stroke-width="'+sw+'"/>'
    +'<circle cx="'+cx+'" cy="'+cx+'" r="'+r+'" fill="none" stroke="'+color+'" stroke-width="'+sw+'" stroke-linecap="round" stroke-dasharray="'+c+'" stroke-dashoffset="'+off+'" transform="rotate(-90 '+cx+' '+cx+')"/></svg>'
    +'<div class="gauge-num"><span class="g-val" style="color:'+color+'">'+cv+'</span><span class="g-lab" style="color:'+color+'">'+cl+'</span></div></div>'; }
/* funde distribuições de perfil de LP + FORM5 por rótulo normalizado */
function normKey(s){ return prettify(s).toLowerCase().replace(/[^a-zà-ú0-9]+/g,' ').trim().split(' ').filter(Boolean).sort().join(' '); }
function mergeDist(){ var m={},order=[]; for(var i=0;i<arguments.length;i++){ arr(arguments[i]).forEach(function(x){ var k=normKey(x.label); if(k===''){return;} if(!m[k]){m[k]={label:prettify(x.label),n:0}; order.push(k);} m[k].n+=(x.n||0); }); }
  return order.map(function(k){return m[k];}).sort(function(x,y){return y.n-x.n;}); }

/* =====================================================================
   FUNNEL FACTORY — renderiza um funil completo em elementos key-prefixados
   ===================================================================== */
function Funnel(key, fd){
  var CFG={ lpv:!!fd.hasLPV, reach:!!fd.hasReach, video:!!fd.hasVideo };
  var midLabel = CFG.reach ? 'Alcance' : 'Landing Page Views';
  var daily = arr(fd.daily), grain = arr(fd.grain);
  var allDates = daily.map(function(d){return d.date;}).filter(isDate).sort();
  var maxDate = fd.dateMax || allDates[allDates.length-1] || '';
  var minDate = fd.dateMin || allDates[0] || '';
  var period='tudo', customRange=null, sub='traf', treeExpanded={}, treeInited=false;
  function q(id){ return document.getElementById(key+'-'+id); }

  function rangeFor(k){
    if(k==='custom' && customRange) return customRange;
    if(k==='tudo')  return [minDate, maxDate];
    if(k==='hoje')  return [maxDate, maxDate];
    if(k==='ontem'){ var y=addDays(maxDate,-1); return [y,y]; }
    if(k==='7d')    return [addDays(maxDate,-6),  maxDate];
    if(k==='30d')   return [addDays(maxDate,-29), maxDate];
    if(k==='leads') return [fd.leadDateMin||minDate, fd.leadDateMax||maxDate];
    return [minDate, maxDate];
  }
  function prevRange(rng){ var len=daysBetween(rng[0],rng[1])+1; var pe=addDays(rng[0],-1); return [addDays(pe,-(len-1)), pe]; }
  var METS=['spend','impr','reach','clicks','lpv','v3','v75','metaLeads','leads','A','B','C','D','E'];
  function aggDaily(rng){ var o={}; METS.forEach(function(k){o[k]=0;});
    daily.forEach(function(d){ if(!inRange(d.date,rng))return; METS.forEach(function(k){o[k]+=(d[k]||0);}); }); return o; }
  function daysInRange(rng){ return daily.filter(function(d){return isDate(d.date)&&inRange(d.date,rng);}).sort(function(a,b){return a.date.localeCompare(b.date);}); }

  function getMeta(){ var v=parseFloat(localStorage.getItem('sala_'+key+'_meta')); return (isFinite(v)&&v>0)?v:2000; }
  function setMeta(v){ localStorage.setItem('sala_'+key+'_meta', v); }

  /* ---------- KPI COLUMN ---------- */
  function subRow(l,v,tr){ return '<div class="sub-row"><span class="s-l">'+l+'</span><span class="s-v">'+v+(tr||'')+'</span></div>'; }
  function kpiCard(hl,label,val,subs){
    return '<div class="kpi-card'+(hl?' hl':'')+'"><div class="kpi-main"><div class="m-lab">'+label+'</div><div class="m-val">'+val+'</div></div>'
      +'<div class="kpi-sub">'+subs+'</div></div>';
  }
  function renderKpiCol(a,p){
    var qy=a.A+a.B, pq=p.A+p.B;
    var meta=getMeta(), goal = meta>0 ? a.spend/meta*100 : 0;
    var hero='<div class="kpi-hero"><div class="h-top"><div><div class="h-lab">Investimento com imposto</div>'
      +'<div class="h-val">'+money(a.spend)+'</div></div>'
      +'<div class="meta-inp">Meta R$ <input id="'+key+'-metaInp" type="number" min="0" step="500" value="'+meta+'"></div></div>'
      +'<div class="goal-wrap"><div class="goal-track"><span style="width:'+Math.min(100,goal).toFixed(1)+'%"></span></div>'
      +'<div class="goal-meta"><span class="goal-pct">'+pct(goal)+' da meta</span><span>Meta '+money0(meta)+'</span></div></div></div>';
    var cards='';
    cards+=kpiCard(false,'Impressões',intf(a.impr),
      subRow('CPM', money(dv(a.spend,a.impr)*1000), trendHTML(dv(a.spend,a.impr)*1000, dv(p.spend,p.impr)*1000, false))
      + subRow('CTR', pct(dv(a.clicks,a.impr)*100), trendHTML(dv(a.clicks,a.impr), dv(p.clicks,p.impr), true)));
    if(CFG.reach){
      cards+=kpiCard(false,'Alcance',intf(a.reach),
        subRow('Frequência', nf1.format(dv(a.impr,a.reach))+'x', '')
        + subRow('Custo/mil alcance', money(dv(a.spend,a.reach)*1000), trendHTML(dv(a.spend,a.reach)*1000, dv(p.spend,p.reach)*1000, false)));
    }
    cards+=kpiCard(false,'Cliques no link',intf(a.clicks),
      subRow('CPC', money(dv(a.spend,a.clicks)), trendHTML(dv(a.spend,a.clicks), dv(p.spend,p.clicks), false))
      + subRow(CFG.lpv?'CR clique→LP':'CR clique→Lead', pct(dv(CFG.lpv?a.lpv:a.leads,a.clicks)*100), trendHTML(dv(CFG.lpv?a.lpv:a.leads,a.clicks), dv(CFG.lpv?p.lpv:p.leads,p.clicks), true)));
    if(CFG.lpv){
      cards+=kpiCard(false,'Landing Page Views',intf(a.lpv),
        subRow('CPV', money(dv(a.spend,a.lpv)), trendHTML(dv(a.spend,a.lpv), dv(p.spend,p.lpv), false))
        + subRow('Conv. LP→Lead', pct(dv(a.leads,a.lpv)*100), trendHTML(dv(a.leads,a.lpv), dv(p.leads,p.lpv), true)));
    }
    cards+=kpiCard(true,'Leads',intf(a.leads),
      subRow('CPL', money(dv(a.spend,a.leads)), trendHTML(dv(a.spend,a.leads), dv(p.spend,p.leads), false))
      + subRow('Taxa de qualificação', pct(dv(qy,a.leads)*100), trendHTML(dv(qy,a.leads), dv(pq,p.leads), true))
      + subRow('Meta reportou', '<small>'+intf(a.metaLeads)+' leads</small>',''));
    var cplQ=dv(a.spend,qy), tgt=120, barW=Math.min(100, tgt>0?cplQ/tgt*100:0), barC = cplQ<=tgt?'var(--good)':(cplQ<=tgt*2?'var(--warn)':'var(--bad)');
    cards+=kpiCard(true,'Leads Qualificados (A+B)',intf(qy),
      subRow('CPL Qualificado', qy?money(cplQ):'—', trendHTML(cplQ, dv(p.spend,pq), false))
      + subRow('Composição', '<small><b style="color:var(--A)">'+a.A+' A</b> · <b style="color:var(--B)">'+a.B+' B</b></small>','')
      + '<div class="mini-bar"><span style="width:'+barW.toFixed(0)+'%;background:'+barC+'"></span></div>'
      + '<div class="goal-meta"><span>CPL Qualif vs ref. R$ '+tgt+'</span></div>');
    q('kpiCol').innerHTML = hero + cards;
    var mi=q('metaInp'); if(mi){ mi.addEventListener('change',function(){ var v=parseFloat(mi.value); if(isFinite(v)&&v>0){ setMeta(v); renderKpiCol(a,p);} }); }
  }

  /* ---------- CHARTS ---------- */
  function xticks(days){ var n=days.length; if(n<=1) return [0]; var step=Math.max(1,Math.round(n/7)); var t=[]; for(var i=0;i<n;i+=step)t.push(i); if(t[t.length-1]!==n-1)t.push(n-1); return t; }
  function hitRects(days,pl,gw,pt,ph){ var s=''; for(var i=0;i<days.length;i++){ s+='<rect class="hit" data-i="'+i+'" x="'+(pl+gw*i).toFixed(1)+'" y="'+pt+'" width="'+gw.toFixed(1)+'" height="'+ph+'" fill="transparent" pointer-events="all"/>'; } return s; }
  function bindHits(id,days,fmt){ var c=q(id); if(!c) return;
    Array.prototype.forEach.call(c.querySelectorAll('.hit'),function(r){
      r.addEventListener('mousemove',function(e){ var i=+r.getAttribute('data-i'); if(days[i]) tipShow(fmt(days[i]),e.clientX,e.clientY); });
      r.addEventListener('mouseleave',tipHide); }); }
  function tipLeads(d){ var qy=d.A+d.B;
    return '<div class="tt-d">'+fmtBR(d.date)+'</div>'
      +'<div class="tt-r"><span style="color:var(--muted)">Leads</span><b>'+intf(d.leads)+'</b></div>'
      +'<div class="tt-r"><span style="color:var(--gold2)">Qualificados A+B</span><b>'+intf(qy)+'</b></div>'
      +'<div class="tt-sub">A '+d.A+' · B '+d.B+' · C '+d.C+' · D '+d.D+' · E '+d.E+'</div>'; }
  function tipInvest(d){ var qy=d.A+d.B;
    return '<div class="tt-d">'+fmtBR(d.date)+'</div>'
      +'<div class="tt-r"><span style="color:var(--gold2)">Investimento</span><b>'+money0(d.spend)+'</b></div>'
      +'<div class="tt-r"><span style="color:var(--teal)">CPL Qualificado</span><b>'+(qy>0?money(dv(d.spend,qy)):'—')+'</b></div>'
      +'<div class="tt-sub">Leads '+intf(d.leads)+' · Qualif '+intf(qy)+' · CPM '+money(dv(d.spend,d.impr)*1000)+'</div>'; }
  function renderChartLeads(days){
    var W=600,H=210,pl=30,pr=10,pt=12,pb=22,pw=W-pl-pr,ph=H-pt-pb,base=pt+ph;
    var maxL=Math.max.apply(null,days.map(function(d){return d.leads||0;}).concat([1]));
    var n=days.length||1,gw=pw/n,bw=Math.max(2,Math.min(13,gw*0.34));
    var s='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">';
    [0,0.5,1].forEach(function(f){ var y=pt+ph*(1-f); s+='<line x1="'+pl+'" y1="'+y+'" x2="'+(W-pr)+'" y2="'+y+'" stroke="#1f2942" stroke-dasharray="2 3"/>'; s+='<text x="'+(pl-4)+'" y="'+(y+3)+'" text-anchor="end" fill="#616b85" font-size="9">'+Math.round(maxL*f)+'</text>'; });
    days.forEach(function(d,i){ var xc=pl+gw*i+gw/2, lh=ph*dv(d.leads,maxL), qh=ph*dv((d.A+d.B),maxL);
      if(d.leads>0) s+='<rect x="'+(xc-bw-1).toFixed(1)+'" y="'+(base-lh).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+lh.toFixed(1)+'" rx="1.5" fill="rgba(139,149,173,.45)"/>';
      if((d.A+d.B)>0) s+='<rect x="'+(xc+1).toFixed(1)+'" y="'+(base-qh).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+qh.toFixed(1)+'" rx="1.5" fill="url(#'+key+'g1)"/>';
    });
    s='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="'+key+'g1" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#34d3b0"/><stop offset="1" stop-color="#e8b64a"/></linearGradient></defs>'+s.slice(s.indexOf('>')+1);
    xticks(days).forEach(function(i){ var xc=pl+gw*i+gw/2; s+='<text x="'+xc.toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" fill="#616b85" font-size="9">'+fmtBR(days[i].date)+'</text>'; });
    s+=hitRects(days,pl,gw,pt,ph)+'</svg>';
    q('chartLeads').innerHTML='<div class="chart">'+s+'</div><div class="chart-legend"><span><span class="dot" style="background:rgba(139,149,173,.6)"></span>Leads</span><span><span class="dot" style="background:var(--gold)"></span>Qualificados (A+B)</span></div>';
    bindHits('chartLeads',days,tipLeads);
  }
  function renderChartInvest(days){
    var W=600,H=210,pl=34,pr=38,pt=12,pb=22,pw=W-pl-pr,ph=H-pt-pb,base=pt+ph;
    var maxS=Math.max.apply(null,days.map(function(d){return d.spend||0;}).concat([1]));
    var cpls=days.map(function(d){ var qy=d.A+d.B; return qy>0?dv(d.spend,qy):null; });
    var maxC=Math.max.apply(null,cpls.filter(function(x){return x!=null;}).concat([1]));
    var n=days.length||1,gw=pw/n,bw=Math.max(2,Math.min(15,gw*0.55));
    var s='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">';
    [0,0.5,1].forEach(function(f){ var y=pt+ph*(1-f); s+='<line x1="'+pl+'" y1="'+y+'" x2="'+(W-pr)+'" y2="'+y+'" stroke="#1f2942" stroke-dasharray="2 3"/>';
      s+='<text x="'+(pl-4)+'" y="'+(y+3)+'" text-anchor="end" fill="#616b85" font-size="9">'+Math.round(maxS*f)+'</text>';
      s+='<text x="'+(W-pr+4)+'" y="'+(y+3)+'" text-anchor="start" fill="#34d3b0" font-size="9">'+Math.round(maxC*f)+'</text>'; });
    days.forEach(function(d,i){ var xc=pl+gw*i+gw/2, sh=ph*dv(d.spend,maxS);
      if(d.spend>0) s+='<rect x="'+(xc-bw/2).toFixed(1)+'" y="'+(base-sh).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+sh.toFixed(1)+'" rx="1.5" fill="rgba(232,182,74,.34)"/>'; });
    var pts=[]; days.forEach(function(d,i){ if(cpls[i]!=null){ var xc=pl+gw*i+gw/2, y=base-ph*dv(cpls[i],maxC); pts.push([xc,y]); } });
    if(pts.length>1){ var dpath='M'+pts.map(function(pp){return pp[0].toFixed(1)+' '+pp[1].toFixed(1);}).join(' L'); s+='<path d="'+dpath+'" fill="none" stroke="#34d3b0" stroke-width="2"/>'; }
    pts.forEach(function(pp){ s+='<circle cx="'+pp[0].toFixed(1)+'" cy="'+pp[1].toFixed(1)+'" r="2.6" fill="#34d3b0"/>'; });
    xticks(days).forEach(function(i){ var xc=pl+gw*i+gw/2; s+='<text x="'+xc.toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" fill="#616b85" font-size="9">'+fmtBR(days[i].date)+'</text>'; });
    s+=hitRects(days,pl,gw,pt,ph)+'</svg>';
    q('chartInvest').innerHTML='<div class="chart">'+s+'</div><div class="chart-legend"><span><span class="dot" style="background:rgba(232,182,74,.5)"></span>Investimento</span><span><span class="ln" style="background:#34d3b0"></span>CPL Qualificado</span></div>';
    bindHits('chartInvest',days,tipInvest);
  }

  /* ---------- DAILY HEATMAP ---------- */
  function renderDaily(rng){
    var rows=daysInRange(rng).slice().sort(function(a,b){return b.date.localeCompare(a.date);});
    var maxS=Math.max.apply(null,rows.map(function(r){return r.spend||0;}).concat([1]));
    var maxL=Math.max.apply(null,rows.map(function(r){return r.leads||0;}).concat([1]));
    var maxQ=Math.max.apply(null,rows.map(function(r){return (r.A+r.B)||0;}).concat([1]));
    var maxM=Math.max.apply(null,rows.map(function(r){return (CFG.reach?r.reach:r.lpv)||0;}).concat([1]));
    var head='<thead><tr><th>Dia</th><th>Gasto</th><th>'+midLabel+'</th><th>Leads</th><th>A</th><th>B</th><th>Qualif</th><th>%Qualif</th><th>CPL Qualif</th><th>CPM</th></tr></thead>';
    var body=rows.map(function(r){
      var qy=r.A+r.B, taxaQ=dv(qy,r.leads)*100, cplQ=qy>0?dv(r.spend,qy):null, cpm=dv(r.spend,r.impr)*1000, midv=CFG.reach?r.reach:r.lpv;
      return '<tr><td>'+fmtBR(r.date)+'</td>'
        +'<td class="num"><span class="heatcell" style="'+heatBg('232,182,74',r.spend/maxS)+'">'+money0(r.spend)+'</span></td>'
        +'<td class="num"><span class="heatcell" style="'+heatBg('91,155,240',midv/maxM)+'">'+intf(midv)+'</span></td>'
        +'<td class="num"><span class="heatcell" style="'+heatBg('139,149,173',r.leads/maxL)+'">'+intf(r.leads)+'</span></td>'
        +'<td class="num">'+(r.A?'<span class="pillA">'+r.A+'</span>':'·')+'</td>'
        +'<td class="num">'+(r.B?'<span class="pillB">'+r.B+'</span>':'·')+'</td>'
        +'<td class="num"><span class="heatcell" style="'+heatBg('52,211,176',qy/maxQ)+'">'+(qy||'·')+'</span></td>'
        +'<td class="num">'+(r.leads?'<span class="heatcell" style="'+heatBg('52,211,176',taxaQ/100)+'">'+pct(taxaQ)+'</span>':'—')+'</td>'
        +'<td class="num">'+(cplQ!=null?'<span class="cpl-pill '+cplClass(cplQ,60,150)+'">'+money0(cplQ)+'</span>':'—')+'</td>'
        +'<td class="num">'+money(cpm)+'</td></tr>';
    }).join('');
    if(!rows.length) body='<tr><td colspan="10" class="empty">Sem dados no período.</td></tr>';
    q('dailyTbl').innerHTML=head+'<tbody>'+body+'</tbody>';
  }

  /* ---------- OTIMIZAÇÃO (árvore) ---------- */
  function prettyNode(c){ return c==='SEM_RASTREIO' ? '— sem rastreio —' : c; }
  function newNode(name,full){ return {name:name,full:full,spend:0,impr:0,clicks:0,lpv:0,leads:0,A:0,B:0,C:0,D:0,E:0,kids:{}}; }
  function accum(n,r){ n.spend+=r.spend||0;n.impr+=r.impr||0;n.clicks+=r.clicks||0;n.lpv+=r.lpv||0;n.leads+=r.leads||0;n.A+=r.A||0;n.B+=r.B||0;n.C+=r.C||0;n.D+=r.D||0;n.E+=r.E||0; }
  function buildTree(rows){ var c={}; rows.forEach(function(r){
    var cn=c[r.campaign]||(c[r.campaign]=newNode(prettyNode(r.campaign),r.campaign)); accum(cn,r);
    var sn=cn.kids[r.adset]||(cn.kids[r.adset]=newNode(prettyNode(r.adset),r.adset)); accum(sn,r);
    var an=sn.kids[r.ad]||(sn.kids[r.ad]=newNode(prettyNode(r.ad),r.ad)); accum(an,r); }); return c; }
  function metricsCells(n){ var qy=n.A+n.B, taxaQ=dv(qy,n.leads)*100, cplQ=qy>0?dv(n.spend,qy):null, ctr=dv(n.clicks,n.impr)*100;
    return '<td class="num">'+money0(n.spend)+'</td>'
      +'<td class="num">'+intf(n.leads)+'</td>'
      +'<td class="num">'+(n.A?'<span class="pillA">'+n.A+'</span>':'·')+'</td>'
      +'<td class="num">'+(n.B?'<span class="pillB">'+n.B+'</span>':'·')+'</td>'
      +'<td class="num qcell">'+(qy||'·')+'</td>'
      +'<td class="num">'+(n.leads?pct(taxaQ):'—')+'</td>'
      +'<td class="num">'+(cplQ!=null?'<span class="cpl-pill '+cplClass(cplQ,60,150)+'">'+money0(cplQ)+'</span>':'—')+'</td>'
      +'<td class="num">'+pct(ctr)+'</td>'; }
  function treeRow(n,lvl,tkey,hasKids){
    var caret=hasKids?'<span class="caret'+(treeExpanded[tkey]?' open':'')+'">▶</span>':'<span class="caret" style="opacity:.2">•</span>';
    return '<tr class="lvl'+lvl+(hasKids?' parent':'')+'" data-key="'+encodeURIComponent(tkey)+'">'
      +'<td><span class="name" title="'+esc(n.full||n.name)+'">'+caret+' '+esc(n.name)+'</span></td>'+metricsCells(n)+'</tr>';
  }
  function sortKids(obj){ return Object.keys(obj).sort(function(x,y){ return (obj[y].A+obj[y].B)-(obj[x].A+obj[x].B) || obj[y].spend-obj[x].spend; }); }
  function renderTree(rng){
    var rows=grain.filter(function(r){return inRange(r.date,rng);});
    var camps=buildTree(rows), order=sortKids(camps);
    if(!treeInited){ order.forEach(function(cK){ treeExpanded['c:'+cK]=true; }); treeInited=true; }
    var head='<thead><tr><th>Campanha › Conjunto › Anúncio</th><th>Gasto</th><th>Leads</th><th>A</th><th>B</th><th>Qualif</th><th>%Qualif</th><th>CPL Qualif</th><th>CTR</th></tr></thead>';
    var out=[];
    order.forEach(function(cK){ var c=camps[cK],cKey='c:'+cK,cHas=Object.keys(c.kids).length>0; out.push(treeRow(c,0,cKey,cHas));
      if(treeExpanded[cKey]){ sortKids(c.kids).forEach(function(sK){ var sN=c.kids[sK],sKey=cKey+'|s:'+sK,sHas=Object.keys(sN.kids).length>0; out.push(treeRow(sN,1,sKey,sHas));
        if(treeExpanded[sKey]){ sortKids(sN.kids).forEach(function(aK){ out.push(treeRow(sN.kids[aK],2,sKey+'|a:'+aK,false)); }); } }); } });
    if(!out.length) out.push('<tr><td colspan="9" class="empty">Sem dados no período.</td></tr>');
    q('treeTbl').innerHTML=head+'<tbody>'+out.join('')+'</tbody>';
    q('treeLegend').innerHTML='<span><span class="dot" style="background:var(--A)"></span>Leadscore A</span>'
      +'<span><span class="dot" style="background:var(--B)"></span>Leadscore B</span>'
      +'<span><span class="dot" style="background:#1f9c73"></span>CPL Qualif barato</span>'
      +'<span><span class="dot" style="background:#c23b52"></span>CPL Qualif caro</span>'
      +'<span style="color:var(--muted2)">ordenado por quem traz mais lead qualificado</span>';
    Array.prototype.forEach.call(q('treeTbl').querySelectorAll('tr.parent'),function(tr){
      tr.addEventListener('click',function(){ var k=decodeURIComponent(tr.getAttribute('data-key')); treeExpanded[k]=!treeExpanded[k]; renderTree(rangeFor(period)); }); });
  }

  /* ---------- LEADSCORE ---------- */
  function donut(frac,color,cv,cl,size){ size=size||150; var sw=14,r=(size-sw)/2,cx=size/2,c=2*Math.PI*r,off=c*(1-clamp(frac));
    return '<div class="gauge" style="width:'+size+'px;height:'+size+'px"><svg width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'">'
      +'<circle cx="'+cx+'" cy="'+cx+'" r="'+r+'" fill="none" stroke="#1d2740" stroke-width="'+sw+'"/>'
      +'<circle cx="'+cx+'" cy="'+cx+'" r="'+r+'" fill="none" stroke="'+color+'" stroke-width="'+sw+'" stroke-linecap="round" stroke-dasharray="'+c+'" stroke-dashoffset="'+off+'" transform="rotate(-90 '+cx+' '+cx+')"/></svg>'
      +'<div class="gauge-num"><span class="g-val" style="color:'+color+'">'+cv+'</span><span class="g-lab" style="color:'+color+'">'+cl+'</span></div></div>'; }
  function renderScore(a){
    var qy=a.A+a.B, total=a.leads, qFrac=dv(qy,total);
    q('scoreGauge').innerHTML=donut(qFrac,'#e8b64a',total?pct(qFrac*100):'—','qualif A+B',150);
    var tiers=[['A','Quente',a.A],['B','Morno',a.B],['C','Médio',a.C],['D','Frio',a.D],['E','Desq.',a.E]];
    var maxT=Math.max.apply(null,tiers.map(function(t){return t[2];}).concat([1]));
    q('scoreBars').innerHTML=tiers.map(function(t){ var w=t[2]>0?Math.max(4,t[2]/maxT*100):0;
      return '<div class="hl-row"><span class="hl-k"><b style="color:'+TC[t[0]]+'">'+t[0]+'</b> '+t[1]+'</span><span class="hl-bar"><span style="width:'+w+'%;background:'+TC[t[0]]+'"></span></span><span class="hl-v">'+intf(t[2])+(total?' · '+pct(dv(t[2],total)*100):'')+'</span></div>'; }).join('');
    q('scoringRules').innerHTML=arr(D.scoring).map(function(s){ var pos=s.pts>=0; return '<div class="rule"><span>'+esc(s.label)+'</span><span class="pts '+(pos?'pos':'neg')+'">'+(pos?'+':'')+s.pts+'</span></div>'; }).join('');
    q('tierRules').innerHTML='<div class="tier-rules">'+arr(D.tiers).map(function(t){ var col=TC[t.tier];
      var rng=(t.tier==='A')?'4/4':(t.tier==='E')?'0/4':(t.min+'/4');
      return '<div class="tier-chip"><div class="t" style="color:'+col+'">'+t.tier+'</div><div class="l">'+t.label+'</div><div class="r">'+rng+'</div></div>'; }).join('')+'</div>';
    // critérios (base completa)
    q('criteria').innerHTML=arr(fd.criteria).map(function(cr){ var w=Math.max(3,cr.pct);
      return '<div class="crit"><div class="crit-top"><span class="cl">'+esc(cr.label)+'<small>'+esc(cr.hint)+'</small></span><span class="cn">'+intf(cr.n)+' <small>('+pct(cr.pct)+')</small></span></div><div class="crit-track"><span style="width:'+w+'%"></span></div></div>'; }).join('');
    q('qualifBreak').innerHTML=qbBlock('Cargo',arr(fd.qualifCargo))+qbBlock('Área de atuação',arr(fd.qualifArea))+qbBlock('Conhecimento sobre conselho',arr(fd.qualifNivel));
    renderAdRank(rangeFor(period));
  }
  function qbBlock(title,list){ var max=Math.max.apply(null,list.map(function(x){return x.n;}).concat([1]));
    var bars=list.length?list.map(function(x){ var lab=prettify(x.label); return '<div class="qbar"><div class="qbar-top"><span class="l" title="'+esc(lab)+'">'+esc(lab)+'</span><span class="n">'+x.n+'</span></div><div class="qbar-track"><span style="width:'+Math.max(6,x.n/max*100)+'%"></span></div></div>'; }).join(''):'<div class="empty">Sem qualificados ainda.</div>';
    return '<div><div class="qb-h">'+title+'</div>'+bars+'</div>'; }
  function renderAdRank(rng){
    var rows=grain.filter(function(r){return inRange(r.date,rng)&&r.ad!=='SEM_RASTREIO';}), ads={};
    rows.forEach(function(r){ var k=r.ad+'##'+r.campaign; var n=ads[k]||(ads[k]={ad:prettyNode(r.ad),camp:r.campaign,spend:0,leads:0,A:0,B:0}); n.spend+=r.spend||0;n.leads+=r.leads||0;n.A+=r.A||0;n.B+=r.B||0; });
    var list=Object.keys(ads).map(function(k){return ads[k];}).filter(function(n){return n.leads>0;}).sort(function(x,y){return (y.A+y.B)-(x.A+x.B)||y.A-x.A;});
    var head='<thead><tr><th>Anúncio</th><th>Campanha</th><th>Gasto</th><th>Leads</th><th>A</th><th>B</th><th>Qualif</th><th>CPL Qualif</th></tr></thead>';
    var body=list.map(function(n){ var qy=n.A+n.B, cplQ=qy>0?dv(n.spend,qy):null;
      return '<tr><td>'+esc(n.ad)+'</td><td style="color:var(--muted)"><span class="name" title="'+esc(n.camp)+'">'+esc(n.camp)+'</span></td>'
        +'<td class="num">'+money0(n.spend)+'</td><td class="num">'+intf(n.leads)+'</td>'
        +'<td class="num">'+(n.A?'<span class="pillA">'+n.A+'</span>':'·')+'</td><td class="num">'+(n.B?'<span class="pillB">'+n.B+'</span>':'·')+'</td>'
        +'<td class="num qcell">'+(qy||'·')+'</td><td class="num">'+(cplQ!=null?'<span class="cpl-pill '+cplClass(cplQ,60,150)+'">'+money0(cplQ)+'</span>':'—')+'</td></tr>'; }).join('');
    if(!list.length) body='<tr><td colspan="8" class="empty">Nenhum lead rastreado no período.</td></tr>';
    q('adRankTbl').innerHTML=head+'<tbody>'+body+'</tbody>';
  }

  /* ---------- CHROME (período + subnav) ---------- */
  function periodsHTML(){
    return PRESETS.map(function(p){return '<button data-k="'+p.k+'" class="pbtn">'+p.label+'</button>';}).join('')
      + '<span class="daterange" id="'+key+'-daterange"><span class="dr-l">De</span> <input type="date" id="'+key+'-dtDe" min="'+minDate+'" max="'+maxDate+'"> <span class="dr-l">até</span> <input type="date" id="'+key+'-dtAte" min="'+minDate+'" max="'+maxDate+'"></span>';
  }
  function syncPeriodUI(){
    var rng=rangeFor(period);
    Array.prototype.forEach.call(q('periods').querySelectorAll('.pbtn'),function(b){ b.classList.toggle('on', period===b.getAttribute('data-k')); });
    var drEl=q('daterange'); if(drEl) drEl.classList.toggle('on', period==='custom');
    var de=q('dtDe'), ate=q('dtAte'); if(de&&ate){ de.value=rng[0]; ate.value=rng[1]; }
  }
  function renderAll(){ var rng=rangeFor(period), a=aggDaily(rng), p=aggDaily(prevRange(rng)), days=daysInRange(rng);
    renderKpiCol(a,p); renderChartLeads(days); renderChartInvest(days); renderDaily(rng); renderTree(rng); renderScore(a); }
  function activateSub(id){ if(id!=='traf'&&id!=='score')id='traf'; sub=id;
    Array.prototype.forEach.call(q('subnav').querySelectorAll('button'),function(b){ b.classList.toggle('on', b.getAttribute('data-s')===id); });
    q('traf').classList.toggle('hidden', id!=='traf'); q('score').classList.toggle('hidden', id!=='score'); }
  this.showSub = activateSub;

  function coverageHTML(){
    if(!daily.length && !grain.length) return '<b>Sem dados.</b> Rode o build.ps1 para gerar o data.js.';
    return 'Leads: <b>'+fmtBR(fd.leadDateMin||'')+' → '+fmtBR(fd.leadDateMax||'')+'</b> · Tráfego/gasto: <b>'+fmtBR(minDate)+' → '+fmtBR(maxDate)+'</b>'
      +' · '+intf(fd.totals.leads)+' leads · '+intf(fd.totals.A+fd.totals.B)+' qualificados (A+B) · '+intf(fd.totals.attributed)+' rastreados'
      + (CFG.reach?' · atribuição direta pelo form nativo do Meta':' · atribuição por UTM da landing page');
  }
  function skeleton(){
    return '<div class="coverage" id="'+key+'-coverage"></div>'
      +'<div class="subhead"><div class="subnav" id="'+key+'-subnav"><button data-s="traf" class="on">Visão de Tráfego</button><button data-s="score">Leadscore A–E</button></div>'
      +'<div class="periods" id="'+key+'-periods"></div></div>'
      +'<div class="panel-sub" id="'+key+'-traf">'
        +'<div class="funil-grid"><div class="kpi-col" id="'+key+'-kpiCol"></div>'
        +'<div class="chart-col">'
          +'<div class="card"><div class="card-h">Leads x Qualificados por dia <span class="hint">qualificado = Leadscore A+B</span></div><div id="'+key+'-chartLeads"></div></div>'
          +'<div class="card"><div class="card-h">Investimento x CPL Qualificado por dia <span class="hint">barras = gasto · linha = CPL A+B</span></div><div id="'+key+'-chartInvest"></div></div>'
        +'</div></div>'
        +'<div class="card"><div class="card-h">Visão diária <span class="hint">mais recente no topo · cor mais forte = maior no período · CPL Qualif verde (bom) → vermelho (caro)</span></div><div class="table-scroll"><table class="tbl" id="'+key+'-dailyTbl"></table></div></div>'
        +'<div class="card"><div class="card-h">Otimização — Campanha › Conjunto › Anúncio <span class="hint">clique p/ abrir os níveis · veja de onde vêm os Leadscore A e B</span></div><div class="tree-legend" id="'+key+'-treeLegend"></div><div class="table-scroll"><table class="tbl tree" id="'+key+'-treeTbl"></table></div></div>'
      +'</div>'
      +'<div class="panel-sub hidden" id="'+key+'-score">'
        +'<div class="row-2">'
          +'<div class="card"><div class="card-h">Distribuição por Leadscore <span class="hint">no período</span></div><div class="score-body"><div id="'+key+'-scoreGauge"></div><div id="'+key+'-scoreBars" style="flex:1"></div></div></div>'
          +'<div class="card"><div class="card-h">Como o Leadscore é calculado <span class="hint">+1 por critério · 4 perguntas</span></div><div id="'+key+'-scoringRules"></div><div id="'+key+'-tierRules"></div></div>'
        +'</div>'
        +'<div class="card"><div class="card-h">Critérios de qualificação <span class="hint">quantos leads atendem cada pergunta · base completa</span></div><div id="'+key+'-criteria"></div></div>'
        +'<div class="card"><div class="card-h">Quem são os Qualificados (A + B) <span class="hint">perfil dos leads quentes/mornos · base completa</span></div><div class="row-3" id="'+key+'-qualifBreak"></div></div>'
        +'<div class="card"><div class="card-h">Ranking de anúncios por Qualificados (A + B) <span class="hint">onde investir p/ trazer mais lead bom</span></div><div class="table-scroll"><table class="tbl" id="'+key+'-adRankTbl"></table></div></div>'
      +'</div>';
  }

  this.mount = function(){
    document.getElementById('tab-'+key).innerHTML = skeleton();
    q('coverage').innerHTML = coverageHTML();
    q('periods').innerHTML = periodsHTML();
    Array.prototype.forEach.call(q('periods').querySelectorAll('.pbtn'),function(b){
      b.addEventListener('click',function(){ period=b.getAttribute('data-k'); customRange=null; syncPeriodUI(); renderAll(); }); });
    var de=q('dtDe'), ate=q('dtAte');
    function onDate(){ var s=de.value,e=ate.value; if(!s||!e)return; if(s>e){var t=s;s=e;e=t;} if(s<minDate)s=minDate; if(e>maxDate)e=maxDate; customRange=[s,e]; period='custom'; syncPeriodUI(); renderAll(); }
    de.addEventListener('change',onDate); ate.addEventListener('change',onDate);
    Array.prototype.forEach.call(q('subnav').querySelectorAll('button'),function(b){ b.addEventListener('click',function(){ activateSub(b.getAttribute('data-s')); }); });
    syncPeriodUI(); renderAll();
  };
}

/* =====================================================================
   ABA LEADS — visão geral combinada (LP + FORM5), com filtro de data
   ===================================================================== */
function mountLeads(){
  var L=D.lp||{}, F=D.form5||{}, lt=L.totals||{}, ft=F.totals||{};
  var minDate=[L.dateMin,F.dateMin].filter(Boolean).sort()[0]||'';
  var maxDate=[L.dateMax,F.dateMax].filter(Boolean).sort().slice(-1)[0]||'';
  var leadMin=[L.leadDateMin,F.leadDateMin].filter(Boolean).sort()[0]||minDate;
  var leadMax=[L.leadDateMax,F.leadDateMax].filter(Boolean).sort().slice(-1)[0]||maxDate;
  var period='tudo', customRange=null;
  function q(id){ return document.getElementById('leads-'+id); }
  function rangeFor(k){
    if(k==='custom'&&customRange) return customRange;
    if(k==='hoje') return [maxDate,maxDate];
    if(k==='ontem'){ var y=addDays(maxDate,-1); return [y,y]; }
    if(k==='7d') return [addDays(maxDate,-6),maxDate];
    if(k==='30d') return [addDays(maxDate,-29),maxDate];
    if(k==='leads') return [leadMin,leadMax];
    return [minDate,maxDate];
  }
  /* agrega os 2 funis no período. 'tudo' usa os totais (inclui leads sem data);
     recortes de data somam a partir do daily/grain (só leads com data). */
  function periodAgg(rng,isTudo){
    var o={leads:0,A:0,B:0,C:0,D:0,E:0,spend:0,attributed:0,lp:{leads:0,A:0,B:0,spend:0},f5:{leads:0,A:0,B:0,spend:0}};
    var pairs=[['lp',L],['f5',F]];
    if(isTudo){ pairs.forEach(function(p){ var k=p[0],t=p[1].totals||{};
      o.leads+=t.leads||0;o.A+=t.A||0;o.B+=t.B||0;o.C+=t.C||0;o.D+=t.D||0;o.E+=t.E||0;o.spend+=t.spend||0;o.attributed+=t.attributed||0;
      o[k].leads=t.leads||0;o[k].A=t.A||0;o[k].B=t.B||0;o[k].spend=t.spend||0; }); return o; }
    pairs.forEach(function(p){ var k=p[0],fd=p[1]||{};
      arr(fd.daily).forEach(function(d){ if(!isDate(d.date)||!inRange(d.date,rng))return;
        o.leads+=d.leads||0;o.A+=d.A||0;o.B+=d.B||0;o.C+=d.C||0;o.D+=d.D||0;o.E+=d.E||0;o.spend+=d.spend||0;
        o[k].leads+=d.leads||0;o[k].A+=d.A||0;o[k].B+=d.B||0;o[k].spend+=d.spend||0; });
      arr(fd.grain).forEach(function(g){ if(!isDate(g.date)||!inRange(g.date,rng))return; if(g.campaign!=='SEM_RASTREIO')o.attributed+=g.leads||0; });
    });
    return o;
  }

  /* ---------- seções que reagem ao período ---------- */
  function statCard(gold,lab,val,foot){ return '<div class="stat-card'+(gold?' gold':'')+'"><div class="s-lab">'+lab+'</div><div class="s-val">'+val+'</div><div class="s-foot">'+foot+'</div></div>'; }
  function renderPeriod(o){
    var total=o.leads, A=o.A,B=o.B,C=o.C,Dd=o.D,E=o.E, qualif=A+B, naoQ=C+Dd+E, spend=o.spend, attributed=o.attributed;
    var qPct=dv(qualif,total)*100, nqPct=dv(naoQ,total)*100, eqPct=dv(E,total)*100, rPct=dv(attributed,total)*100;
    var isGood=qualif>=naoQ;

    q('stats').innerHTML='<div class="big-stats">'
      +statCard(false,'Total de leads',intf(total),'<b>'+intf(o.lp.leads)+'</b> LP · <b>'+intf(o.f5.leads)+'</b> FORM5')
      +statCard(true,'Qualificados (A+B)',intf(qualif),'<b>'+pct(qPct)+'</b> da base · perfil de conselheiro')
      +statCard(false,'Não-qualificados (C–E)',intf(naoQ),'<b>'+pct(nqPct)+'</b> da base · '+intf(E)+' desqualificados (E)')
      +statCard(false,'Leads rastreados',intf(attributed),'<b>'+pct(rPct)+'</b> vinculados a um anúncio')
      +'</div>';

    if(total<=0){ q('verdict').innerHTML='<div class="verdict"><div class="v-txt"><div class="v-tag">Veredito geral · LP + FORM5</div><div class="v-head">Sem leads no período selecionado</div><div class="v-sub">Ajuste o filtro de data acima.</div></div></div>';
      q('thermo').innerHTML=''; q('qdonut').innerHTML=''; q('source').innerHTML=''; return; }

    q('verdict').innerHTML='<div class="verdict'+(isGood?'':' bad')+'">'
      +donutHTML(dv(qualif,total),isGood?'#e8b64a':'#f2637b',pct(qPct),'qualif A+B',132)
      +'<div class="v-txt"><div class="v-tag">Veredito geral · LP + FORM5</div>'
      +'<div class="v-head">A maioria dos seus leads '+(isGood?'é <span class="hi">QUALIFICADA</span>':'ainda <span class="hi">NÃO é qualificada</span>')+'</div>'
      +'<div class="v-sub"><b style="color:var(--ink2)">'+intf(qualif)+'</b> de <b style="color:var(--ink2)">'+intf(total)+'</b> leads ('+pct(qPct)+') são Leadscore <b style="color:var(--A)">A</b> ou <b style="color:var(--B)">B</b> — cargo/interesse de conselheiro. '
      +(isGood?'Boa densidade de lead bom na base.':'Vale revisar segmentação e criativos p/ atrair mais perfil de conselheiro.')+'</div></div></div>';

    var tiersInfo=[['A','Quente',A],['B','Morno',B],['C','Médio',C],['D','Frio',Dd],['E','Desqualif.',E]];
    var thermo='<div class="thermo">'+tiersInfo.map(function(t){ var w=dv(t[2],total)*100; if(w<=0) return '';
      return '<div class="seg" style="width:'+w+'%;background:'+TC[t[0]]+'" title="'+t[0]+' '+t[1]+': '+intf(t[2])+' ('+pct(w)+')">'+(w>6?t[0]+'<small>'+Math.round(w)+'%</small>':'')+'</div>'; }).join('')+'</div>';
    var thLegend='<div class="thermo-legend">'+tiersInfo.map(function(t){ return '<span class="li"><span class="sw" style="background:'+TC[t[0]]+'"></span><b>'+t[0]+'</b> '+t[1]+' · '+intf(t[2])+' ('+pct(dv(t[2],total)*100)+')</span>'; }).join('')+'</div>';
    var thSplit='<div class="thermo-split"><span>✅ Qualificados <b>A+B</b>: <b style="color:var(--gold2)">'+intf(qualif)+' ('+pct(qPct)+')</b></span>'
      +'<span>⚠️ Médio/Frio <b>C+D</b>: <b>'+intf(C+Dd)+' ('+pct(dv(C+Dd,total)*100)+')</b></span>'
      +'<span>❌ Desqualificados <b>E</b>: <b style="color:var(--bad)">'+intf(E)+' ('+pct(eqPct)+')</b></span></div>';
    q('thermo').innerHTML='<div class="card"><div class="card-h">Termômetro de qualidade da base <span class="hint">todos os leads dos 2 funis por Leadscore · no período</span></div>'
      +'<div class="thermo-wrap">'+thermo+'</div>'+thLegend+thSplit+'</div>';

    q('qdonut').innerHTML='<div class="card"><div class="card-h">Qualificado vs Não-qualificado <span class="hint">no período</span></div>'
      +'<div class="score-body"><div>'+donutHTML(dv(qualif,total),'#e8b64a',pct(qPct),'qualif A+B',150)+'</div>'
      +'<div style="flex:1">'
        +'<div class="hl-row"><span class="hl-k"><b style="color:var(--gold2)">Qualificado</b> A+B</span><span class="hl-bar"><span style="width:'+qPct+'%;background:linear-gradient(90deg,var(--A),var(--B))"></span></span><span class="hl-v">'+intf(qualif)+' · '+pct(qPct)+'</span></div>'
        +'<div class="hl-row"><span class="hl-k"><b style="color:var(--muted)">Não-qualif.</b> C–E</span><span class="hl-bar"><span style="width:'+nqPct+'%;background:var(--D)"></span></span><span class="hl-v">'+intf(naoQ)+' · '+pct(nqPct)+'</span></div>'
        +'<div class="hl-row"><span class="hl-k"><b style="color:var(--bad)">Desqualif.</b> E</span><span class="hl-bar"><span style="width:'+eqPct+'%;background:var(--E)"></span></span><span class="hl-v">'+intf(E)+' · '+pct(eqPct)+'</span></div>'
      +'</div></div></div>';

    function srcRow(tag,cls,t){ var qy=(t.A||0)+(t.B||0), taxa=dv(qy,t.leads||0)*100, cpl=qy>0?dv(t.spend||0,qy):null;
      return '<tr><td><span class="src-pill '+cls+'">'+tag+'</span></td><td class="num">'+intf(t.leads||0)+'</td>'
        +'<td class="num qcell">'+intf(qy)+'</td><td class="num">'+(t.leads?pct(taxa):'—')+'</td>'
        +'<td class="num">'+money0(t.spend||0)+'</td><td class="num">'+(cpl!=null?'<span class="cpl-pill '+cplClass(cpl,60,150)+'">'+money0(cpl)+'</span>':'—')+'</td></tr>'; }
    var totRow=(function(){ var qy=qualif, taxa=dv(qy,total)*100, cpl=qy>0?dv(spend,qy):null;
      return '<tr style="border-top:2px solid var(--line)"><td><b>Total</b></td><td class="num"><b>'+intf(total)+'</b></td>'
        +'<td class="num qcell"><b>'+intf(qy)+'</b></td><td class="num"><b>'+pct(taxa)+'</b></td>'
        +'<td class="num"><b>'+money0(spend)+'</b></td><td class="num">'+(cpl!=null?'<span class="cpl-pill '+cplClass(cpl,60,150)+'">'+money0(cpl)+'</span>':'—')+'</td></tr>'; })();
    q('source').innerHTML='<div class="card"><div class="card-h">Comparação por fonte <span class="hint">qual canal traz mais lead qualificado · no período</span></div>'
      +'<table class="tbl"><thead><tr><th>Fonte</th><th>Leads</th><th>Qualif</th><th>%Qualif</th><th>Invest</th><th>CPL Qualif</th></tr></thead><tbody>'
      +srcRow('SALA LP','src-lp',o.lp)+srcRow('SALA FORM5','src-f5',o.f5)+totRow+'</tbody></table></div>';
  }

  /* ---------- seções base completa (não filtram por data) ---------- */
  function renderStatic(){
    var totalAll=(lt.leads||0)+(ft.leads||0);
    var LC=arr(L.criteria), FC=arr(F.criteria);
    var crit=LC.map(function(c,i){ var fc=FC[i]||{}; var n=(c.n||0)+(fc.n||0); return {label:c.label,hint:c.hint,n:n,pct:dv(n,totalAll)*100}; });
    q('criteria').innerHTML='<div class="card"><div class="card-h">% que respondem cada critério <span class="hint">quantos dos '+intf(totalAll)+' leads atendem cada pergunta · base completa</span></div>'
      +crit.map(function(cr){ var w=Math.max(3,cr.pct); return '<div class="crit"><div class="crit-top"><span class="cl">'+esc(cr.label)+'<small>'+esc(cr.hint)+'</small></span><span class="cn">'+intf(cr.n)+' <small>('+pct(cr.pct)+')</small></span></div><div class="crit-track"><span style="width:'+w+'%"></span></div></div>'; }).join('')+'</div>';
    function qbBlockG(title,list){ var max=Math.max.apply(null,list.map(function(x){return x.n;}).concat([1]));
      var bars=list.length?list.slice(0,8).map(function(x){ return '<div class="qbar"><div class="qbar-top"><span class="l" title="'+esc(x.label)+'">'+esc(x.label)+'</span><span class="n">'+x.n+'</span></div><div class="qbar-track"><span style="width:'+Math.max(6,x.n/max*100)+'%"></span></div></div>'; }).join(''):'<div class="empty">Sem qualificados ainda.</div>';
      return '<div><div class="qb-h">'+title+'</div>'+bars+'</div>'; }
    q('profile').innerHTML='<div class="card"><div class="card-h">Perfil dos qualificados (A + B) <span class="hint">LP + FORM5 somados · base completa</span></div>'
      +'<div class="row-3">'+qbBlockG('Cargo',mergeDist(L.qualifCargo,F.qualifCargo))
      +qbBlockG('Área de atuação',mergeDist(L.qualifArea,F.qualifArea))
      +qbBlockG('Conhecimento sobre conselho',mergeDist(L.qualifNivel,F.qualifNivel))+'</div></div>';
  }

  /* ---------- período (UI) ---------- */
  function periodsHTML(){
    return PRESETS.map(function(p){return '<button data-k="'+p.k+'" class="pbtn">'+p.label+'</button>';}).join('')
      +'<span class="daterange" id="leads-daterange"><span class="dr-l">De</span> <input type="date" id="leads-dtDe" min="'+minDate+'" max="'+maxDate+'"> <span class="dr-l">até</span> <input type="date" id="leads-dtAte" min="'+minDate+'" max="'+maxDate+'"></span>';
  }
  function syncPeriodUI(){ var rng=rangeFor(period);
    Array.prototype.forEach.call(q('periods').querySelectorAll('.pbtn'),function(b){ b.classList.toggle('on', period===b.getAttribute('data-k')); });
    var dr=q('daterange'); if(dr) dr.classList.toggle('on', period==='custom');
    var de=q('dtDe'), ate=q('dtAte'); if(de&&ate){ de.value=rng[0]; ate.value=rng[1]; } }
  function draw(){ renderPeriod(periodAgg(rangeFor(period), period==='tudo')); }

  document.getElementById('tab-leads').innerHTML =
    '<div class="coverage">Visão geral somando os <b>2 funis</b> (SALA LP + SALA FORM5) · Leadscore idêntico nos dois · use o filtro de data à direita · <b>Critérios</b> e <b>Perfil</b> são base completa (todos os períodos)</div>'
    +'<div class="subhead"><div style="font-size:13px;color:var(--ink2);font-weight:700">Leads · visão geral</div><div class="periods" id="leads-periods"></div></div>'
    +'<div id="leads-stats"></div><div id="leads-verdict"></div><div id="leads-thermo"></div>'
    +'<div class="row-2"><div id="leads-qdonut"></div><div id="leads-source"></div></div>'
    +'<div id="leads-criteria"></div><div id="leads-profile"></div>';

  q('periods').innerHTML=periodsHTML();
  Array.prototype.forEach.call(q('periods').querySelectorAll('.pbtn'),function(b){
    b.addEventListener('click',function(){ period=b.getAttribute('data-k'); customRange=null; syncPeriodUI(); draw(); }); });
  var de=q('dtDe'), ate=q('dtAte');
  function onDate(){ var s=de.value,e=ate.value; if(!s||!e)return; if(s>e){var t=s;s=e;e=t;} if(s<minDate)s=minDate; if(e>maxDate)e=maxDate; customRange=[s,e]; period='custom'; syncPeriodUI(); draw(); }
  de.addEventListener('change',onDate); ate.addEventListener('change',onDate);
  renderStatic(); syncPeriodUI(); draw();
}

/* =================== BOOT =================== */
function el(id){ return document.getElementById(id); }
el('updated').textContent = D.generatedAtBR || '—';
el('taxf').textContent = nf4.format(D.taxMultiplier||1.1385);

if(!D.lp && !D.form5){
  el('tab-lp').innerHTML='<div class="coverage"><b>Sem dados.</b> Rode o build.ps1 para gerar o data.js.</div>';
} else {
  var funnels={ lp:new Funnel('lp', D.lp||{}), f5:new Funnel('f5', D.form5||{}) };
  funnels.lp.mount(); funnels.f5.mount(); mountLeads();
  var TABS=['lp','f5','leads'];
  function activateTab(id){ if(TABS.indexOf(id)<0)id='lp'; Array.prototype.forEach.call(document.querySelectorAll('.tabs.main .tab'),function(x){x.classList.toggle('active',x.getAttribute('data-tab')===id);});
    TABS.forEach(function(t){ el('tab-'+t).classList.toggle('hidden',t!==id); }); }
  function route(){ var raw=(location.hash||'').replace('#',''); var parts=raw.split('.'); var t=parts[0]; if(TABS.indexOf(t)<0)return; activateTab(t); if(parts[1]&&funnels[t])funnels[t].showSub(parts[1]); }
  Array.prototype.forEach.call(document.querySelectorAll('.tabs.main .tab'),function(t){ t.addEventListener('click',function(){ var id=t.getAttribute('data-tab'); activateTab(id); if(history.replaceState)history.replaceState(null,'','#'+id); }); });
  route();
  window.addEventListener('hashchange',route);
}
})();
