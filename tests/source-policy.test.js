import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {checkRepository,sourceProblem} from '../tools/check-source.mjs';
import {ROOT} from '../tools/worlds.js';
import {existsSync} from 'node:fs';
import {rewriteRootReferences} from '../tools/build-site.js';

test('source-only policy blocks staged binary content even if the working copy was replaced with text',async t=>{
 const directory=await mkdtemp(path.join(tmpdir(),'mmo-source-policy-'));t.after(()=>rm(directory,{recursive:true,force:true}));const git=(...args)=>execFileSync('git',args,{cwd:directory});git('init','-q');await writeFile(path.join(directory,'disguised.txt'),Buffer.from([0,1,2,3]));git('add','disguised.txt');await writeFile(path.join(directory,'disguised.txt'),'Looks like source now');assert.match(checkRepository(directory).problems.join('\n'),/NUL bytes/);
 assert.ok(sourceProblem('client/assets/models/model.glb',Buffer.from('text')));assert.ok(sourceProblem('.site/index.html',Buffer.from('text')));assert.ok(sourceProblem('clip.webm',Buffer.from('text')));assert.ok(sourceProblem('source.js',Buffer.alloc(1024*1024+1,65)));assert.equal(sourceProblem('icon.svg',Buffer.from('<svg/>')),null);
});
test('independent Emberwild repository retains the same standalone source policy',{skip:!existsSync(path.join(ROOT,'worlds/emberwild/tools/check-source.mjs'))},async()=>{assert.equal(await readFile(path.join(ROOT,'tools/check-source.mjs'),'utf8'),await readFile(path.join(ROOT,'worlds/emberwild/tools/check-source.mjs'),'utf8'));});
test('static module URLs work below a GitHub project prefix without rewriting external URLs',()=>{
 assert.equal(rewriteRootReferences("import x from '/shared/content.js';const icon='/icons.svg';const remote='https://example.com/a';",'asset-library/gallery.js'),"import x from '../shared/content.js';const icon='../icons.svg';const remote='https://example.com/a';");
 assert.equal(rewriteRootReferences('src="/assets/previews/fox.png"','asset-library/gallery.js'),'src="./assets/previews/fox.png"');
 assert.equal(rewriteRootReferences('src="/asset-library/gallery.js"','asset-library.html'),'src="./asset-library/gallery.js"');
 assert.equal(rewriteRootReferences('"three/addons/":"/vendor/three-addons/"','asset-library.html'),'"three/addons/":"./vendor/three-addons/"');
 assert.equal(rewriteRootReferences("import x from '../shared/content.js'",'scene.js'),"import x from './shared/content.js'");
 assert.equal(rewriteRootReferences("import x from '/shared/content.js'",'scene.js'),"import x from './shared/content.js'");
});

test('landing pages expose four focused looping demos with engine-first positioning',async()=>{
 const {landingPage}=await import('../tools/site-template.js'),config=JSON.parse(await readFile(path.join(ROOT,'site/site.json'),'utf8'));
 const html=landingPage(config,{worldId:'minimal',engineVersion:'test',worldVersion:'test'});
 for(const clip of ['character','flyby','combat','social'])assert.ok(html.includes(`./media/${clip}.webm`));
 assert.ok(html.includes('autoplay loop muted playsinline'));assert.ok(html.includes('toggle-demos'));assert.ok(html.includes('KithCore'));assert.ok(config.features.some(f=>f.text.includes('offline mail')));
});

test('staged NPC demo emits an actual two-speaker server exchange without editing world definitions',async t=>{
 const {prepareRuntime}=await import('../tools/worlds.js'),{cp}=await import('node:fs/promises'),{pathToFileURL}=await import('node:url');
 const parent=await mkdtemp(path.join(tmpdir(),'mmo-social-film-'));t.after(()=>rm(parent,{recursive:true,force:true}));const runtime=await prepareRuntime('minimal',{parent});await cp(path.join(ROOT,'tools/site-demo-fixture.js'),path.join(runtime.directory,'server/site-demo-fixture.js'));
 const from=file=>import(pathToFileURL(path.join(runtime.directory,file)).href),{World}=await from('server/world.js'),{installDemo}=await from('server/site-demo-fixture.js'),content=await from('shared/content.js');const original=JSON.stringify([content.NPCS,content.ENEMY_SPAWNS,content.ENEMY_TYPES]);
 const world=new World();installDemo(world,'social');world.addPlayer('Observer');for(let i=0;i<270;i++)world.step(.05);
 const speeches=world.events.filter(e=>e.type==='social'&&e.cause==='showcase-conversation');assert.equal(speeches.length,4);assert.equal(new Set(speeches.map(e=>e.source)).size,2);assert.deepEqual(speeches.map(e=>e.emote),['wave','nod','laugh','bow']);assert.equal(JSON.stringify([content.NPCS,content.ENEMY_SPAWNS,content.ENEMY_TYPES]),original);
});
