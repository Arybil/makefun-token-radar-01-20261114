// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import '../dashboard/model.js';
const model=globalThis.RadarModel;
const fixture=() => ({as_of:'2026-11-14',source:'synthetic unit-test fixture',floor_usd:50000000,watchlist:['candidate'],protocols:[
  {slug:'candidate',name:'Candidate',category:'Lending',chains:['Ethereum'],tvl_usd:100000000,change_7d:0,mcap_usd:null,listed_at:'2025-11-14',gecko_id:null,symbol:null},
  {slug:'peer',name:'Peer',category:'Lending',chains:['Ethereum'],tvl_usd:100000000,change_7d:0,mcap_usd:100000000,listed_at:'2024-01-01',gecko_id:'peer',symbol:'PEER'}
]});
test('malformed financial data is refused rather than silently ranked',()=>{
  const s=fixture();s.protocols[0].tvl_usd=-1;
  assert.throws(()=>model.prepare(s),/TVL/);
});
test('value responds to TVL, growth and tracking age with bounded growth tails',()=>{
  const base=fixture(), value=s=>model.rank(model.prepare(s))[0].implied_value_usd;
  const tvl=fixture();tvl.protocols[0].tvl_usd*=2;assert.equal(value(tvl),value(base)*2);
  const grow=fixture();grow.protocols[0].change_7d=25;assert.ok(value(grow)>value(base));
  const old=fixture();old.protocols[0].listed_at='2020-01-01';assert.ok(value(old)>value(base));
  const spike=fixture();spike.protocols[0].change_7d=5000;
  const capped=fixture();capped.protocols[0].change_7d=50;assert.equal(value(spike),value(capped));
  const missing=fixture();missing.protocols[0].change_7d=null;missing.protocols[0].listed_at=null;
  const r=model.rank(model.prepare(missing))[0];assert.equal(r.tracking_days,null);assert.equal(r.confidence,'Limited');
  assert.equal(r.growth_factor,1);assert.equal(r.maturity_factor,.85);
});
test('farm budgets are actual adjustable ceilings and restricted access stays unfunded',()=>{
  const row=model.rank(model.prepare(fixture()))[0];
  const p=model.farmPlan(row,250,3);assert.equal(p.capital_usd,250);assert.equal(p.transactions,4);assert.ok(p.steps.join(' ').includes('$12'));
  const restricted=model.farmPlan({...row,category:'RWA'},250,3);assert.equal(restricted.capital_usd,0);assert.equal(restricted.transactions,0);assert.equal(restricted.mode,'Research only');
  const derivative=model.farmPlan({...row,category:'Derivatives'},250,3);assert.equal(derivative.capital_usd,25);
});
