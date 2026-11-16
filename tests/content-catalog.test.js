import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {contentCatalog} from '../tools/content-catalog.js';
import {prepareRuntime,ROOT} from '../tools/worlds.js';
import {landingPage} from '../tools/site-template.js';

test('catalog discovers baseline templates usable by the live validator without a server or art exports',async t=>{
 const catalog=await contentCatalog(),parent=await mkdtemp(path.join(tmpdir(),'catalog-test-'));
 t.after(()=>rm(parent,{recursive:true,force:true}));
 const runtime=await prepareRuntime('minimal',{parent});
 const {prepareLivePatch}=await import(pathToFileURL(path.join(runtime.directory,'shared/live-content.js')).href);
 assert.equal(catalog.baseContentHash,runtime.contentHash);
 assert.deepEqual(catalog.assets,[]);
 assert.ok(catalog.npcs.length&&catalog.quests.length);
 for(const template of catalog.items)assert.doesNotThrow(()=>prepareLivePatch({id:'catalog-item-test',worldId:'minimal',items:{catalogItem:{template:template.id,values:{name:'Catalog item'}}}}));
 assert.ok(catalog.abilities.length);
 for(const template of catalog.abilities)assert.doesNotThrow(()=>prepareLivePatch({id:'catalog-ability-test',worldId:'minimal',abilities:{catalogAbility:{template:template.id,values:{name:'Catalog ability'}}}}));
});

test('catalog filters case-insensitively, omits unrelated sections and rejects unknown sections',async()=>{
 const result=await contentCatalog({section:'items',search:'ToNiC'});
 assert.ok(result.items.length);
 assert.ok(result.items.every(v=>JSON.stringify(v).toLowerCase().includes('tonic')));
 assert.equal(result.npcs,undefined);
 await assert.rejects(contentCatalog({section:'private-saves'}),/Unknown section/);
});

test('both informational sites expose provenance, deployment and live API links with project relationships',async()=>{
 const config=JSON.parse(await readFile(path.join(ROOT,'site/site.json'),'utf8'));
 for(const worldId of ['minimal','emberwild']){
  const html=landingPage(config,{repository:'example/project',worldId,engineVersion:'test',worldVersion:'test',engineRepository:'example/engine',emberwildRepository:'example/world'});
  assert.ok(html.includes('GPT-6.1 Sol and GPT-6.1 Astra'));
  assert.ok(html.includes('https://github.com/example/engine/blob/HEAD/docs/LIVE_UPDATES.md'));
  assert.ok(html.includes('./docs/LIVE_UPDATES.md'));
  assert.ok(html.includes('./PROVENANCE.md'));
  assert.ok(html.includes(worldId==='minimal'?'https://github.com/example/world':'Required base engine'));
  assert.ok(html.includes(worldId==='minimal'?'./docs/DEPLOYMENT.md':'./world-docs/DEPLOYMENT.md'));
 }
});
