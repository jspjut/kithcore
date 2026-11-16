import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,mkdir,readFile,writeFile,rm,lstat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {packageRelease} from '../tools/package-release.js';
import {ROOT,listFiles} from '../tools/worlds.js';

const exec=promisify(execFile);
async function temporary(t){const dir=await mkdtemp(path.join(tmpdir(),'kithcore-artifacts-'));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;}
async function extract(archive,directory){await mkdir(directory,{recursive:true});await exec('tar',['-xzf',archive,'-C',directory]);return path.join(directory,(await (await import('node:fs/promises')).readdir(directory))[0]);}

test('engine, external world and starter artifacts verify their payloads without including private state or the Emberwild demo',async t=>{
  const dir=await temporary(t),world=path.join(dir,'custom'),output=path.join(dir,'output');await cp(path.join(ROOT,'worlds/minimal'),world,{recursive:true});
  const manifest=JSON.parse(await readFile(path.join(world,'world.json'),'utf8'));manifest.id='custom';manifest.name='Independent sample';await writeFile(path.join(world,'world.json'),JSON.stringify(manifest));
  const artifacts=await packageRelease({output,world});assert.deepEqual(artifacts.map(a=>a.kind),['engine','world','starter']);
  assert.match(artifacts[0].file,/^kithcore-engine-/);assert.match(artifacts[2].file,/-kithcore-/);
  for(const artifact of artifacts){
    const archive=path.join(output,artifact.file),bytes=await readFile(archive);assert.equal(createHash('sha256').update(bytes).digest('hex'),artifact.sha256);
    const extracted=await extract(archive,path.join(dir,artifact.kind));
    const release=JSON.parse(await readFile(path.join(extracted,'RELEASE-MANIFEST.json'),'utf8'));
    assert.equal(release.engineName,'kithcore');
    const files=await listFiles(extracted);assert.equal(files.length,release.files.length+1);
    assert.ok(files.every(file=>!/(^|\/)(data|backups|node_modules|\.git|\.tools|\.runtime|test-results)(\/|$)/.test(file)));
    assert.ok(files.every(file=>!file.includes('worlds/emberwild/')));
    for(const file of release.files){const data=await readFile(path.join(extracted,file.path));assert.equal(data.length,file.bytes);assert.equal(createHash('sha256').update(data).digest('hex'),file.sha256,file.path);}
    if(artifact.kind==='engine'){assert.ok(files.includes('PROVENANCE.md'));assert.ok(files.includes('docs/LIVE_UPDATES.md'));assert.ok(files.includes('tools/content-catalog.js'));assert.equal(JSON.parse(await readFile(path.join(extracted,'default-world.json'),'utf8')).world,'minimal');assert.ok((await lstat(path.join(extracted,'start.sh'))).mode&0o100);}
    if(artifact.kind==='world'){assert.equal(JSON.parse(await readFile(path.join(extracted,'world.json'),'utf8')).id,'custom');assert.ok(!files.some(file=>file==='server/world.js'));}
    if(artifact.kind==='starter'){
      assert.equal(JSON.parse(await readFile(path.join(extracted,'default-world.json'),'utf8')).world,'custom');
      assert.match(await readFile(path.join(extracted,'compose.override.yaml'),'utf8'),/\.\/worlds\/custom:\/world:ro/);
    }
  }
});

test('packaging refuses a private data directory inside a public world input',async t=>{
  const dir=await temporary(t),world=path.join(dir,'custom');await cp(path.join(ROOT,'worlds/minimal'),world,{recursive:true});await mkdir(path.join(world,'client/data'));await writeFile(path.join(world,'client/data/characters.json'),'private fixture');
  await assert.rejects(packageRelease({output:path.join(dir,'output'),world}),/Private\/generated/);
});

test('generated art downloads remain separate while world source generators stay in the world archive',async t=>{
 const dir=await temporary(t),world=path.join(dir,'source-world'),output=path.join(dir,'output');await cp(path.join(ROOT,'worlds/minimal'),world,{recursive:true});
 const assets=path.join(world,'client/assets');await mkdir(assets,{recursive:true});await mkdir(path.join(world,'client/asset-library'),{recursive:true});await writeFile(path.join(world,'client/asset-library/future-model.js'),'export const futureModel = true;\n');await writeFile(path.join(assets,'library-manifest.json'),JSON.stringify({assets:[{id:'future-model'}]}));await writeFile(path.join(assets,'model.glb'),Buffer.from([103,108,84,70]));await writeFile(path.join(assets,'old-art.zip'),'duplicate archive');
 const artifacts=await packageRelease({world,output,includeAssets:true});assert.ok(artifacts.some(a=>a.kind==='assets'));
 for(const kind of ['world','starter','assets']){const a=artifacts.find(a=>a.kind===kind),extracted=await extract(path.join(output,a.file),path.join(dir,kind)),files=await listFiles(extracted);assert.ok(files.every(f=>!f.endsWith('.zip')));assert.ok(files.some(f=>f.endsWith('model.glb')));if(kind==='assets')assert.ok(files.includes('LICENSE'));if(kind!=='assets')assert.ok(files.some(f=>f.endsWith('asset-library/future-model.js')));}
});
