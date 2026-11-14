// SPDX-License-Identifier: MIT
// The exact same pure functions build board.json and power the offline page.
(() => {
  'use strict';
  const blocked = new Set(['Bridge','Canonical Bridge','Cross Chain Bridge','Liquid Staking','Liquid Restaking','Restaked BTC','CEX','Anchor BTC','Stablecoin Wrapper','Staking Pool']);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  const quantile = (values, q) => {
    const a = [...values].sort((x, y) => x - y), p = (a.length - 1) * q;
    return a.length ? a[Math.floor(p)] + (a[Math.ceil(p)] - a[Math.floor(p)]) * (p % 1) : 1;
  };
  const noToken = p => p.symbol == null && p.gecko_id == null;
  const eligible = p => noToken(p) && !blocked.has(p.category) && !/\b(wrapped|staked|staking)\b|\s(v\d+(\.\d+)?|\d+\.\d+)$/i.test(p.name) && !/^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)/i.test(p.name);
  function prepare(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.protocols) || !Array.isArray(snapshot.watchlist) || !/^\d{4}-\d{2}-\d{2}$/.test(snapshot.as_of)) throw new Error('Invalid sealed snapshot');
    const all = [...snapshot.protocols].sort((a,b) => order(a.slug,b.slug));
    if (new Set(all.map(p=>p.slug)).size !== all.length) throw new Error('Duplicate protocol slug');
    for (const p of all) {
      if (!Number.isSafeInteger(p.tvl_usd) || p.tvl_usd <= 0) throw new Error('Invalid TVL for ' + p.slug);
      if (p.change_7d != null && !Number.isFinite(p.change_7d)) throw new Error('Invalid growth for ' + p.slug);
      if (typeof p.slug !== 'string' || !p.slug || /\s/.test(p.slug) || typeof p.name !== 'string' || !p.name.trim() || !Array.isArray(p.chains)) throw new Error('Invalid protocol record');
    }
    const watch = new Set(snapshot.watchlist);
    if ([...watch].some(slug=>!all.some(p=>p.slug===slug))) throw new Error('Watchlist slug missing from snapshot');
    const peers = all.filter(p => !noToken(p) && p.mcap_usd > 0 && p.tvl_usd > 0 && !blocked.has(p.category));
    const ratio = p => clamp(p.mcap_usd / p.tvl_usd, 0.05, 5);
    function group(list) {
      const a = list.map(ratio);
      const near = [...list].sort((x,y)=>Math.abs(ratio(x)-quantile(a,.5))-Math.abs(ratio(y)-quantile(a,.5)) || order(x.slug,y.slug)).slice(0,3);
      return [a.length, ...[.25,.5,.75].map(q=>+quantile(a,q).toFixed(6)), near.map(p=>[p.name,+ratio(p).toFixed(4)])];
    }
    const categories = [...new Set(all.map(p=>p.category || 'Unclassified'))].sort(order);
    const calibration = {global:group(peers)};
    for (const cat of categories) calibration[cat] = group(peers.filter(p=>(p.category||'Unclassified')===cat));
    return {
      as_of:snapshot.as_of, source:snapshot.source, floor_usd:snapshot.floor_usd,
      universe:all.length, live:all.filter(p=>!noToken(p)).length, watch:[...watch].sort(order), calibration,
      // Raw observed fields only; row values and every plan are computed by rank().
      candidates:all.filter(p=>watch.has(p.slug)||eligible(p)).map(p=>[p.slug,p.name,p.category,p.chains,p.tvl_usd,p.change_7d,p.listed_at])
    };
  }
  function farmPlan(row, capital = 100, gas = 2) {
    const n = row.name, cat = row.category || 'Unclassified', chain = row.chains[0] || 'an independently verified supported chain';
    const restricted = /RWA|CeDeFi|CEX|Insurance|Chain|Payments|Unclassified/.test(cat);
    const derivatives = /Derivatives|Options|Synthetics|Prediction/.test(cat);
    const principal = restricted ? 0 : derivatives ? Math.min(capital,25) : capital;
    const txs = restricted ? 0 : 4;
    let action;
    if (/Lending|CDP|Collateral/.test(cat)) action = `Supply $${principal} of a supported asset to ${n} on ${chain}; keep borrowing at zero and test a small withdrawal before adding funds.`;
    else if (/Dexs|Liquidity Manager/.test(cat)) action = `On ${chain}, swap $${Math.min(principal,10)} through ${n}, then consider up to $${principal} in a liquid pool only after checking fee tiers and impermanent-loss exposure.`;
    else if (/Risk Curators|Allocator|Yield|Farm|Basis/.test(cat)) action = `Inspect a ${n} vault on ${chain}: read its underlying markets, curator and withdrawal queue; supply at most $${principal} only if the asset and exit are clear.`;
    else if (/Restak|Staking/.test(cat)) action = `Inspect ${n} on ${chain}; verify slashing terms, operator and unbonding period before considering a $${principal} test delegation. Skip if the lock exceeds your horizon.`;
    else if (derivatives) action = `Use ${n}'s paper mode first on ${chain}; only if verified access exists, cap collateral at $${principal}, use no leverage and close the test position promptly.`;
    else if (restricted) action = `Research ${n}'s ${cat.toLowerCase()} product on ${chain}; verify eligibility, minimums and redemption terms. Allocate $0 until official access and a safe retail action are established.`;
    else action = `Inspect ${n}'s ${cat.toLowerCase()} workflow on ${chain}; consider one $${principal} test only after verifying official contracts, supported assets and a practical withdrawal.`;
    return {
      capital_usd:principal, gas_ceiling_usd:gas, transactions:txs, days:restricted?0:14,
      mode:restricted?'Research only':derivatives?'Simulation first':'Small test',
      steps:[
        `Before funding (20–30 min): independently locate ${n}'s official documentation and contracts for ${chain}. The sealed record does not verify access, audits, points or a future token.`,
        `${restricted?'Access review (30 min)':'First session (30–45 min)'}: ${action}`,
        `Planning ceiling, not a fee quote: $${principal} principal at risk plus at most ${txs} transactions × $${gas} = $${txs*gas} gas/fees. ${restricted?'No funded action is proposed.':'Stop if fees, slippage or minimums exceed this budget; avoid bridging solely for points.'}`,
        `${restricted?'Revisit the documentation in 14 days (15 min)':'Hold up to 14 days; review twice weekly (10 min each)'}: check exit liquidity, contract changes and actual usage. ${restricted?'Only upgrade the plan after access is verified.':'Keep receipts; do not manufacture volume or assume usage qualifies for a reward.'}`,
        `Exit review (15–30 min): ${restricted?'remain unfunded until restrictions and redemption are understood':'withdraw a test amount, close positions and revoke unused approvals; wait through any documented queue'}. Recheck token status before any claim; never sign an unverified claim or disclose a seed phrase.`
      ]
    };
  }
  function rank(data) {
    const asof = Date.parse(data.as_of+'T00:00:00Z'), watch = new Set(data.watch);
    return data.candidates.map(p => {
      const [slug,name,category,chains,tvl_usd,change_7d,listed_at] = p;
      const cat = data.calibration[category||'Unclassified'] || data.calibration.global;
      const global = data.calibration.global, weight = cat[0] / (cat[0] + 5);
      const blended = q => weight*cat[q] + (1-weight)*global[q];
      const multiple = blended(2);
      const days = listed_at && Number.isFinite(Date.parse(listed_at+'T00:00:00Z')) ? Math.max(0,Math.floor((asof-Date.parse(listed_at+'T00:00:00Z'))/86400000)) : null;
      const growth = change_7d == null ? 1 : 1 + clamp(change_7d,-50,50)/200;
      const maturity = days == null ? .85 : .7 + .3*clamp(days/730,0,1);
      const value = Math.max(1,Math.min(1e14,Math.round(tvl_usd*multiple*growth*maturity)));
      const missing = Number(days===null)+Number(change_7d===null);
      const low = Math.max(1,Math.round(tvl_usd*Math.min(blended(1),multiple*.8)*growth*maturity*(.7-.1*missing)));
      const high = Math.min(1e14,Math.round(tvl_usd*Math.max(blended(3),multiple*1.2)*growth*maturity*(1.3+.2*missing)));
      const row = {slug,name,category,chains,tvl_usd,change_7d,listed_at,tracking_days:days,watch:watch.has(slug),implied_value_usd:value,low_usd:Math.min(low,value),high_usd:Math.max(high,value),multiple,growth_factor:growth,maturity_factor:maturity,peer_count:cat[0],peer_weight:weight,peers:cat[4].length?cat[4]:global[4],confidence:missing?'Limited':cat[0]>=5?'Moderate':'Limited'};
      row.plan = farmPlan(row);
      row.farm_steps = row.plan.steps;
      return row;
    }).sort((a,b)=>b.implied_value_usd-a.implied_value_usd||order(a.slug,b.slug)).map((r,i)=>({...r,rank:i+1}));
  }
  globalThis.RadarModel = {prepare,rank,farmPlan};
})();
