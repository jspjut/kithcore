#!/usr/bin/env node
// Local filesystem control plane: never exposes an HTTP admin credential.
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
const args=process.argv.slice(2);
const option=name=>{const i=args.indexOf(name);if(i<0)return;const value=args[i+1];if(!value||value.startsWith('--'))throw Error(`${name} requires a value`);return value;};
try{
 for(let i=0;i<args.length;i++){if(['--data-dir','--file'].includes(args[i])){i++;continue;}if(!['--check','--status','--help'].includes(args[i]))throw Error(`Unknown option ${args[i]}`);}
 if(args.includes('--help')){console.log('node tools/live-update.js --data-dir data/<world> [--file update.json] [--check | --status]\nWithout --file, reads the update JSON from stdin. The server must be running.');process.exit(0);}
 const directory=path.resolve(option('--data-dir')||(()=>{throw Error('--data-dir is required');})());
 const state=JSON.parse(await readFile(path.join(directory,'live-content.json'),'utf8'));
 if(args.includes('--status')){console.log(JSON.stringify({worldId:state.worldId,baseContentHash:state.baseContentHash,revision:state.revision,updates:state.patches.map(p=>p.id)},null,2));process.exit(0);}
 const source=option('--file');let bytes='';if(source)bytes=await readFile(source,'utf8');else for await(const chunk of process.stdin){bytes+=chunk;if(bytes.length>128*1024)throw Error('Update exceeds 128 KiB');}
 if(Buffer.byteLength(bytes)>128*1024)throw Error('Update exceeds 128 KiB');const patch=JSON.parse(bytes);
 const key=randomUUID(),inbox=path.join(directory,'live-inbox');await mkdir(inbox,{recursive:true,mode:0o700});
 const temporary=path.join(inbox,`${key}.tmp`),target=path.join(inbox,`${key}.json`);
 await writeFile(temporary,JSON.stringify({baseContentHash:state.baseContentHash,expectedRevision:state.revision,check:args.includes('--check'),patch}),{mode:0o600,flag:'wx'});await rename(temporary,target);
 const receipt=path.join(directory,'live-receipts',`${key}.json`),deadline=Date.now()+15000;
 while(Date.now()<deadline){try{const result=JSON.parse(await readFile(receipt,'utf8'));console.log(JSON.stringify(result,null,2));process.exitCode=result.ok?0:1;break;}catch(error){if(error.code!=='ENOENT')throw error;}await new Promise(resolve=>setTimeout(resolve,100));}
 if(process.exitCode===undefined){process.exitCode=2;console.error(`No receipt yet. Request ${key} remains queued; inspect ${receipt} before retrying. It may apply when the server resumes.`);}
}catch(error){console.error(error.message);process.exitCode=1;}
