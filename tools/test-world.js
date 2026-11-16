import {spawn} from 'node:child_process';
import {readdir,rm,mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {ROOT,prepareRuntime,selectedWorld} from './worlds.js';
import {bindWorldState} from '../server/world-state.js';

let runtime;
try {
  runtime=await prepareRuntime(selectedWorld(),{includeDevelopment:true});
  const args=process.argv.slice(2),index=args.indexOf('--script');
  const suiteIndex=args.indexOf('--suite'),suite=suiteIndex>=0?args[suiteIndex+1]:'full';
  if(!suite||!/^[-a-z0-9]+$/.test(suite))throw Error('--suite requires a suite name.');
  const timeoutIndex=args.indexOf('--timeout'),seconds=timeoutIndex>=0?Number(args[timeoutIndex+1]):suite==='fast'?300:900;
  if(!Number.isFinite(seconds)||seconds<1||seconds>5400)throw Error('--timeout must be 1–5400 seconds.');
  let command;
  if(index>=0){
    const script=args[index+1];
    if(!script||!/^(tests|tools)\/[a-z0-9-]+(?:\.test)?\.js$/.test(script))throw Error('--script must name a tests/*.js or tools/*.js file.');
    command=script.endsWith('.test.js')?['--test','--test-reporter=tap',script]:[script];
  }else{
    let tests=(await readdir(path.join(runtime.directory,'tests'))).filter(file=>file.endsWith('.test.js')).sort();
    if(!tests.length)throw Error('This world has no tests/*.test.js files.');
    const options=['--test','--test-reporter=tap','--test-concurrency=2'];
    if(suite!=='full'){
      const suites=JSON.parse(await readFile(path.join(runtime.directory,'tests/suites.json'),'utf8')),profile=suites[suite];
      if(!profile||['includeFiles','excludeFiles','excludeNames'].some(k=>profile[k]!==undefined&&!Array.isArray(profile[k])))throw Error(`Unknown or invalid test suite: ${suite}`);
      profile.excludeFiles??=[];profile.excludeNames??=[];
      if(profile.concurrency!==undefined){if(!Number.isInteger(profile.concurrency)||profile.concurrency<1||profile.concurrency>8)throw Error('Suite concurrency must be 1–8.');options[2]='--test-concurrency='+profile.concurrency;}
      if(profile.includeFiles)for(const file of profile.includeFiles)if(!tests.includes(file))throw Error(`Suite includes an unknown test file: ${file}`);
      for(const file of profile.excludeFiles)if(!tests.includes(file))throw Error(`Suite excludes an unknown test file: ${file}`);
      tests=tests.filter(file=>(!profile.includeFiles||profile.includeFiles.includes(file))&&!profile.excludeFiles.includes(file));
      const escape=value=>[...value].map(c=>'^$.*+?()[]{}|'.includes(c)||c.charCodeAt(0)===92?String.fromCharCode(92)+c:c).join('');
      if(profile.excludeNames.length)options.push('--test-skip-pattern='+profile.excludeNames.map(escape).join('|'));
    }
    if(!tests.length)throw Error('The selected suite contains no test files.');
    console.log(`Running ${suite} suite: ${tests.length} files, ${seconds}s deadline.`);
    command=[...options,...tests.map(file=>`tests/${file}`)];
  }
  // Browser artifacts belong to the operator's ignored test-results directory.
  await mkdir(path.join(ROOT,'test-results'),{recursive:true});
  const {symlink}=await import('node:fs/promises');
  await symlink(path.join(ROOT,'test-results'),path.join(runtime.directory,'test-results'),'dir');
  // Older regression fixtures deliberately write an unmarked legacy document.
  const child=spawn(process.execPath,command,{cwd:runtime.directory,stdio:'inherit',detached:process.platform!=='win32',env:{...process.env,ALLOW_LEGACY_SAVES:'1'}});
  const forward=signal=>{try{if(!child.pid)return;if(process.platform==='win32')child.kill(signal);else process.kill(-child.pid,signal);}catch(error){if(error.code!=='ESRCH')throw error;}};
  let timedOut=false,force;
  const deadline=setTimeout(()=>{timedOut=true;console.error(`World tests exceeded ${seconds}s; terminating the test process group.`);forward('SIGTERM');force=setTimeout(()=>forward('SIGKILL'),5000);},seconds*1000);
  const int=()=>forward('SIGINT'),term=()=>forward('SIGTERM');
  process.on('SIGINT',int);process.on('SIGTERM',term);
  const code=await new Promise((resolve,reject)=>{child.once('exit',code=>resolve(code??1));child.once('error',reject);});
  if(timedOut)forward('SIGKILL');
  clearTimeout(deadline);clearTimeout(force);
  process.off('SIGINT',int);process.off('SIGTERM',term);
  if(code===0&&index>=0&&args[index+1].endsWith('-fixture.js')&&process.env.DATA_DIR){
    // Fixture generators refuse to overwrite saves. Stamp their newly created
    // disposable directory so a regular launcher can use it without legacy mode.
    await bindWorldState(path.resolve(process.env.DATA_DIR),{id:runtime.manifest.id,runtimeApi:runtime.manifest.runtimeApi},{allowLegacy:true});
  }
  process.exitCode=timedOut?124:code;
}catch(error){console.error(error.message);process.exitCode=1;}
finally{if(runtime)await rm(runtime.directory,{recursive:true,force:true});}
