import {mkdir,readFile,rename,readdir,rm,open} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {WORLD_INFO} from '../shared/world-info.js';
import {LIVE_CONTENT,prepareLivePatch,commitLivePatch} from '../shared/live-content.js';

async function atomic(filename,value){
 const temporary=`${filename}.${randomUUID()}.tmp`;let handle;
 try{handle=await open(temporary,'wx',0o600);await handle.writeFile(JSON.stringify(value,null,2)+'\n');await handle.sync();await handle.close();handle=null;await rename(temporary,filename);}
 finally{await handle?.close();await rm(temporary,{force:true});}
}
export async function openLiveUpdates(data){
 const filename=path.join(data,'live-content.json'),inbox=path.join(data,'live-inbox'),receipts=path.join(data,'live-receipts');
 await mkdir(inbox,{recursive:true,mode:0o700});await mkdir(receipts,{recursive:true,mode:0o700});
 let journal={format:1,worldId:WORLD_INFO.id,baseContentHash:WORLD_INFO.contentHash,revision:0,patches:[]};
 try{
  const stored=JSON.parse(await readFile(filename,'utf8'));
  if(stored.format!==1||stored.worldId!==WORLD_INFO.id)throw Error('Invalid live content world/format');
  if(stored.revision!==stored.patches?.length)throw Error('Invalid live content journal');
  if(stored.baseContentHash!==WORLD_INFO.contentHash){
    if(stored.revision!==0)throw Error('Live content baseline changed. Follow docs/LIVE_UPDATES.md before installing a different world build.');
    await atomic(filename,journal);
  }else{for(const patch of stored.patches)commitLivePatch(prepareLivePatch(patch));journal=stored;}
 }catch(error){if(error.code!=='ENOENT')throw error;await atomic(filename,journal);}
 let busy=false;
 return {
  snapshot:()=>({revision:LIVE_CONTENT.revision,patches:LIVE_CONTENT.patches}),
  async poll(applyActors,broadcast){
   if(busy)return;busy=true;
   try{
    for(const file of (await readdir(inbox)).filter(n=>/^[a-f0-9-]{36}\.json$/.test(n)).sort()){
     const requestPath=path.join(inbox,file),receiptPath=path.join(receipts,file);let result,durable=false;
     // A receipt makes replay after a crash idempotent, including dry runs.
     try{await readFile(receiptPath);await rm(requestPath,{force:true});continue;}catch(error){if(error.code!=='ENOENT')throw error;}
     try{
      const bytes=await readFile(requestPath);if(bytes.length>132*1024)throw Error('Update request is too large');const request=JSON.parse(bytes);
      const prior=journal.patches.find(p=>p.id===request.patch?.id);
      if(prior){if(JSON.stringify(prior)!==JSON.stringify(request.patch))throw Error('Update id was already used for different content');result={ok:true,status:'already-applied',revision:journal.revision};}
      else{
       if(request.baseContentHash!==journal.baseContentHash)throw Error('Update targets a different baseline');
       if(request.expectedRevision!==journal.revision)throw Error('Stale update: inspect current revision and resubmit');
       const plan=prepareLivePatch(request.patch);
       if(request.check===true)result={ok:true,status:'validated',revision:journal.revision};
       else{
        const next={...journal,revision:journal.revision+1,patches:[...journal.patches,plan.patch]};if(JSON.stringify(next).length>4*1024*1024)throw Error('Live journal exceeds 4 MiB; consolidate it during maintenance');
        // Persist first. A crash after this point replays the accepted update.
        await atomic(filename,next);journal=next;durable=true;
        const additions=commitLivePatch(plan);applyActors(additions);broadcast({type:'contentUpdate',revision:journal.revision,patch:plan.patch});
        result={ok:true,status:'applied',revision:journal.revision};console.log(`Live content ${plan.patch.id} applied at revision ${journal.revision}`);
       }
      }
     }catch(error){if(durable){error.fatal=true;throw error;}result={ok:false,status:'rejected',revision:journal.revision,error:error.message};console.warn('Live update rejected:',error.message);}
     await atomic(receiptPath,result);await rm(requestPath,{force:true});
    }
   }finally{busy=false;}
  }
 };
}
