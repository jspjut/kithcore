import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';

// A save directory belongs to one world. Sharing it between different packs is
// refused before CharacterStore can migrate or write any character data.
export async function bindWorldState(directory, world, {allowLegacy=false}={}) {
  await mkdir(directory,{recursive:true,mode:0o700});
  const marker=path.join(directory,'world-state.json');
  const expected={worldId:world.id,runtimeApi:world.runtimeApi};
  try {
    const current=JSON.parse(await readFile(marker,'utf8'));
    if(current.worldId!==expected.worldId||current.runtimeApi!==expected.runtimeApi)throw Error(`Save directory belongs to world ${current.worldId} (API ${current.runtimeApi}); selected ${world.id} (API ${world.runtimeApi}). Choose a separate DATA_DIR.`);
    return;
  }catch(error){if(error.code!=='ENOENT')throw error;}
  try {
    await readFile(path.join(directory,'characters.json'));
    if(!allowLegacy)throw Error('Existing characters have no world marker. Back them up, then explicitly set ALLOW_LEGACY_SAVES=1 with the correct world and DATA_DIR.');
  }catch(error){if(error.code!=='ENOENT')throw error;}
  try {await writeFile(marker,JSON.stringify(expected,null,2)+'\n',{flag:'wx',mode:0o600});}
  catch(error){if(error.code!=='EEXIST')throw error;await bindWorldState(directory,world,{allowLegacy});}
}
