export function createQuestRules({QUESTS,NPCS,questForPlayer,defaultClassId}) {
const questRecord=(p,q)=>p.quests?.[typeof q==='string'?q:q.id];
const questDone=(p,q)=>questRecord(p,q)?.status==='complete';
const questReady=(p,q)=>questRecord(p,q)?.status==='active'&&questRecord(p,q).progress>=q.count;
const questAvailable=(p,q)=>!questRecord(p,q)&&(!q.classId||q.classId===(p.classId||defaultClassId))&&p.level>=q.minLevel&&q.requires.every(id=>questDone(p,id));
const activeQuests=p=>QUESTS.filter(q=>questRecord(p,q)?.status==='active').map(q=>questForPlayer(p,q));
const trackedQuest=p=>activeQuests(p).find(q=>q.id===p.trackedQuest)||activeQuests(p)[0];
const npcQuests=(p,npc)=>QUESTS.filter(q=>(questReady(p,q)?q.turnIn===npc:questAvailable(p,q)?q.giver===npc:false));
function dialogueQuests(p,npc){
  const turnIns=[],offers=[],ongoing=[];
  // Class-specific quest views are copies. Visit the registry once and put each
  // quest in exactly one bucket, rather than merging overlapping object lists.
  for(const q of QUESTS){
    if(questReady(p,q)&&q.turnIn===npc)turnIns.push(q);
    else if(questAvailable(p,q)&&q.giver===npc)offers.push(q);
    else if(questRecord(p,q)?.status==='active'&&(q.giver===npc||q.turnIn===npc))ongoing.push(q);
  }
  return [...turnIns,...offers,...ongoing].map(q=>questForPlayer(p,q));
}

function questDestination(p,q){return !q||questReady(p,q)?NPCS.find(n=>n.id===(q?.turnIn||NPCS[0]?.id)):q.location||NPCS.find(n=>n.id===q.giver);}

return {questRecord,questDone,questReady,questAvailable,activeQuests,trackedQuest,npcQuests,dialogueQuests,questDestination};
}
