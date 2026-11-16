import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {ROOT} from '../tools/worlds.js';
const exec=promisify(execFile);
const cliEnv={...process.env};delete cliEnv.NODE_TEST_CONTEXT;
async function fixture(t){const parent=await mkdtemp(path.join(tmpdir(),'kithcore-suite-')),world=path.join(parent,'world');t.after(()=>rm(parent,{recursive:true,force:true}));await cp(path.join(ROOT,'worlds/minimal'),world,{recursive:true});return {parent,world};}
test('fast profiles omit named slow tests literally and do not need generated art exports',async t=>{
 const {parent,world}=await fixture(t),marker=path.join(parent,'ran');
 await writeFile(path.join(world,'tests/suites.json'),JSON.stringify({fast:{excludeFiles:['campaign.test.js'],excludeNames:['slow.test']}}));
 await writeFile(path.join(world,'tests/selection.test.js'),`import test from 'node:test';import {writeFileSync} from 'node:fs';test('slow.test',()=>{throw Error('Slow test must be excluded')});test('slowXtest',()=>writeFileSync(${JSON.stringify(marker)},'passed'));`);
 const {stdout}=await exec(process.execPath,['tools/test-world.js','--world',world,'--suite','fast'],{cwd:ROOT,timeout:10000,env:cliEnv});
 assert.match(stdout,/Running fast suite/);assert.equal(await readFile(marker,'utf8').catch(()=>stdout),'passed');
});
test('runner terminates a hung script within the explicit deadline and returns timeout status',async t=>{
 const {world}=await fixture(t);await writeFile(path.join(world,'tests/hang.js'),'setInterval(()=>{},1000);\n');
 await assert.rejects(exec(process.execPath,['tools/test-world.js','--world',world,'--script','tests/hang.js','--timeout','1'],{cwd:ROOT,timeout:10000,env:cliEnv}),error=>error.code===124&&error.stderr.includes('terminating the test process group'));
});
