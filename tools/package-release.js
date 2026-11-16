import {mkdtemp,mkdir,readFile,writeFile,cp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {ROOT,RUNTIME_API,loadWorld,listFiles} from './worlds.js';

const engineInputs=['server','shared','client','tools','tests','docs','worlds/minimal','.github','.githooks','site','README.md','RELEASE_NOTES.md','CONTRIBUTING.md','SECURITY.md','PROVENANCE.md','LICENSE','THIRD_PARTY.md','package.json','package-lock.json','start.sh','Dockerfile','compose.yaml','.dockerignore','.gitignore','.gitattributes','.env.example','default-world.json'];
const worldInputs=['.github','.githooks','site','client','shared','server','tests','tools','docs','game-data','examples','world.json','README.md','RELEASE_NOTES.md','CONTRIBUTING.md','SECURITY.md','PROVENANCE.md','LICENSE','THIRD_PARTY.md','.gitignore','.gitattributes','compose.override.yaml'];
const forbidden=file=>file.split('/').some(part=>['.git','node_modules','.tools','.runtime','.site','dist','data','test-results','backups'].includes(part)||part.startsWith('.env')&&part!=='.env.example'||part.endsWith('.log'));

async function copyInputs(source,target,inputs){
  for(const name of inputs){
    const filename=path.join(source,name);
    try {
      const {lstat}=await import('node:fs/promises'),info=await lstat(filename);
      if(info.isSymbolicLink())throw Error(`Release input cannot be a link: ${name}`);
      const files=info.isDirectory()?(await listFiles(filename)).map(file=>`${name}/${file}`):[name];
      for(const file of files){
        if(forbidden(file))throw Error(`Private/generated file in release inputs: ${file}`);
        // A separately downloadable art archive must not be nested in game downloads.
        if(file.startsWith('client/assets/')&&/\.(zip|tar\.gz)$/.test(file))continue;
        await mkdir(path.dirname(path.join(target,file)),{recursive:true});await cp(path.join(source,file),path.join(target,file));
      }
    }catch(error){if(error.code!=='ENOENT')throw error;}
  }
}

async function inventory(directory){
  const files=[];
  for(const file of await listFiles(directory)){
    if(forbidden(file))throw Error(`Refusing to publish ${file}`);
    const bytes=await readFile(path.join(directory,file));files.push({path:file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
  return files;
}

async function tar(directory,archive){
  await new Promise((resolve,reject)=>{
    const child=spawn('tar',['-czf',archive,'-C',path.dirname(directory),path.basename(directory)],{stdio:['ignore','ignore','pipe']});let error='';
    child.stderr.on('data',chunk=>error+=chunk);child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error(`tar failed: ${error}`)));
  });
}

export async function packageRelease({output=path.join(ROOT,'dist'),world:selection,includeAssets=false}={}){
  const metadata=JSON.parse(await readFile(path.join(ROOT,'package.json'),'utf8'));
  const world=selection?await loadWorld(selection):null;
  if(includeAssets&&!world)throw Error('--assets requires --world');
  const temporary=await mkdtemp(path.join(tmpdir(),'kithcore-release-'));
  await mkdir(output,{recursive:true});
  const artifacts=[];
  async function archive(kind,directory,filename){
    await readFile(path.join(directory,'LICENSE'));
    const files=await inventory(directory),target=path.join(output,filename);
    await writeFile(path.join(directory,'RELEASE-MANIFEST.json'),JSON.stringify({kind,engineName:metadata.name,runtimeApi:RUNTIME_API,engineVersion:metadata.version,...(world&&kind!=='engine'?{worldId:world.manifest.id,worldVersion:world.manifest.version}:{}),files},null,2)+'\n');
    await tar(directory,target);const bytes=await readFile(target);artifacts.push({kind,file:filename,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
  try {
    const engine=path.join(temporary,'kithcore');await mkdir(engine);await copyInputs(ROOT,engine,engineInputs);
    await archive('engine',engine,`kithcore-engine-${metadata.version}.tar.gz`);
    if(world){
      const worldDirectory=path.join(temporary,world.manifest.id);await mkdir(worldDirectory);await copyInputs(world.directory,worldDirectory,worldInputs);
      await archive('world',worldDirectory,`${world.manifest.id}-world-${world.manifest.version}.tar.gz`);
      if(includeAssets){
        const art=path.join(temporary,`${world.manifest.id}-assets`);
        await readFile(path.join(worldDirectory,'client/assets/library-manifest.json'));
        await cp(path.join(worldDirectory,'client/assets'),art,{recursive:true});
        for(const name of ['LICENSE','THIRD_PARTY.md','PROVENANCE.md']){try{await cp(path.join(world.directory,name),path.join(art,name));}catch(error){if(error.code!=='ENOENT'||name==='LICENSE')throw error;}}
        await archive('assets',art,`${world.manifest.id}-assets-${world.manifest.version}.tar.gz`);
      }
      const starter=path.join(temporary,`${world.manifest.id}-starter`);await cp(engine,starter,{recursive:true});await rm(path.join(starter,'RELEASE-MANIFEST.json'));
      await mkdir(path.join(starter,'worlds',world.manifest.id),{recursive:true});await copyInputs(world.directory,path.join(starter,'worlds',world.manifest.id),worldInputs);
      await writeFile(path.join(starter,'default-world.json'),JSON.stringify({world:world.manifest.id},null,2)+'\n');
      await writeFile(path.join(starter,'compose.override.yaml'),`# Generated starter selection; world content remains outside the image.\nservices:\n  game:\n    environment:\n      WORLD: /world\n    volumes:\n      - ./worlds/${world.manifest.id}:/world:ro\n`);
      await archive('starter',starter,`${world.manifest.id}-starter-${world.manifest.version}-kithcore-${metadata.version}.tar.gz`);
    }
    try{await cp(path.join(world?world.directory:ROOT,'RELEASE_NOTES.md'),path.join(output,'RELEASE_NOTES.md'));}catch(error){if(error.code!=='ENOENT')throw error;}
    await writeFile(path.join(output,'SHA256SUMS'),artifacts.map(a=>`${a.sha256}  ${a.file}`).join('\n')+'\n');
    await writeFile(path.join(output,'release-index.json'),JSON.stringify({engineName:metadata.name,engineVersion:metadata.version,artifacts},null,2)+'\n');
    return artifacts;
  }finally{await rm(temporary,{recursive:true,force:true});}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const args=process.argv.slice(2),worldIndex=args.indexOf('--world'),outputIndex=args.indexOf('--output');
  try{
    if(worldIndex>=0&&!args[worldIndex+1]||outputIndex>=0&&!args[outputIndex+1])throw Error('--world and --output require values.');
    const artifacts=await packageRelease({includeAssets:args.includes('--assets'),world:worldIndex>=0?args[worldIndex+1]:undefined,output:outputIndex>=0?path.resolve(args[outputIndex+1]):undefined});
    console.log(JSON.stringify(artifacts,null,2));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
