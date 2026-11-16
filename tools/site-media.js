import {readFile,mkdir,cp,writeFile,access} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {ROOT,loadWorld,listFiles} from './worlds.js';

export async function mediaKey(world,config){
 const hash=createHash('sha256').update('kithcore-site-media-v1\0').update(world.contentHash).update(JSON.stringify({scenes:config.scenes,flyby:config.flyby}));
 for(const directory of ['client','shared','server'])for(const file of await listFiles(path.join(ROOT,directory)))hash.update(directory+'/'+file+'\0').update(await readFile(path.join(ROOT,directory,file)));
 for(const file of ['package-lock.json','tools/worlds.js','tools/build-site.js','tools/site-media.js','tools/site-films.js','tools/site-demo-fixture.js','tools/site-template.js','site/scene-viewer.js'])hash.update(file+'\0').update(await readFile(path.join(ROOT,file)));
 return hash.digest('hex');
}
export async function restoreMedia(cache,output,key,scenes){
 if(!cache)return false;
 try{
  const marker=JSON.parse(await readFile(path.join(cache,'cache.json'),'utf8'));
  if(marker.key!==key)return false;
  const required=[...scenes.map(s=>s.id+'.png'),...['character','flyby','combat','social'].flatMap(id=>[id+'.png',id+'.webm']),'manifest.json'];
  for(const file of required)await access(path.join(cache,'media',file));
  await cp(path.join(cache,'media'),path.join(output,'media'),{recursive:true});
  return true;
 }catch(error){if(error.code==='ENOENT'||error instanceof SyntaxError)return false;throw error;}
}
export async function saveMedia(cache,output,key){
 if(!cache)return;
 await mkdir(cache,{recursive:true});await cp(path.join(output,'media'),path.join(cache,'media'),{recursive:true});
 await writeFile(path.join(cache,'cache.json'),JSON.stringify({key})+'\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const args=process.argv.slice(2),value=name=>args.includes(name)?args[args.indexOf(name)+1]:undefined;
  const world=await loadWorld(value('--world')||'minimal'),project=value('--project')||'engine';
  const config=JSON.parse(await readFile(path.join(project==='world'?world.directory:ROOT,'site/site.json'),'utf8'));
  console.log('key='+await mediaKey(world,config));
 }catch(error){console.error(error.message);process.exitCode=1;}
}
