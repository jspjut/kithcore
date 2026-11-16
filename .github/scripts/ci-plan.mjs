import {execFileSync} from 'node:child_process';
import {readFileSync,appendFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export function classify(files,project='engine'){
 const workflow=files.some(f=>f.startsWith('.github/workflows/')||f.startsWith('.github/scripts/'));
 const pin=files.includes('.github/engine.json');
 const runtime=files.some(f=>/^(client|shared|server|worlds\/minimal)\//.test(f)||/^(world\.json|package(?:-lock)?\.json)$/.test(f));
 const code=workflow||pin||runtime||files.some(f=>/^(tests|tools)\//.test(f)||/^(Dockerfile|compose\.yaml|start\.sh)$/.test(f));
 const browser=workflow||pin||runtime||files.some(f=>/^tools\/(?:.*browser.*|testing|worlds)\.js$/.test(f));
 const art=project==='world'&&(pin||files.some(f=>/^client\/asset-library\//.test(f)||/^shared\/.*(?:asset|equipment|ecology|prop-profiles)/.test(f)||/^tools\/(?:build-assets|preview-assets)\.js$/.test(f)||f==='world.json')||workflow);
 const container=project==='engine'&&(workflow||runtime||files.some(f=>/^(Dockerfile|compose\.yaml|\.dockerignore)$/.test(f)||/^tools\/(run|worlds|healthcheck|live-update)\.js$/.test(f)));
 const network=project==='world'&&(workflow||pin||files.some(f=>/^server\//.test(f)||/^shared\/(?:chat|social|mail|travel|city-routines|zone-regions|zone-layout|content|adventurers)/.test(f)||/^tests\/(?:network|zone-network|correspondence-network)\.test\.js$/.test(f)));
 const geometry=project==='world'&&(workflow||pin||files.some(f=>/^shared\/(?:buildings|props|terrain|continent|city-topography|reach-geography|world-layouts|zone-layout|founding-inns)/.test(f)||f==='client/asset-library/props.js'||/^tests\/(?:buildings|continent|settlements)\.test\.js$/.test(f)));
 const full=code;
 return {code,browser,art,container,network,geometry,full};
}
export function shouldRunNightly({files=[],sameHead=false,hasPrevious=false,recent=false,project='engine'}){
 if(sameHead)return false;
 return classify(files,project).full&&(hasPrevious||recent);
}
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const changed=(base,head='HEAD')=>git('diff','--name-only','--no-renames',base,head).split('\n').filter(Boolean);
async function previousFullRun(env,event){
 if(!env.GITHUB_TOKEN||!env.GITHUB_REPOSITORY)throw Error('Nightly change checks require the repository GITHUB_TOKEN (actions: read).');
 const branch=event.repository.default_branch;
 const url=new URL(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/actions/workflows/full.yml/runs`);
 url.search=new URLSearchParams({branch,event:'schedule',status:'completed',per_page:'100'}).toString();
 const response=await fetch(url,{headers:{Authorization:`Bearer ${env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error(`Cannot inspect earlier full verification runs: HTTP ${response.status}`);
 const data=await response.json();
 return data.workflow_runs.find(r=>String(r.id)!==env.GITHUB_RUN_ID&&r.event==='schedule'&&r.head_branch===branch);
}
export async function plan(env=process.env){
 const event=env.GITHUB_EVENT_PATH?JSON.parse(readFileSync(env.GITHUB_EVENT_PATH,'utf8')):{};
 const project=env.CI_PROJECT||'engine',mode=env.CI_MODE||'quick',head=git('rev-parse','HEAD');
 if(!['engine','world'].includes(project)||!['quick','full'].includes(mode))throw Error('Invalid CI project or mode.');
 let files,reason;
 if(mode==='full'&&env.GITHUB_EVENT_NAME!=='schedule')return {...classify(git('ls-files').split('\n'),project),run:true,reason:'Explicit full verification (manual or release).'};
 if(mode==='full'){
  const prior=await previousFullRun(env,event);
  const hasPrevious=!!prior;
  let recent=false;
  if(prior){
   try{files=changed(prior.head_sha);}catch{files=git('ls-files').split('\n');}
  }else{
   // Bootstrap only if relevant commits exist in the preceding 24 hours.
   files=git('log','--since=24 hours ago','--name-only','--format=','HEAD').split('\n').filter(Boolean);
   recent=files.length>0;
  }
  const run=shouldRunNightly({files,sameHead:prior?.head_sha===head,hasPrevious,recent,project});
  reason=run?'Relevant changes since the previous nightly attempt (first run: 24-hour lookback).':'No new relevant source; expensive nightly jobs skipped.';
  return {...classify(files,project),run,reason};
 }
 if(env.GITHUB_EVENT_NAME==='pull_request')files=changed(event.pull_request.base.sha);
 else if(env.GITHUB_EVENT_NAME==='push'&&event.before&&!/^0+$/.test(event.before))files=changed(event.before);
 else files=git('ls-files').split('\n');
 return {...classify(files,project),run:true,reason:'Changed-file selection for routine verification.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const result=await plan();
  if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,Object.entries(result).map(([k,v])=>`${k}=${v}`).join('\n')+'\n');
  console.log(JSON.stringify(result,null,2));
 }catch(error){console.error(error.message);process.exitCode=1;}
}
