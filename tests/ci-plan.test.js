import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {classify,shouldRunNightly} from '../.github/scripts/ci-plan.mjs';

test('nightly gate skips unchanged source and docs-only revisions, including after a failed full attempt',()=>{
 assert.equal(shouldRunNightly({files:['server/world.js'],sameHead:true,hasPrevious:true}),false);
 assert.equal(shouldRunNightly({files:[],hasPrevious:true}),false);
 assert.equal(shouldRunNightly({files:['README.md','docs/WORLDS.md','LICENSE'],hasPrevious:true}),false);
 assert.equal(shouldRunNightly({files:['server/world.js'],hasPrevious:true}),true);
 assert.equal(shouldRunNightly({files:['shared/content.js'],project:'world',hasPrevious:true}),true);
});
test('initial scheduled gate requires a relevant change in its bootstrap lookback',()=>{
 assert.equal(shouldRunNightly({files:['server/world.js'],recent:false}),false);
 assert.equal(shouldRunNightly({files:['README.md'],recent:true}),false);
 assert.equal(shouldRunNightly({files:['server/world.js'],recent:true}),true);
});
test('routine selection distinguishes world source, art, docs, and engine container changes',()=>{
 for(const project of ['engine','world'])assert.deepEqual(classify(['docs/DEPLOYMENT.md'],project),{code:false,browser:false,art:false,container:false,network:false,geometry:false,full:false});
 assert.equal(classify(['shared/story-content.js'],'world').art,false);
 assert.equal(classify(['shared/content.js'],'world').browser,true);
 assert.equal(classify(['client/asset-library/creatures.js'],'world').art,true);
 assert.equal(classify(['.github/engine.json'],'world').art,true);
 assert.equal(classify(['Dockerfile']).container,true);
 assert.equal(classify(['shared/continent.js'],'world').geometry,true);
 assert.equal(classify(['server/npc-dialogue.js'],'world').network,true);
 assert.equal(classify(['client/world-ui.js'],'world').network,false);
 assert.equal(classify(['tests/flight-presentation.test.js']).browser,false);
});
test('standalone repositories use identical change-gate logic',async()=>{
 try{assert.equal(await readFile(new URL('../worlds/emberwild/.github/scripts/ci-plan.mjs',import.meta.url),'utf8'),await readFile(new URL('../.github/scripts/ci-plan.mjs',import.meta.url),'utf8'));}
 catch(error){if(error.code!=='ENOENT')throw error;}
});

test('scheduled planning compares real Git revisions and skips unchanged or docs-only history',async t=>{
 const {mkdtemp,writeFile,mkdir,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),path=await import('node:path'),{execFileSync}=await import('node:child_process'),{plan}=await import('../.github/scripts/ci-plan.mjs');
 const original=process.cwd(),directory=await mkdtemp(path.join(tmpdir(),'kithcore-nightly-'));
 t.after(async()=>{process.chdir(original);await rm(directory,{recursive:true,force:true});});
 const git=(...args)=>execFileSync('git',args,{cwd:directory,encoding:'utf8',env:{...process.env,GIT_AUTHOR_DATE:'2001-01-01T00:00:00Z',GIT_COMMITTER_DATE:'2001-01-01T00:00:00Z'}}).trim();
 git('init','-q');await mkdir(path.join(directory,'server'));await writeFile(path.join(directory,'server/world.js'),'one');git('add','.');git('-c','user.name=CI Test','-c','user.email=ci@example.invalid','commit','-qm','initial');const baseline=git('rev-parse','HEAD');
 const eventFile=path.join(directory,'event.json');await writeFile(eventFile,JSON.stringify({repository:{default_branch:'main'}}));
 const env={CI_MODE:'full',CI_PROJECT:'engine',GITHUB_EVENT_NAME:'schedule',GITHUB_EVENT_PATH:eventFile,GITHUB_TOKEN:'test-token',GITHUB_REPOSITORY:'example/engine',GITHUB_RUN_ID:'2'};
 let runs=[{id:1,event:'schedule',head_branch:'main',head_sha:baseline,conclusion:'failure'}];
 t.mock.method(globalThis,'fetch',async url=>{assert.equal(new URL(url).searchParams.get('event'),'schedule');return {ok:true,json:async()=>({workflow_runs:runs})};});
 process.chdir(directory);
 assert.equal((await plan(env)).run,false);
 await writeFile(path.join(directory,'README.md'),'docs');git('add','README.md');git('-c','user.name=CI Test','-c','user.email=ci@example.invalid','commit','-qm','docs');assert.equal((await plan(env)).run,false);
 await writeFile(path.join(directory,'server/world.js'),'two');git('add','server/world.js');git('-c','user.name=CI Test','-c','user.email=ci@example.invalid','commit','-qm','runtime');assert.equal((await plan(env)).run,true);
 runs=[];assert.equal((await plan(env)).run,false); // no recent commits on first nightly
 assert.equal((await plan({...env,GITHUB_EVENT_NAME:'workflow_dispatch'})).run,true);
});
