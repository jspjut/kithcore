// Arc-length sampling keeps speed constant across unequal route segments.
export function sampleFlight(trip,elapsed,heightAt){
 const progress=Math.max(0,Math.min(1,elapsed/trip.duration));
 let distance=progress*trip.length,x=trip.points[0][0],z=trip.points[0][1],facing=0;
 for(let i=1;i<trip.points.length;i++){
  const a=trip.points[i-1],b=trip.points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  if(distance>length&&i<trip.points.length-1){distance-=length;continue;}
  const t=length?Math.min(1,distance/length):1;
  x=a[0]+(b[0]-a[0])*t;z=a[1]+(b[1]-a[1])*t;facing=Math.atan2(b[0]-a[0],b[1]-a[1]);break;
 }
 return {x,z,y:heightAt(x,z)+Math.sin(Math.PI*progress)*24,facing,grounded:false,jumpHeight:0};
}
