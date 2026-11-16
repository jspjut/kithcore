// Tick values describe absolute health, not percentages. Higher future health
// pools use 1/2/5 intervals so the overhead bars never become a solid hatch.
const cache=new Map();
export function healthTicks(maxHp){
 if(!Number.isFinite(maxHp)||maxHp<=0)return {step:100,marks:[]};
 if(cache.has(maxHp))return cache.get(maxHp);
 const needed=Math.max(100,maxHp/20),magnitude=10**Math.floor(Math.log10(needed)),step=[1,2,5,10].find(n=>n*magnitude>=needed)*magnitude,marks=[];
 for(let value=step;value<maxHp;value+=step)marks.push({value,percent:value/maxHp*100,major:value%(step*5)===0});
 const result={step,marks};cache.set(maxHp,result);return result;
}
export function overheadHealthBar(hp,maxHp,selected=false,friendly=false){
 if(!Number.isFinite(maxHp)||maxHp<=0)return '';
 const health=Math.max(0,Math.min(maxHp,Number.isFinite(hp)?hp:0)),{step,marks}=healthTicks(maxHp);
 return `<div class="mini-health${friendly?' friendly':''}" data-max-health="${maxHp}" data-health-tick="${step}" role="meter" aria-label="Health; each tick is ${step}" aria-valuemin="0" aria-valuemax="${maxHp}" aria-valuenow="${Math.ceil(health)}"><i style="width:${health/maxHp*100}%"></i><span class="mini-health-ticks" aria-hidden="true">${marks.map(t=>`<b class="health-tick${t.major?' major':''}" data-health-value="${t.value}" style="left:${t.percent}%"></b>`).join('')}</span>${selected?`<span class="mini-health-value" aria-hidden="true">${Math.ceil(health)} / ${maxHp}</span>`:''}</div>`;
}
