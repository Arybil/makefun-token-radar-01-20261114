// SPDX-License-Identifier: MIT
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = n => n>=1e9?'$'+(n/1e9).toFixed(2)+'b':n>=1e6?'$'+(n/1e6).toFixed(1)+'m':'$'+Math.round(n).toLocaleString('en-US');
  const pct = n => n==null?'—':(n>=0?'+':'')+n.toFixed(1)+'%';
  const date = d => new Date(d+'T00:00:00Z').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'});
  const stored = (key,fallback) => { try {return JSON.parse(localStorage.getItem(key)) ?? fallback;} catch {return fallback;} };
  const persist = (key,value) => {try {localStorage.setItem(key,JSON.stringify(value));} catch {}};
  const data = window.RADAR_DATA;
  if(!data){$('#rows').innerHTML='<tr><td colspan="8">Data unavailable. Run main.ts and open output/dashboard/index.html.</td></tr>';return;}
  const rows = RadarModel.rank(data);
  let saved=new Set(stored('afterglow-saved',[])), checked=stored('afterglow-checks',{});
  let state={scope:'all',search:'',category:'',chain:'',momentum:'',sort:'rank',direction:1,page:0};
  let current=null;
  const pageSize=8;
  $('#asof').textContent=date(data.as_of);
  $('#rail-date').textContent=date(data.as_of).toUpperCase();
  $('#lead-count').textContent=rows.length;
  $('#watch-count').textContent=data.watch.length+'/'+data.watch.length;
  $('#early-count').textContent=rows.filter(r=>r.tvl_usd<data.floor_usd).length;
  $('#live-count').textContent=data.live;
  for(const [selector,values] of [['#category',[...new Set(rows.map(r=>r.category||'Unclassified'))].sort()],['#chain',[...new Set(rows.flatMap(r=>r.chains))].sort()]]){
    for(const value of values){const option=document.createElement('option');option.value=value;option.textContent=value;$(selector).append(option);}
  }
  function filtered(){
    const found=rows.filter(r=>
      (state.scope!=='watch'||r.watch)&&(state.scope!=='early'||r.tvl_usd<data.floor_usd)&&(state.scope!=='saved'||saved.has(r.slug))&&
      (!state.search||[r.name,r.slug,r.category,...r.chains].join(' ').toLowerCase().includes(state.search.toLowerCase()))&&
      (!state.category||(r.category||'Unclassified')===state.category)&&(!state.chain||r.chains.includes(state.chain))&&
      (!state.momentum||(state.momentum==='positive'?r.change_7d>0:state.momentum==='negative'?r.change_7d<0:r.change_7d==null)));
    return found.sort((a,b)=>{
      const av=a[state.sort],bv=b[state.sort];
      if(av==null)return bv==null?a.rank-b.rank:1;if(bv==null)return -1;
      return (typeof av==='string'?(av<bv?-1:av>bv?1:0):av-bv)*state.direction||a.rank-b.rank;
    });
  }
  function render(){
    const view=filtered(),maxPage=Math.max(0,Math.ceil(view.length/pageSize)-1);state.page=Math.min(state.page,maxPage);
    const start=state.page*pageSize;
    $('#result-count').textContent=view.length+' of '+rows.length+' research leads'+(state.scope==='watch'?' · all required names':'');
    $('#saved-count').textContent=saved.size;
    document.querySelectorAll('[data-scope]').forEach(b=>b.classList.toggle('selected',b.dataset.scope===state.scope));
    $('#sort-note').textContent=state.sort==='rank'||state.sort==='implied_value_usd'?'base scenario':'sorted by '+state.sort.replaceAll('_',' ');
    $('#rows').innerHTML=view.slice(start,start+pageSize).map(r=>`<tr data-row="${esc(r.slug)}"><td>${String(r.rank).padStart(2,'0')}</td><td><span class="avatar" aria-hidden="true">${esc(r.name[0])}</span><button class="protocol-button" data-open="${esc(r.slug)}">${esc(r.name)}</button><span class="sub">${esc(r.category||'Unclassified')} · ${esc(r.chains[0]||'Unknown')}${r.chains.length>1?' +'+(r.chains.length-1):''}</span></td><td><button class="value" data-open="${esc(r.slug)}">${money(r.implied_value_usd)} ↗</button><span class="range">${money(r.low_usd)} – ${money(r.high_usd)} scenario</span></td><td>${money(r.tvl_usd)}<span class="sub">${r.watch?'House watchlist':'Discovery lead'}</span></td><td class="${r.change_7d==null?'':r.change_7d>=0?'up':'down'}">${pct(r.change_7d)}</td><td>${r.tracking_days==null?'—':r.tracking_days+'d'}<span class="sub">${r.tracking_days==null?'Date missing':'Since tracking'}</span></td><td class="action-cell"><button data-open="${esc(r.slug)}" class="pill ${r.plan.mode==='Research only'?'research':''}">${esc(r.plan.mode)} →</button><small>${r.plan.capital_usd?'$'+r.plan.capital_usd+' test · '+r.plan.days+' days':'$0 funded · verify access'}</small></td><td><button class="save ${saved.has(r.slug)?'saved':''}" data-save="${esc(r.slug)}" aria-label="${saved.has(r.slug)?'Unsave':'Save'} ${esc(r.name)}">${saved.has(r.slug)?'◆':'◇'}</button></td></tr>`).join('');
    $('#empty').hidden=!!view.length;
    $('#page-info').textContent=view.length?(start+1)+'–'+Math.min(start+pageSize,view.length)+' of '+view.length+' · ranks remain global':'0 results';
    $('#prev').disabled=state.page===0;$('#next').disabled=state.page>=maxPage;
    landscape(view);
  }
  function landscape(view){
    const w=590,h=144,left=43,right=565,top=16,bottom=114;
    const max=Math.max(1e8,...rows.map(r=>Math.max(r.tvl_usd,r.implied_value_usd)));
    const min=1e6,logMin=Math.log10(min),logMax=Math.log10(max*1.15);
    const x=n=>left+(Math.log10(Math.max(min,n))-logMin)/(logMax-logMin)*(right-left);
    const y=n=>bottom-(Math.log10(Math.max(min,n))-logMin)/(logMax-logMin)*(bottom-top);
    let svg=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Filtered leads: TVL on horizontal logarithmic axis, implied value on vertical logarithmic axis"><text x="0" y="12">VALUE</text>`;
    for(const n of [1e6,1e7,1e8,1e9,1e10])if(n<=max*1.15){svg+=`<line x1="${x(n)}" x2="${x(n)}" y1="${top}" y2="${bottom}" stroke="#e4e8dd"/><line x1="${left}" x2="${right}" y1="${y(n)}" y2="${y(n)}" stroke="#e4e8dd"/><text x="${x(n)}" y="130" text-anchor="middle">${money(n)}</text>`;}
    svg+=`<text x="580" y="142" text-anchor="end">TVL · LOG SCALE</text>`;
    for(const r of view)svg+=`<circle class="plot-dot" data-open="${esc(r.slug)}" cx="${x(r.tvl_usd).toFixed(1)}" cy="${y(r.implied_value_usd).toFixed(1)}" r="${r.watch?3:2}" fill="${r.watch?'#276349':'#aebf9a'}" opacity=".8"><title>${esc(r.name)}: ${money(r.tvl_usd)} TVL / ${money(r.implied_value_usd)} implied</title></circle>`;
    $('#landscape').innerHTML=svg+'</svg>';
  }
  function reset(){state={...state,scope:'all',search:'',category:'',chain:'',momentum:'',sort:'rank',direction:1,page:0};for(const sel of ['#search','#category','#chain','#momentum'])$(sel).value='';render();}
  function showMethod(){
    const g=data.calibration.global;
    $('#method-content').innerHTML=`<h2 id="method-title">A value model you can take apart.</h2><p>These are conditional estimates of circulating token market cap if the protocol's present record supported a token. They are not FDV, launch probability, reward allocation or a claim made by make.fun.</p><h3>01 / Calibrate from the sealed market</h3><p>${g[0]} recorded-token peers have positive market cap and TVL after excluding exchange, bridge and wrapped/staking-product categories. Ratios are clipped to 0.05–5.00× to limit extremes. The global median is ${g[2].toFixed(3)}× TVL (interquartile ${g[1].toFixed(3)}–${g[3].toFixed(3)}×).</p><code>category weight = n / (n + 5)<br>multiple = weight × category median + (1 − weight) × global median</code><h3>02 / Apply bounded record adjustments</h3><code>value = TVL × multiple × growth factor × maturity factor<br>growth = 1 + clamp(7d TVL %, −50, 50) / 200<br>maturity = 0.70 + 0.30 × min(tracking days / 730, 1)</code><p>Missing growth is neutral (1.00×); a missing tracking date uses 0.85×. Tracking age is time since DefiLlama began tracking, not launch age or proven time without a token. Rank ties use slug order, and all dates are measured against ${date(data.as_of)}.</p><h3>03 / Show what can go wrong</h3><p>Low uses the smaller of the blended lower quartile and 80% of the median, ×0.70. High uses the larger of the upper quartile and 120% of the median, ×1.30. Each missing field widens the low by another 0.10 and high by 0.20. These are assumption scenarios, not statistical confidence bounds.</p><h3>Coverage & evidence limits</h3><ul><li>${data.watch.length}/${data.watch.length} house watchlist names are preserved; ${rows.length-data.watch.length} additional leads pass metadata exclusions. Parent relationships are absent, so extra candidates may be versions or subsidiaries.</li><li>${data.live} protocols record a token symbol or CoinGecko id and are set aside. A missing record does not establish that a token is absent. Recheck official records before funding.</li><li>TVL is not revenue, token rights or unique capital. Curators may share underlying deposits. Market caps can reflect different circulating supplies. Do not add modeled values across protocols.</li><li>No fees, audits, eligibility, yield, campaign or points data are supplied. Plans are category-based hypotheses. Dollar budgets and durations are user-adjustable planning ceilings, never verified protocol terms.</li></ul><p>Source: ${esc(data.source)}. Entire universe: ${data.universe}. Watchlist floor: ${money(data.floor_usd)}. Snapshot is sealed and does not refresh.</p>`;
    $('#method').showModal();
  }
  function showDetail(slug){
    const r=rows.find(x=>x.slug===slug);if(!r)return;current=r;
    $('#detail-content').innerHTML=`<header class="detail-head"><div class="dialog-head"><span class="eyebrow">PROTOCOL INSPECTOR / GLOBAL RANK ${String(r.rank).padStart(2,'0')} · ${r.watch?'HOUSE WATCHLIST':'DISCOVERY LEAD'}</span><button class="close" data-close="detail" aria-label="Close protocol detail">×</button></div><div class="detail-heading"><span class="avatar">${esc(r.name[0])}</span><div><h2 id="detail-title">${esc(r.name)}</h2><p>${esc(r.category||'Unclassified')} · ${esc(r.chains.slice(0,4).join(', '))}${r.chains.length>4?' +'+(r.chains.length-4):''}</p></div><div class="value-block"><small>IMPLIED TOKEN MARKET CAP</small><b>${money(r.implied_value_usd)}</b><small>Conditional base scenario · no token recorded</small></div></div></header><div class="detail-grid"><section class="evidence"><h3>From record to value</h3><dl class="facts"><div><dt>Observed TVL</dt><dd>${money(r.tvl_usd)}</dd></div><div><dt>7d TVL change</dt><dd class="${r.change_7d>=0?'up':'down'}">${pct(r.change_7d)}</dd></div><div><dt>Tracking duration</dt><dd>${r.tracking_days==null?'Unreported':r.tracking_days+' days'}</dd></div><div><dt>Category peers</dt><dd>${r.peer_count} <small>· ${r.confidence.toLowerCase()}</small></dd></div></dl><div class="equation"><div><span>Observed TVL</span><b>${money(r.tvl_usd)}</b></div><div><span>× Blended peer multiple</span><b>${r.multiple.toFixed(3)}×</b></div><div><span>× 7d growth adjustment</span><b>${r.growth_factor.toFixed(3)}×</b></div><div><span>× Tracking maturity</span><b>${r.maturity_factor.toFixed(3)}×</b></div><div class="answer"><span>Base implied value</span><b>${money(r.implied_value_usd)}</b></div></div><div class="band">ASSUMPTION RANGE <div class="band-track" style="--base-position:${((r.implied_value_usd-r.low_usd)/(r.high_usd-r.low_usd)*100).toFixed(3)}%"></div><div class="band-labels"><span>Low ${money(r.low_usd)}</span><span>High ${money(r.high_usd)}</span></div></div><p class="note">${Math.round(r.peer_weight*100)}% category / ${Math.round((1-r.peer_weight)*100)}% global prior. Age is tracking history, not proof of tokenless operation. TVL can overlap across protocols.</p><div class="peers"><b>Peers nearest the category median</b><br>${r.peers.map(p=>esc(p[0])+' · '+p[1].toFixed(2)+'×').join('<br>')}<br><span class="note">Ratios clipped to 0.05–5×; not direct comparables.</span></div></section><section class="plan"><div class="plan-heading"><h3>A bounded farm plan</h3><span class="pill ${r.plan.mode==='Research only'?'research':''}">${esc(r.plan.mode)}</span></div><div class="plan-controls"><label>Capital ceiling $<input id="capital" type="number" value="100" min="0" max="10000" step="25"></label><label>Gas / tx $<input id="gas" type="number" value="2" min="0" max="100" step="0.5"></label></div><div id="plan-body"></div></section></div><footer class="detail-foot"><span>No verified campaign, eligibility or reward. Confirm official access first.</span><button id="copy-plan">Copy research plan</button></footer>`;
    renderPlan();$('#detail').showModal();
    $('#capital').addEventListener('input',renderPlan);$('#gas').addEventListener('input',renderPlan);
    $('#copy-plan').onclick=()=>copyPlan();
  }
  function renderPlan(){
    const capital=Math.max(0,Math.min(10000,Number($('#capital').value)||0)),gas=Math.max(0,Math.min(100,Number($('#gas').value)||0));
    const plan=RadarModel.farmPlan(current,capital,gas);
    $('#plan-body').innerHTML=`<div class="budget">$${plan.capital_usd} principal at risk · ≤ $${plan.transactions*gas} gas/fees<br>${plan.days?plan.days+'-day test horizon':'Research gate · no funded action'} · planning assumptions</div><ol>${plan.steps.map((s,i)=>`<li class="${checked[current.slug+'-'+i]?'done':''}"><label><input type="checkbox" data-check="${current.slug+'-'+i}" ${checked[current.slug+'-'+i]?'checked':''}>${esc(s)}</label></li>`).join('')}</ol>`;
  }
  async function copyPlan(){
    const text=current.name+' — research plan\n'+[...$('#plan-body').querySelectorAll('li')].map((x,i)=>(i+1)+'. '+x.textContent).join('\n');
    try{await navigator.clipboard.writeText(text);toast('Plan copied');}catch{download(current.slug+'-plan.txt',text,'text/plain');}
  }
  function toast(text){$('#toast').textContent=text;$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',2200);}
  function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}
  document.addEventListener('click',e=>{
    const open=e.target.closest('[data-open]');if(open)showDetail(open.dataset.open);
    const close=e.target.closest('[data-close]');if(close)$('#'+close.dataset.close).close();
    const scope=e.target.closest('[data-scope]');if(scope){state.scope=scope.dataset.scope;state.page=0;render();}
    const sort=e.target.closest('[data-sort]');if(sort){const key=sort.dataset.sort;state.direction=state.sort===key?-state.direction:key==='name'||key==='rank'?1:-1;state.sort=key;state.page=0;render();}
    const save=e.target.closest('[data-save]');if(save){saved.has(save.dataset.save)?saved.delete(save.dataset.save):saved.add(save.dataset.save);persist('afterglow-saved',[...saved]);render();}
  });
  document.addEventListener('change',e=>{if(e.target.dataset.check){checked[e.target.dataset.check]=e.target.checked;persist('afterglow-checks',checked);e.target.closest('li').classList.toggle('done',e.target.checked);}});
  for(const key of ['search','category','chain','momentum'])$('#'+key).addEventListener(key==='search'?'input':'change',e=>{state[key]=e.target.value;state.page=0;render();});
  $('#prev').onclick=()=>{state.page--;render();};$('#next').onclick=()=>{state.page++;render();};
  $('#reset').onclick=$('#empty-reset').onclick=$('#nav-radar').onclick=reset;
  $('#nav-watch').onclick=()=>{reset();state.scope='watch';render();};
  for(const id of ['method-top','model-open','limits-open','nav-method'])$('#'+id).onclick=showMethod;
  $('#export').onclick=()=>download('afterglow-filtered.csv',['rank,name,slug,implied_value_usd,low_usd,high_usd,tvl_usd,change_7d,tracking_days',...filtered().map(r=>[r.rank,r.name,r.slug,r.implied_value_usd,r.low_usd,r.high_usd,r.tvl_usd,r.change_7d,r.tracking_days].map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(','))].join('\n'),'text/csv');
  for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',e=>{if(e.target===dialog){const rect=dialog.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)dialog.close();}});
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!$('#detail').open&&!$('#method').open){e.preventDefault();$('#search').focus();}});
  render();
})();
