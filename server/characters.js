import {readFile,writeFile,rename,chmod} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {World} from './world.js';
import {visibleEquipment,levelForXP} from '../shared/content.js';
import {normalizeIdentity,validRaceClass} from '../shared/adventurers.js';
import {characterLook,normalizeAppearance} from '../shared/character.js';

export const CHARACTER_LIMIT=12;
const token=()=>randomBytes(32).toString('hex');
const validToken=t=>typeof t==='string'&&/^[a-f0-9]{64}$/.test(t);
export class RosterError extends Error{constructor(status,message){super(message);this.status=status;}}
const fail=(status,message)=>{throw new RosterError(status,message);};
export class CharacterStore{
  constructor(file,data){this.file=file;this.data=data;this.queue=Promise.resolve();}
  static async open(file){
    let data;try{data=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw Error(`Cannot load characters: ${e.message}. Restore a valid characters.json before starting.`);}
    if(!data)data={version:2,profiles:{},accounts:{}};
    else if(data.version!==2)data={version:2,profiles:data,accounts:{}};
    if(!data.profiles||!data.accounts||typeof data.profiles!=='object'||typeof data.accounts!=='object'||Array.isArray(data.profiles)||Array.isArray(data.accounts))throw Error('Invalid character store.');
    for(const [key,p]of Object.entries(data.profiles))if(!validToken(key)||!p||typeof p.id!=='string'||typeof p.name!=='string')throw Error('Invalid saved character.');
    for(const [key,a]of Object.entries(data.accounts))if(!validToken(key)||!Array.isArray(a.characters)||!Number.isSafeInteger(a.revision)||a.characters.some(id=>!Object.hasOwn(data.profiles,id)))throw Error('Invalid saved roster.');
    return new CharacterStore(file,data);
  }
  exclusive(fn){const result=this.queue.catch(()=>{}).then(fn);this.queue=result.catch(()=>{});return result;}
  transaction(change,committed){return this.exclusive(async()=>{
    const next=structuredClone(this.data),result=change(next);
    await writeFile(`${this.file}.tmp`,JSON.stringify(next,null,2),{mode:0o600});await chmod(`${this.file}.tmp`,0o600);await rename(`${this.file}.tmp`,this.file);
    this.data=next;committed?.();return result;
  });}
  profile(key){return validToken(key)?structuredClone(this.data.profiles[key]):undefined;}
  account(data,key){if(!validToken(key)||!Object.hasOwn(data.accounts,key))fail(401,'Your browser identity was not found.');return data.accounts[key];}
  roster(key,isOnline=()=>false){
    const a=this.account(this.data,key);
    return {revision:a.revision,limit:CHARACTER_LIMIT,characters:a.characters.map(key=>{const p=this.data.profiles[key];return {id:p.id,name:p.name,...normalizeIdentity(p),level:levelForXP(p.xp),look:characterLook(p.look),appearance:normalizeAppearance(p.appearance,p.look),equipment:visibleEquipment(p.equipment),x:p.x,z:p.z,online:isOnline(p.id)};})};
  }
  async session(key,legacyToken){
    if(key){this.account(this.data,key);return key;}
    if(validToken(legacyToken)&&this.profile(legacyToken)){
      const owned=Object.entries(this.data.accounts).find(([,a])=>a.characters.includes(legacyToken));if(owned)return owned[0];
    }
    return this.transaction(data=>{const owned=Object.entries(data.accounts).find(([,a])=>a.characters.includes(legacyToken));if(owned)return owned[0];const key=token();data.accounts[key]={revision:0,characters:this.profile(legacyToken)?[legacyToken]:[]};return key;});
  }
  async create(key,name,look,revision,appearance,identity=normalizeIdentity(),{gameMaster=false}={}){
    if(!validRaceClass(identity.raceId,identity.classId))fail(400,'That race does not offer this class in the current expedition.');
    if(typeof name!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9 '-]{1,17}$/.test(name.trim()))fail(400,'Choose a name with 2–18 letters, numbers, spaces, apostrophes or hyphens.');
    name=name.trim();
    return this.transaction(data=>{
      const a=this.account(data,key);this.checkRevision(a,revision);
      if(a.characters.length>=CHARACTER_LIMIT)fail(409,`You can keep up to ${CHARACTER_LIMIT} characters.`);
      if(Object.values(data.profiles).some(p=>p.name.toLowerCase()===name.toLowerCase()))fail(409,'That character name is already taken.');
      const world=new World(),p=world.addPlayer(name,identity);if(gameMaster===true){p.gameMaster=true;world.travel.initialize(p,{...world.save(p),gameMaster:true});}p.look=characterLook(look);p.appearance=normalizeAppearance(appearance,p.look);const id=token();data.profiles[id]=world.save(p);a.characters.push(id);a.revision++;return p.id;
    });
  }
  customize(key,id,look,appearance,revision,isOnline){return this.transaction(data=>{
    const a=this.account(data,key);this.checkRevision(a,revision);const k=a.characters.find(k=>data.profiles[k].id===id),p=data.profiles[k];
    if(!p)fail(404,'That character is not in your roster.');if(isOnline(id))fail(409,'Log this character out before changing appearance.');
    p.look=characterLook(look);p.appearance=normalizeAppearance(appearance,p.look);a.revision++;
  });}
  checkRevision(a,revision){if(revision!==a.revision)fail(409,'Your character list changed in another tab. Review it and try again.');}
  reorder(key,ids,revision){return this.transaction(data=>{
    const a=this.account(data,key);this.checkRevision(a,revision);
    const byId=new Map(a.characters.map(k=>[data.profiles[k].id,k]));
    if(!Array.isArray(ids)||ids.length!==a.characters.length||new Set(ids).size!==ids.length||ids.some(id=>!byId.has(id)))fail(400,'Choose an order containing each of your characters once.');
    a.characters=ids.map(id=>byId.get(id));a.revision++;
  });}
  delete(key,id,confirmName,revision,isOnline){return this.transaction(data=>{
    const a=this.account(data,key);this.checkRevision(a,revision);const profileKey=a.characters.find(k=>data.profiles[k].id===id),p=data.profiles[profileKey];
    if(!p)fail(404,'That character is not in your roster.');if(confirmName!==p.name)fail(400,'Confirm the character name before deleting.');
    if(isOnline(p.id))fail(409,'Log this character out before deleting it.');
    a.characters=a.characters.filter(k=>k!==profileKey);delete data.profiles[profileKey];delete data.correspondence?.[id];for(const r of Object.values(data.correspondence||{}))r.friends=r.friends.filter(v=>v!==id);a.revision++;
  });}
  // Entry and deletion share the queue, so a deleted or newly-online character
  // cannot slip through between the ownership/online check and disk commit.
  enter(key,id,fn){return this.exclusive(()=>{const a=this.account(this.data,key),k=a.characters.find(k=>this.data.profiles[k].id===id);if(!k)fail(404,'That character is no longer in your roster.');return fn(k,structuredClone(this.data.profiles[k]));});}
  putProfile(key,profile){const captured=structuredClone(profile);return this.transaction(data=>{data.profiles[key]=captured;});}
  saveProfiles(updates){const snapshot=typeof updates==='function'?null:structuredClone(updates),captured=typeof updates==='function'?updates:()=>snapshot;return this.transaction(data=>{for(const [key,profile]of captured())if(Object.hasOwn(data.profiles,key))data.profiles[key]=profile;});}
}

export async function characterApi(req,res,url,store,isOnline,{developerCreate=false}={}){
  const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  let key;
  try{
    if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)fail(403,'Use the same server address as the game.');
    key=req.headers.authorization?.replace(/^Bearer /,'');
    let body={};if(['POST','PATCH','DELETE'].includes(req.method)){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8192)fail(413,'Request too large.');}try{body=JSON.parse(raw||'{}');}catch{fail(400,'Invalid request.');}if(!body||Array.isArray(body)||typeof body!=='object')fail(400,'Invalid request.');}
    if(url==='/api/session'&&req.method==='POST'){key=await store.session(body.token,body.legacyToken);reply(200,{token:key,...store.roster(key,isOnline)});return;}
    store.account(store.data,key);
    if(url==='/api/characters'&&req.method==='GET')reply(200,store.roster(key,isOnline));
    else if(url==='/api/characters'&&req.method==='POST'){const defaults=normalizeIdentity();const id=await store.create(key,body.name,body.look,body.revision,body.appearance,{raceId:body.raceId??defaults.raceId,classId:body.classId??defaults.classId},{gameMaster:developerCreate});reply(201,{createdId:id,...store.roster(key,isOnline)});}
    else if(/^\/api\/characters\/[^/]+\/appearance$/.test(url)&&req.method==='PATCH'){await store.customize(key,url.split('/')[3],body.look,body.appearance,body.revision,isOnline);reply(200,store.roster(key,isOnline));}
    else if(url==='/api/characters/order'&&req.method==='PATCH'){await store.reorder(key,body.ids,body.revision);reply(200,store.roster(key,isOnline));}
    else if(/^\/api\/characters\/[^/]+$/.test(url)&&req.method==='DELETE'){await store.delete(key,url.split('/').at(-1),body.confirmName,body.revision,isOnline);reply(200,store.roster(key,isOnline));}
    else reply(404,{error:'Not found.'});
  }catch(e){
    if(!e.status)console.error('Character roster save failed:',e.message);
    let roster={};if(e.status===409&&key)try{roster=store.roster(key,isOnline);}catch{}
    reply(e.status||503,{error:e.status?e.message:'Could not save your characters. Please try again.',...roster});
  }
}
