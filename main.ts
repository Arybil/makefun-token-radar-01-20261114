// SPDX-License-Identifier: MIT
// Node 22.18+, standard library only. No network, packages, clocks or randomness.
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, statSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import './dashboard/model.js';
import { buildDossier } from './vendor/makefun-board.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
function option(name: string, fallback: string): string {
  const key = '--' + name, index = process.argv.indexOf(key);
  const inline = process.argv.find(arg => arg.startsWith(key + '='));
  return inline ? inline.slice(key.length + 1) : index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}
try {
  let input = option('input', '/input/snapshot.json');
  if (existsSync(input) && statSync(input).isDirectory()) input = join(input, 'snapshot.json');
  const out = resolve(option('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output'));
  if (out === resolve(root) || out === resolve(root, 'dashboard')) throw new Error('Output must be separate from source');
  const bytes = readFileSync(input);
  const snapshot = JSON.parse(bytes.toString('utf8'));
  const model = (globalThis as any).RadarModel;
  const data = model.prepare(snapshot);
  const rows = model.rank(data);
  if (rows.length < 100 || rows.length > 4000) throw new Error('Snapshot does not produce 100–4000 research leads');
  for (const row of rows) {
    if (!Number.isSafeInteger(row.implied_value_usd) || row.implied_value_usd <= 0 || row.implied_value_usd > 1e14) throw new Error('Invalid value for ' + row.slug);
    if (row.farm_steps.length < 3 || row.farm_steps.length > 12 || row.farm_steps.some((s: string) => s.trim().length < 20 || s.trim().length > 600)) throw new Error('Invalid farm plan for ' + row.slug);
  }
  mkdirSync(out, {recursive:true});
  cpSync(join(root,'dashboard'),join(out,'dashboard'),{recursive:true});
  writeFileSync(join(out,'board.json'),JSON.stringify({as_of:data.as_of,model:'afterglow-peer-v1',snapshot_sha256:createHash('sha256').update(bytes).digest('hex'),rows})+'\n');
  // Data stays beside dashboard/, matching the kit's offline pattern. Source and model remain fully visible in dossier.
  writeFileSync(join(out,'data.js'),'window.RADAR_DATA='+JSON.stringify(data).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029')+';\n');
  if (!process.argv.includes('--preview')) {
    const shots = join(root,'screenshots');
    if (!existsSync(shots) || readdirSync(shots).filter(n=>!n.startsWith('.')).length !== 3) throw new Error('Capture the three real screenshots before the final build; --preview builds the page first');
    cpSync(shots,join(out,'screenshots'),{recursive:true});
    const dossier = buildDossier(out,{text_max_bytes:65536,screenshots:{max:4,max_bytes:524288},dashboard:{max_files:400,max_bytes:4194304}});
    if (dossier.length > 1572864) throw new Error('Dossier exceeds competition 1.5 MiB cap');
    writeFileSync(join(out,'dossier.json'),dossier);
  }
  process.stdout.write(`Afterglow: ${data.universe} observed / ${rows.length} ranked / ${data.watch.length} watchlist / ${data.live} recorded-token protocols set aside\nOutput: ${out}${process.argv.includes('--preview')?' (preview; no dossier)':''}\n`);
} catch (error) {
  process.stderr.write('Afterglow: '+(error as Error).message+'\n');
  process.exitCode = 1;
}
