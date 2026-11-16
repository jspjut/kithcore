import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {ROOT,loadWorld} from '../tools/worlds.js';
import {mediaKey,restoreMedia,saveMedia} from '../tools/site-media.js';
test('media keys ignore site prose but change for scenes and gameplay content',async()=>{
 const world=await loadWorld('minimal'),config=JSON.parse(await readFile(path.join(ROOT,'site/site.json'),'utf8')),key=await mediaKey(world,config);
 assert.equal(await mediaKey(world,{...config,description:'Updated informational copy'}),key);
 assert.notEqual(await mediaKey({...world,contentHash:'different'},config),key);
 assert.notEqual(await mediaKey(world,{...config,scenes:[{...config.scenes[0],x:999},...config.scenes.slice(1)]}),key);
});
test('media cache refuses mismatched or incomplete output and restores complete source-matched media',async t=>{
 const parent=await mkdtemp(path.join(tmpdir(),'kithcore-media-'));t.after(()=>rm(parent,{recursive:true,force:true}));
 const source=path.join(parent,'source'),cache=path.join(parent,'cache'),output=path.join(parent,'output');await mkdir(path.join(source,'media'),{recursive:true});
 for(const id of ['character','flyby','combat','social'])for(const ext of ['png','webm'])await writeFile(path.join(source,'media',id+'.'+ext),'fixture');
 await writeFile(path.join(source,'media/manifest.json'),'{}');await saveMedia(cache,source,'source-key');
 assert.equal(await restoreMedia(cache,output,'other-key',[]),false);
 assert.equal(await restoreMedia(cache,output,'source-key',[{id:'missing'}]),false);
 assert.equal(await restoreMedia(cache,output,'source-key',[]),true);
 assert.equal(await readFile(path.join(output,'media/combat.webm'),'utf8'),'fixture');
});
