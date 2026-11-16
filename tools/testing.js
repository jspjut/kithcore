import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {prepareRuntime} from './worlds.js';

export async function startTestWorld(selection='minimal',{dataDir,includeDevelopment=false,setupRuntime}={}){
  const temporary=await mkdtemp(path.join(tmpdir(),'kithcore-test-'));
  let child,runtime,logs='';
  try{
    runtime=await prepareRuntime(selection,{parent:temporary,includeDevelopment});
    const data=dataDir||path.join(temporary,'saves');
    if(setupRuntime)await setupRuntime(runtime,data);
    child=spawn(process.execPath,['server/index.js'],{cwd:runtime.directory,env:{...process.env,HOST:'127.0.0.1',PORT:'0',DATA_DIR:data,ALLOW_LEGACY_SAVES:'0'},stdio:['ignore','pipe','pipe']});
    const base=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{cleanup();reject(Error(`Server did not start: ${logs}`));},10000);
      const output=chunk=>{logs+=chunk;const match=logs.match(/http:\/\/localhost:(\d+)/);if(match){cleanup();resolve(`http://127.0.0.1:${match[1]}`);}};
      const exited=code=>{cleanup();reject(Error(`Server exited ${code}: ${logs}`));};
      const failed=error=>{cleanup();reject(error);};
      const cleanup=()=>{clearTimeout(timer);child.stdout.off('data',output);child.stderr.off('data',output);child.off('exit',exited);child.off('error',failed);};
      child.stdout.on('data',output);child.stderr.on('data',output);child.once('exit',exited);child.once('error',failed);
    });
    child.stdout.on('data',chunk=>logs+=chunk);child.stderr.on('data',chunk=>logs+=chunk);
    let stopped=false;
    return {base,data,runtime,child,get logs(){return logs;},async stop(){
      if(stopped)return;stopped=true;
      if(child.exitCode===null&&child.signalCode===null){const exit=once(child,'exit');child.kill('SIGTERM');const timeout=setTimeout(()=>child.kill('SIGKILL'),10000);try{await exit;}finally{clearTimeout(timeout);}}
      await rm(temporary,{recursive:true,force:true});
    }};
  }catch(error){
    if(child&&child.exitCode===null&&child.signalCode===null){const done=once(child,'exit');child.kill('SIGKILL');await done;}
    await rm(temporary,{recursive:true,force:true});throw error;
  }
}
