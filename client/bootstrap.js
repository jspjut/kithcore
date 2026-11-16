import {WORLD_INFO} from '../shared/world-info.js';
import {applyLiveSnapshot} from '../shared/live-content.js';

try {
  const live=await fetch('/live-content.json',{cache:'no-store'});if(!live.ok)throw Error('Could not load live world content.');applyLiveSnapshot(await live.json());
  if(WORLD_INFO.client?.stylesheet){
    const link=document.createElement('link');link.rel='stylesheet';link.href=WORLD_INFO.client.stylesheet;
    const loaded=new Promise((resolve,reject)=>{link.onload=resolve;link.onerror=()=>reject(Error('Could not load the game stylesheet.'));});
    document.head.append(link);await loaded;
  }
  const context=await import(WORLD_INFO.client?.entry||'/main.js');
  if(WORLD_INFO.client?.extension){
    const extension=await import(WORLD_INFO.client.extension);
    if(typeof extension.setup!=='function')throw Error('A client extension must export setup(context).');
    await extension.setup(context);
  }
}catch(error){
  const message=document.querySelector('#login-error');if(message)message.textContent=error.message;
  console.error(error);throw error;
}
