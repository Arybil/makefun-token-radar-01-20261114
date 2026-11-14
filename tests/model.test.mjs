// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const modelPath = resolve('dashboard/model.js');
const snapshotPath = process.env.RADAR_SNAPSHOT || '../../kits/token-radar-01-kit/input/snapshot.json';
const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));

test('sealed snapshot becomes a real value-ranked radar covering the entire watchlist', async () => {
  assert.ok(existsSync(modelPath), 'missing radar model: implement the sealed-snapshot ranking contract');
  await import(modelPath);
  const model = globalThis.RadarModel;
  const data = model.prepare(snapshot);
  const rows = model.rank(data);
  assert.ok(rows.length >= 100 && rows.length <= 4000);
  assert.equal(new Set(rows.map(r => r.slug)).size, rows.length);
  const source = new Map(snapshot.protocols.map(p => [p.slug, p]));
  for (const slug of snapshot.watchlist) assert.ok(rows.some(r => r.slug === slug), slug);
  for (const [i, row] of rows.entries()) {
    assert.equal(row.rank, i + 1);
    assert.ok(Number.isSafeInteger(row.implied_value_usd) && row.implied_value_usd > 0 && row.implied_value_usd <= 1e14);
    if (i) assert.ok(rows[i - 1].implied_value_usd >= row.implied_value_usd);
    assert.equal(row.name, source.get(row.slug).name);
    assert.equal(source.get(row.slug).symbol, null);
    assert.equal(source.get(row.slug).gecko_id, null);
    assert.ok(row.farm_steps.length >= 3 && row.farm_steps.length <= 12);
    for (const step of row.farm_steps) assert.ok(step.trim().length >= 20 && step.trim().length <= 600);
    assert.ok(row.low_usd <= row.implied_value_usd && row.high_usd >= row.implied_value_usd);
    assert.equal(row.tvl_usd, source.get(row.slug).tvl_usd);
  }
  assert.ok(new Set(rows.map(r => r.implied_value_usd)).size > 1);
  assert.deepEqual(model.rank(model.prepare({...snapshot, protocols: [...snapshot.protocols].reverse()})), rows);
  assert.deepEqual(model.rank(data), rows);
});
