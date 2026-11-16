import {spawn} from 'node:child_process';
import {readdir,rm,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {ROOT,prepareRuntime,selectedWorld} from './worlds.js';
import {bindWorldState} from '../server/world-state.js';

let runtime;
try {
  runtime=await prepareRuntime(selectedWorld(),{includeDevelopment:true});
  const args=process.argv.slice(2),index=args.indexOf('--script');
  let command;
  if(index>=0){
    const script=args[index+1];
    if(!script||!/^(tests|tools)\/[a-z0-9-]+(?:\.test)?\.js$/.test(script))throw Error('--script must name a tests/*.js or tools/*.js file.');
    command=script.endsWith('.test.js')?['--test',script]:[script];
  }else{
    const tests=(await readdir(path.join(runtime.directory,'tests'))).filter(file=>file.endsWith('.test.js')).sort();
    if(!tests.length)throw Error('This world has no tests/*.test.js files.');
    command=['--test',...tests.map(file=>`tests/${file}`)];
  }
  // Browser artifacts belong to the operator's ignored test-results directory.
  await mkdir(path.join(ROOT,'test-results'),{recursive:true});
  const {symlink}=await import('node:fs/promises');
  await symlink(path.join(ROOT,'test-results'),path.join(runtime.directory,'test-results'),'dir');
  // Older regression fixtures deliberately write an unmarked legacy document.
  const child=spawn(process.execPath,command,{cwd:runtime.directory,stdio:'inherit',env:{...process.env,ALLOW_LEGACY_SAVES:'1'}});
  const forward=signal=>child.kill(signal);
  const int=()=>forward('SIGINT'),term=()=>forward('SIGTERM');
  process.on('SIGINT',int);process.on('SIGTERM',term);
  const code=await new Promise((resolve,reject)=>{child.once('exit',code=>resolve(code??1));child.once('error',reject);});
  process.off('SIGINT',int);process.off('SIGTERM',term);
  if(code===0&&index>=0&&args[index+1].endsWith('-fixture.js')&&process.env.DATA_DIR){
    // Fixture generators refuse to overwrite saves. Stamp their newly created
    // disposable directory so a regular launcher can use it without legacy mode.
    await bindWorldState(path.resolve(process.env.DATA_DIR),{id:runtime.manifest.id,runtimeApi:runtime.manifest.runtimeApi},{allowLegacy:true});
  }
  process.exitCode=code;
}catch(error){console.error(error.message);process.exitCode=1;}
finally{if(runtime)await rm(runtime.directory,{recursive:true,force:true});}
