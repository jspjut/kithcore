import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {cp,mkdtemp,mkdir,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {prepareRuntime,selectedWorld} from './worlds.js';

export async function buildWorldAssets(selection){
 const parent=await mkdtemp(path.join(tmpdir(),'mmo-art-build-'));let server;
 const run=async(directory,script,env={})=>{const child=spawn(process.execPath,[script],{cwd:directory,env:{...process.env,...env},stdio:'inherit'});const [code]=await once(child,'exit');if(code!==0)throw Error(`${script} failed (${code})`);};
 try{
  const runtime=await prepareRuntime(selection,{parent,includeDevelopment:true});
  await run(runtime.directory,'tools/build-assets.js');
  let logs='';server=spawn(process.execPath,['server/index.js'],{cwd:runtime.directory,env:{...process.env,HOST:'127.0.0.1',PORT:'0',DATA_DIR:path.join(parent,'disposable-saves'),ALLOW_LEGACY_SAVES:'0'},stdio:['ignore','pipe','pipe']});
  const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(`Preview server did not start: ${logs}`)),15000);const output=chunk=>{logs+=chunk;const match=logs.match(/http:\/\/localhost:(\d+)/);if(match){clearTimeout(timer);resolve(`http://127.0.0.1:${match[1]}`);}};server.stdout.on('data',output);server.stderr.on('data',output);server.once('error',e=>{clearTimeout(timer);reject(e);});server.once('exit',code=>{clearTimeout(timer);reject(Error(`Preview exited ${code}: ${logs}`));});});
  await run(runtime.directory,'tools/preview-assets.js',{TEST_URL:base});
  await run(runtime.directory,'tests/asset-library.test.js');
  const assets=path.join(runtime.worldDirectory,'client/assets');await mkdir(assets,{recursive:true});
  for(const dir of ['models','previews','icons'])await rm(path.join(assets,dir),{recursive:true,force:true});
  await cp(path.join(runtime.directory,'client/assets'),assets,{recursive:true});
  await cp(path.join(runtime.directory,'shared/prop-profiles.js'),path.join(runtime.worldDirectory,'shared/prop-profiles.js'));
  const manifest=JSON.parse(await readFile(path.join(assets,'library-manifest.json'),'utf8'));
  console.log(`Complete art library: ${manifest.assets.length} designs, ${Object.keys(manifest.regions).length} palettes, ${manifest.gearSets.length} assembled sets.`);
  return {world:runtime.manifest.id,assets,manifest};
 }finally{if(server&&server.exitCode===null&&server.signalCode===null){const done=once(server,'exit');server.kill('SIGTERM');const timer=setTimeout(()=>server.kill('SIGKILL'),5000);await done;clearTimeout(timer);}await rm(parent,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{await buildWorldAssets(selectedWorld());}catch(error){console.error(error.message);process.exitCode=1;}}
