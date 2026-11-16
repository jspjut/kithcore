export function circleHitsBox(x,z,box,radius=.3){const dx=x-Math.max(box.minX,Math.min(box.maxX,x)),dz=z-Math.max(box.minZ,Math.min(box.maxZ,z));return dx*dx+dz*dz<radius*radius;}
// Finite camera/subject segment, rather than an infinite ray, for local cutaways.
export function segmentHitsBox(a,b,box){
 let lo=0,hi=1;
 for(const axis of ['x','y','z']){const from=a[axis],delta=b[axis]-from,min=box[`min${axis.toUpperCase()}`],max=box[`max${axis.toUpperCase()}`];if(Math.abs(delta)<1e-8){if(from<min||from>max)return false;continue;}const t1=(min-from)/delta,t2=(max-from)/delta;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));if(lo>hi)return false;}
 return hi>=0&&lo<=1;
}
