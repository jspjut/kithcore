import {spawn} from 'node:child_process';
import {cp,rm,symlink,lstat} from 'node:fs/promises';
import path from 'node:path';
import {prepareRuntime,selectedWorld} from './worlds.js';

const args=process.argv.slice(2),index=args.indexOf('--script'),script=args[index+1];
const supported=['tools/build-assets.js','tools/preview-assets.js','tools/package-assets.js'];
let runtime;
try {
  if(index<0||!supported.includes(script))throw Error('--script must select build-assets, preview-assets or package-assets.');
  runtime=await prepareRuntime(selectedWorld(),{includeDevelopment:true});
  const source=path.join(runtime.directory,'client/assets');
  // Authoring explicitly writes the pack's generated asset directory. Ordinary
  // gameplay/test assemblies continue to use independent copies.
  const packAssets=path.join(runtime.worldDirectory,'client/assets');
  await lstat(packAssets);
  await rm(source,{recursive:true,force:true});await symlink(packAssets,source,'dir');
  const child=spawn(process.execPath,[script],{cwd:runtime.directory,stdio:'inherit',env:process.env});
  const code=await new Promise((resolve,reject)=>{child.once('exit',code=>resolve(code??1));child.once('error',reject);});
  if(code===0&&script==='tools/build-assets.js')await cp(path.join(runtime.directory,'shared/prop-profiles.js'),path.join(runtime.worldDirectory,'shared/prop-profiles.js'));
  process.exitCode=code;
}catch(error){console.error(error.message);process.exitCode=1;}
finally{if(runtime)await rm(runtime.directory,{recursive:true,force:true});}
