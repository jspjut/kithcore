const viewer=document.querySelector('#viewer'),frame=document.querySelector('#scene-frame'),title=document.querySelector('#viewer-title');
for(const button of document.querySelectorAll('[data-scene]'))button.addEventListener('click',()=>{
 const url=new URL('scene.html',location.href);url.searchParams.set('scene',button.dataset.scene);frame.src=url.href;frame.title=button.dataset.title+' interactive preview';title.textContent=button.dataset.title;viewer.hidden=false;viewer.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});
});
document.querySelector('#close-scene').addEventListener('click',()=>{viewer.hidden=true;frame.removeAttribute('src');});

// Muted looping motion is the default; pause offscreen/hidden and honor reduced motion.
const preference=matchMedia('(prefers-reduced-motion: reduce)'),demos=[...document.querySelectorAll('video[data-demo]')],toggle=document.querySelector('#toggle-demos'),inView=new Set();
let paused=preference.matches,userChoice=false;
function updateDemos(){for(const video of demos){if(!paused&&!document.hidden&&inView.has(video)){video.muted=true;video.play().catch(()=>{});}else video.pause();}toggle.setAttribute('aria-pressed',String(paused));toggle.textContent=paused?'Play demos':'Pause demos';}
const observer=new IntersectionObserver(entries=>{for(const entry of entries)entry.isIntersecting?inView.add(entry.target):inView.delete(entry.target);updateDemos();},{threshold:.15});
for(const video of demos){video.muted=true;video.loop=true;if(paused)video.removeAttribute('autoplay');observer.observe(video);}
toggle.addEventListener('click',()=>{paused=!paused;userChoice=true;updateDemos();});document.addEventListener('visibilitychange',updateDemos);preference.addEventListener('change',()=>{if(!userChoice)paused=preference.matches;updateDemos();});updateDemos();
