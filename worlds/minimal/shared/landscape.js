// One compact map, five landscape regions. These are scenery/simulation regions,
// not separate servers or loading screens. Coordinates are metres (north = -z).
export const REGIONS=[
 {id:'commons',name:'Meadow Commons',color:'#86a572',x:0,z:8},
 {id:'grove',name:'Willow Grove',color:'#527f61',x:-46,z:-8},
 {id:'ridge',name:'Sunrise Ridge',color:'#acaa7e',x:20,z:-49},
 {id:'quarry',name:'Old Chalk Quarry',color:'#a29e8e',x:50,z:0},
 {id:'wetlands',name:'Reedwater Hollows',color:'#668f85',x:0,z:53}
];
export function landscapeAt(x,z){
 if(z>30)return REGIONS[4];
 if(z< -30)return REGIONS[2];
 if(x< -26)return REGIONS[1];
 if(x>28)return REGIONS[3];
 return REGIONS[0];
}
// Gentle, continuous hills leave every route walkable with ordinary movement.
const rise=(v,a,b)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
export function landscapeHeight(x,z){
 const ridge=14*rise(-z,23,59),grove=3*rise(-x,24,56),quarry=6*rise(x,25,58),hollow=-2.5*rise(z,25,54);
 const edge=rise(Math.hypot(x,z),24,58);
 return ridge+grove+quarry+hollow+edge*.45*Math.sin(x/10)*Math.sin(z/13);
}
export const TRAILS=[
 [[0,18],[0,8],[0,-8],[0,-25],[12,-37],[28,-46],[38,-59]],
 [[0,8],[-18,4],[-32,-4],[-44,-8],[-57,-19]],
 [[0,8],[20,8],[37,5],[49,0],[59,-12]],
 [[0,18],[-6,32],[0,45],[8,57]],
 [[-44,-8],[-43,-25],[-27,-39],[0,-43],[28,-46]]
];
export const HUBS=[{id:'camp',name:'Meadow camp',x:0,z:12,color:'#bd9563'},
 {id:'grove-post',name:'Willow rest',x:-44,z:-8,color:'#6b8f83'},
 {id:'ridge-post',name:'Ridgewatch camp',x:28,z:-46,color:'#b9956c'}];
// Decorative scatter stays clear of paths, characters and interactable objects.
export function trailDistance(x,z){let best=Infinity;for(const trail of TRAILS)for(let i=1;i<trail.length;i++){const [ax,az]=trail[i-1],[bx,bz]=trail[i],dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));best=Math.min(best,Math.hypot(x-ax-t*dx,z-az-t*dz));}return best;}
