import {spawn} from 'node:child_process';
import {rm} from 'node:fs/promises';
import path from 'node:path';
import {ROOT,prepareRuntime,selectedWorld} from './worlds.js';

let runtime;
try {
  runtime=await prepareRuntime(selectedWorld());
  const child=spawn(process.execPath,[path.join(ROOT,'tools/validate-runtime.js'),runtime.directory],{stdio:'inherit'});
  process.exitCode=await new Promise((resolve,reject)=>{child.once('exit',code=>resolve(code??1));child.once('error',reject);});
}catch(error){console.error(error.message);process.exitCode=1;}
finally{if(runtime)await rm(runtime.directory,{recursive:true,force:true});}
