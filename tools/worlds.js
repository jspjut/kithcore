import {cp, mkdir, mkdtemp, readFile, readdir, realpath, lstat, symlink, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const RUNTIME_API = 1;
const coreDirectories = ['server', 'shared', 'client'];
const requiredModules = [
  'client/world-presentation.js', 'client/world-ui.js', 'client/race-appearance.js',
  'shared/atlas.js', 'shared/buildings.js', 'shared/progression.js', 'shared/roadsigns.js', 'shared/story-content.js',
  'shared/content.js', 'shared/adventurers.js',
  'shared/terrain.js', 'shared/props.js', 'shared/zone-layout.js',
  'shared/zone-regions.js', 'shared/social.js', 'shared/travel.js',
  'shared/mail.js', 'shared/readables.js', 'shared/city-routines.js',
  'shared/capital-story.js', 'server/npc-dialogue.js'
];

export function validateManifest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('world.json must contain an object.');
  if (typeof value.id!=='string'||!/^[a-z][a-z0-9-]{0,63}$/.test(value.id)) throw Error('World id must use lowercase letters, digits and hyphens.');
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 100) throw Error('World name is required (maximum 100 characters).');
  if (typeof value.version !== 'string' || !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(value.version)) throw Error('World version must be a semantic version.');
  if (value.runtimeApi !== RUNTIME_API) throw Error(`Unsupported world runtime API ${value.runtimeApi}; this engine supports ${RUNTIME_API}.`);
  if (typeof value.license !== 'string' || !value.license.trim() || value.license.length>100) throw Error('World license is required.');
  if (!Number.isInteger(value.levelCap) || value.levelCap < 1 || value.levelCap > 100) throw Error('World levelCap must be an integer from 1 to 100.');
  if (value.storagePrefix !== undefined && (typeof value.storagePrefix!=='string'||!/^[a-z][a-z0-9-]{0,63}$/.test(value.storagePrefix))) throw Error('Invalid browser storage prefix.');
  if (value.zoneNames !== undefined && (!value.zoneNames || typeof value.zoneNames !== 'object' || Array.isArray(value.zoneNames) || Object.values(value.zoneNames).some(n => typeof n !== 'string' || n.length > 100))) throw Error('zoneNames must map zone ids to names.');
  if(value.client!==undefined){
    if(!value.client||typeof value.client!=='object'||Array.isArray(value.client))throw Error('client must be an object.');
    for(const [key,file]of Object.entries(value.client)){
      if(!['entry','stylesheet','extension'].includes(key))throw Error(`Unknown client customization ${key}.`);
      if(typeof file!=='string'||!/^\/[a-zA-Z0-9/_-]+\.(js|css)$/.test(file)||file.includes('//'))throw Error(`client.${key} must be a local client file path.`);
      if(!file.endsWith(key==='stylesheet'?'.css':'.js'))throw Error(`Invalid file type for client.${key}.`);
    }
  }
  return structuredClone(value);
}

// Packs contain trusted source modules. Reject links and special files rather
// than accidentally packaging an author's credentials or files outside a pack.
export async function listFiles(directory, prefix = '') {
  const result = [];
  for (const entry of (await readdir(directory, {withFileTypes: true})).sort((a,b) => a.name.localeCompare(b.name))) {
    if (entry.name === '.git') continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const filename = path.join(directory, entry.name);
    const info = await lstat(filename);
    if (info.isSymbolicLink()) throw Error(`Symbolic links are not allowed in release inputs: ${relative}`);
    if (info.isDirectory()) result.push(...await listFiles(filename, relative));
    else if (info.isFile()) result.push(relative);
    else throw Error(`Special files are not allowed in release inputs: ${relative}`);
  }
  return result;
}

