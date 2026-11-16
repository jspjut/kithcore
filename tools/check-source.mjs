#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import {readFileSync,statSync,lstatSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const binary=/\.(?:glb|png|jpe?g|gif|webp|avif|ico|mp4|webm|mov|mp3|wav|ogg|zip|gz|tar|pdf|woff2?|ttf|otf|exe|dll|so|wasm|bin)$/i;
const generated=/(^|\/)(?:node_modules|\.tools|\.runtime|dist|\.site|test-results|data|backups)(\/|$)|(^|\/)client\/assets\/(?:models\/|previews\/|icons\/|[^/]+\.(?:zip|tar\.gz)$|library-manifest\.json$|catalog\.html$|ITEMIZATION_AND_LEVELING\.md$)/;
export function sourceProblem(file,bytes){
 if(path.basename(file).startsWith('.env')&&path.basename(file)!=='.env.example')return 'operator environment files are private';
 if(generated.test(file))return 'generated/private output belongs outside Git';
 if(/\.(log|pid|tmp)$/.test(file))return 'operator/build output belongs outside Git';
 if(binary.test(file))return 'binary/generated asset belongs in build artifacts';
 if(bytes.length>1024*1024)return 'source file exceeds the 1 MiB review limit';
 if(bytes.toString('utf8').startsWith('version https://git-lfs.github.com/spec/')||file.endsWith('.gitattributes')&&/filter=lfs/.test(bytes.toString('utf8')))return 'Git LFS is not part of the source-only workflow';
 if(bytes.includes(0))return 'NUL bytes indicate binary content';
 try{new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return 'source must be UTF-8 text';}
 return null;
}
export function checkRepository(directory=process.cwd()){
 const root=execFileSync('git',['rev-parse','--show-toplevel'],{cwd:directory,encoding:'utf8'}).trim();
 const records=execFileSync('git',['ls-files','--stage','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean),problems=[];
 for(const entry of records){const match=entry.match(/^(\d+) ([a-f0-9]+) \d\t([\s\S]+)$/);if(!match){problems.push('Unrecognized Git index entry');continue;}const [,mode,sha,file]=match;
  if(!['100644','100755'].includes(mode)){problems.push(`${file}: links/submodules are not source files`);continue;}
  const indexed=execFileSync('git',['cat-file','blob',sha],{cwd:root,maxBuffer:8*1024*1024});const staged=sourceProblem(file,indexed);if(staged)problems.push(`${file}: ${staged}`);
  // Also cover intent-to-add and pending work before the initial commit.
  const absolute=path.join(root,file);try{if(lstatSync(absolute).isSymbolicLink())problems.push(`${file}: symbolic link`);else if(statSync(absolute).isFile()){const issue=sourceProblem(file,readFileSync(absolute));if(issue&&!staged)problems.push(`${file}: ${issue}`);}}catch(error){if(error.code!=='ENOENT')throw error;}
 }
 return {root,files:records.length,problems};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{
 const result=checkRepository();if(process.argv.includes('--install-hook')){execFileSync('git',['config','--local','core.hooksPath','.githooks'],{cwd:result.root});console.log('Installed this repository’s source-only pre-commit hook.');}
 if(result.problems.length)throw Error(result.problems.join('\n'));console.log(`Source-only check passed: ${result.files} indexed text files.`);
}catch(error){console.error(error.message);process.exitCode=1;}}
