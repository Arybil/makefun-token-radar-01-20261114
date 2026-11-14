// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdtempSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const input = resolve(process.env.RADAR_SNAPSHOT || '../../kits/token-radar-01-kit/input/snapshot.json');
const hash = b => createHash('sha256').update(b).digest('hex');
const files = dir => readdirSync(dir).sort().flatMap(n => statSync(join(dir,n)).isDirectory() ? files(join(dir,n)).map(p=>n+'/'+p) : [n]);
test('Node entrypoint writes deterministic offline artifacts and canonical dossier', async () => {
  assert.ok(existsSync('main.ts'), 'missing Node22 artifact entrypoint');
  const a=mkdtempSync(resolve('.test-output-a-')), b=mkdtempSync(resolve('.test-output-b-'));
  for (const dir of [a,b]) execFileSync(process.execPath,['main.ts','--input',input,'--output',dir]);
  assert.deepEqual(files(a),files(b));
  for(const path of files(a)) assert.equal(hash(readFileSync(join(a,path))),hash(readFileSync(join(b,path))),path);
  const board=JSON.parse(readFileSync(join(a,'board.json'),'utf8'));
  assert.ok(board.rows.length>=100);
  const {buildDossier}=await import('../vendor/makefun-board.ts');
  assert.deepEqual(readFileSync(join(a,'dossier.json')),Buffer.from(buildDossier(a,{text_max_bytes:65536})));
  const dossier=JSON.parse(readFileSync(join(a,'dossier.json'),'utf8'));
  assert.ok(statSync(join(a,'dossier.json')).size<=1572864);
  assert.equal(dossier.images.length,3);
  assert.ok(!dossier.text.includes('[Cut at'), 'source must fit completely in dossier');
  const dash=files(join(a,'dashboard'));
  assert.ok(dash.includes('index.html') && dash.some(x=>x.endsWith('.css')) && dash.some(x=>x.endsWith('.js')));
  for(const p of dash){
    assert.match(p,/^[A-Za-z0-9_][A-Za-z0-9._-]*$/);
    const text=readFileSync(join(a,'dashboard',p),'utf8');
    if(p.endsWith('.css')) assert.ok(!/https?:\/\//.test(text));
    if(p.endsWith('.html')) assert.ok(!/=\s*["'][^"']*https?:\/\//.test(text));
  }
  assert.ok(dash.reduce((n,p)=>n+statSync(join(a,'dashboard',p)).size,0)<64000);
  for(const file of files(join(a,'screenshots'))){
    const image=readFileSync(join(a,'screenshots',file));
    assert.ok(image.length<=524288);
    if(file.endsWith('.png')) {
      const width=image.readUInt32BE(16),height=image.readUInt32BE(20);
      assert.ok(Math.max(width,height)<=1440 && Math.min(width,height)>=800);
    }
  }
});