export async function loadWorld(selection = 'minimal', engineRoot = ROOT) {
  const candidate = selection.includes('/') || selection.includes('\\') || path.isAbsolute(selection)
    ? path.resolve(selection) : path.join(engineRoot, 'worlds', selection);
  let directory, manifest;
  try {
    directory = await realpath(candidate);
    if ((await lstat(path.join(directory, 'world.json'))).isSymbolicLink()) throw Error('world.json cannot be a symbolic link.');
    manifest = validateManifest(JSON.parse(await readFile(path.join(directory, 'world.json'), 'utf8')));
  } catch (error) {
    throw Error(`Cannot load world at ${candidate}: ${error.message}. See docs/WORLDS.md.`);
  }
  const files = [];
  for (const section of coreDirectories) {
    const folder = path.join(directory, section);
    try {
      if ((await lstat(folder)).isSymbolicLink()) throw Error(`Pack directory cannot be a link: ${section}`);
      for (const file of await listFiles(folder)) files.push(`${section}/${file}`);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  for (const file of requiredModules) if (!files.includes(file)) throw Error(`World ${manifest.id} is missing required module ${file}.`);
  if (files.includes('shared/world-info.js')) throw Error('shared/world-info.js is reserved for the engine.');
  for (const file of files) {
    try { await lstat(path.join(engineRoot, file)); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    throw Error(`World ${manifest.id} attempts to replace engine file ${file}. Use a world module instead.`);
  }
  for(const file of Object.values(manifest.client||{})){
    if(files.includes(`client${file}`))continue;
    try{await lstat(path.join(engineRoot,'client',file.slice(1)));}catch{throw Error(`Missing client customization file ${file}.`);}
  }
  const hash = createHash('sha256').update(JSON.stringify(manifest));
  // Optional art exports are rebuildable views of source, not a new world
  // baseline. Their absence or renderer-specific PNG bytes must not invalidate
  // a persisted live-content journal. Physics recipes remain hashed source.
  const generatedArt=/^client\/assets\/(?:models\/|previews\/|icons\/|library-manifest\.json$|catalog\.html$|ITEMIZATION_AND_LEVELING\.md$|[^/]+\.(?:zip|tar\.gz)$)/;
  for (const file of files) if(!generatedArt.test(file))hash.update(file).update('\0').update(await readFile(path.join(directory, file)));
  return {directory, manifest, files, contentHash: hash.digest('hex')};
}

export async function prepareRuntime(selection = 'minimal', {engineRoot = ROOT, includeDevelopment = false, parent} = {}) {
  const world = await loadWorld(selection, engineRoot);
  const runtimeParent = parent || path.join(engineRoot, '.runtime');
  await mkdir(runtimeParent, {recursive: true});
  const directory = await mkdtemp(path.join(runtimeParent, `${world.manifest.id}-`));
  for (const section of coreDirectories) {
    await cp(path.join(engineRoot, section), path.join(directory, section), {recursive: true});
  }
  for (const file of world.files) {
    const target = path.join(directory, file);
    await mkdir(path.dirname(target), {recursive: true});
    await cp(path.join(world.directory, file), target);
  }
  const publicInfo = {
    id: world.manifest.id, name: world.manifest.name, version: world.manifest.version,
    runtimeApi: RUNTIME_API, levelCap: world.manifest.levelCap,
    storagePrefix: world.manifest.storagePrefix || world.manifest.id,
    zoneNames: world.manifest.zoneNames || {}, client:world.manifest.client||{}, contentHash: world.contentHash
  };
  if(world.files.includes('client/world-icons.svg')){
    const icons=await readFile(path.join(directory,'client/icons.svg'),'utf8');
    const extra=await readFile(path.join(directory,'client/world-icons.svg'),'utf8');
    const body=extra.match(/<svg\b[^>]*>([\s\S]*)<\/svg>/)?.[1];
    if(!body)throw Error('world-icons.svg must contain an SVG root.');
    await writeFile(path.join(directory,'client/icons.svg'),icons.replace('</svg>',`${body}\n</svg>`));
  }
  await writeFile(path.join(directory, 'shared/world-info.js'), `// Generated by the engine. Contains no operator configuration or credentials.\nexport const WORLD_INFO=Object.freeze(${JSON.stringify(publicInfo)});\n`);
  await writeFile(path.join(directory, 'package.json'), JSON.stringify({private:true,type:'module'}));
  await writeFile(path.join(directory, 'world.json'), JSON.stringify(publicInfo, null, 2) + '\n');
  await symlink(path.join(engineRoot, 'node_modules'), path.join(directory, 'node_modules'), 'dir');
  if (includeDevelopment) {
    for(const file of ['LICENSE','THIRD_PARTY.md','README.md']){
      try{await cp(path.join(world.directory,file),path.join(directory,file));}
      catch(error){if(error.code!=='ENOENT')throw error;}
    }
    for (const section of ['tests','tools','docs','game-data']) {
      const source = path.join(world.directory, section);
      try { await lstat(source); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
      await listFiles(source);
      await cp(source, path.join(directory, section), {recursive: true});
    }
  }
  return {...world, worldDirectory:world.directory, directory};
}

export function selectedWorld(args = process.argv.slice(2)) {
  const index = args.indexOf('--world');
  if (index >= 0) {
    if (!args[index+1] || args[index+1].startsWith('--')) throw Error('--world requires a world name or directory.');
    return args[index+1];
  }
  if(process.env.WORLD)return process.env.WORLD;
  try {
    const value=JSON.parse(readFileSync(path.join(ROOT,'default-world.json'),'utf8'));
    if(typeof value.world!=='string'||!value.world)throw Error('default-world.json requires a world name or directory.');
    return value.world;
  }catch(error){if(error.code==='ENOENT')return 'minimal';throw error;}
}
