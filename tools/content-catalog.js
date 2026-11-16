#!/usr/bin/env node
// Offline discovery for trusted installed packs. Never opens operator saves.
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {prepareRuntime} from './worlds.js';

export async function contentCatalog({world='minimal',section,search=''}={}){
 const sections=['items','abilities','enemyTypes','npcs','quests','spawns','gatherables','assets'];
 if(section&&!sections.includes(section))throw Error(`Unknown section. Choose ${sections.join(', ')}`);
 const temporary=await mkdtemp(path.join(tmpdir(),'mmo-catalog-'));
 try{
  const runtime=await prepareRuntime(world,{parent:temporary});
  const content=await import(pathToFileURL(path.join(runtime.directory,'shared/content.js')).href);
  const {CLASSES}=await import(pathToFileURL(path.join(runtime.directory,'shared/adventurers.js')).href);
  const entries=value=>Array.isArray(value)?value:Object.entries(value).map(([id,definition])=>({...definition,id}));
  const registries={items:entries(content.ITEMS),abilities:entries(content.SKILLS).filter(v=>CLASSES[v.classId]?.skills.includes(v.id)&&!v.travel),enemyTypes:entries(content.ENEMY_TYPES),npcs:entries(content.NPCS),quests:entries(content.QUESTS),spawns:entries(content.ENEMY_SPAWNS),gatherables:entries(content.GATHERABLES)};
  // Optional world-owned, source-level art registry; never require generated exports.
  if(!section||section==='assets'){
   const module=path.join(runtime.directory,'shared/complete-assets.js');
   const {existsSync}=await import('node:fs');
   registries.assets=existsSync(module)?entries((await import(pathToFileURL(module).href)).EXPANSION_ASSETS):[];
  }
  const needle=search.toLowerCase();
  const selected=Object.fromEntries((section?[section]:sections).map(key=>[key,registries[key].filter(v=>JSON.stringify(v).toLowerCase().includes(needle))]));
  return {worldId:runtime.manifest.id,worldVersion:runtime.manifest.version,runtimeApi:runtime.manifest.runtimeApi,baseContentHash:runtime.contentHash,source:'authored baseline; excludes accepted live additions',...selected};
 }finally{await rm(temporary,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const args=process.argv.slice(2),options={};
  for(let i=0;i<args.length;i++){
   if(args[i]==='--help'){console.log('node tools/content-catalog.js [--world minimal|/path/to/world] [--section items|abilities|enemyTypes|npcs|quests|spawns|gatherables|assets] [--search text]\nJSON baseline catalog for trusted packs; no running server or art build required.');process.exit(0);}
   const key={'--world':'world','--section':'section','--search':'search'}[args[i]];
   if(!key||!args[i+1]||args[i+1].startsWith('--'))throw Error('Unknown option or missing value; use --help');
   options[key]=args[++i];
  }
  console.log(JSON.stringify(await contentCatalog(options),null,2));
 }catch(error){console.error(error.message);process.exitCode=1;}
}
