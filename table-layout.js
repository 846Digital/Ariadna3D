import {tables,longTable,headTable,columns,boundary,insidePolygon} from './layout.js?v=20261118-10';

const copy=value=>JSON.parse(JSON.stringify(value));
export function chairsFor(t,count=t.seats){
 if(t.type==='long')return Array.from({length:count},(_,i)=>{
  const first=Math.ceil(count/2),back=i>=first,n=back?count-first:first,k=back?i-first:i;
  return{x:t.x+(n===1?0:(k/(n-1)-.5)*(t.width-.54)),z:t.z+(back?.67:-.54)};
 });
 return Array.from({length:count},(_,i)=>{const a=i/count*Math.PI*2;return{x:t.x+Math.sin(a)*.97,z:t.z+Math.cos(a)*.97};});
}
const original=[...tables.map(t=>({...copy(t),type:'round'})),{...longTable,id:'long-1',name:'Длинный гостевой стол',type:'long'}];
original.at(-1).chairs=chairsFor(original.at(-1));
export const guestTables=copy(original);
export const seatCount=()=>guestTables.reduce((sum,t)=>sum+t.seats,headTable.seats);
export const serializeLayout=()=>copy(guestTables);
export function restoreLayout(data){
 if(!Array.isArray(data)||data.length>32)return false;
 const ids=new Set(),valid=[];
 for(const item of data){
  if(!item||typeof item.id!=='string'||ids.has(item.id)||!['round','long'].includes(item.type)||!Number.isFinite(item.x)||!Number.isFinite(item.z)||!insidePolygon(item.x,item.z)||!Number.isInteger(item.seats)||item.seats<1||item.seats>12)return false;
  ids.add(item.id);const t={id:item.id.slice(0,80),name:String(item.name||'Гостевой стол').slice(0,80),type:item.type,x:item.x,z:item.z,seats:item.seats};
  if(t.type==='long'){t.width=2.64;t.depth=.82;}else t.radius=.66;
  t.chairs=Array.isArray(item.chairs)&&item.chairs.length===t.seats&&item.chairs.every(c=>Number.isFinite(c.x)&&Number.isFinite(c.z)&&Math.hypot(c.x-t.x,c.z-t.z)<2)?copy(item.chairs):chairsFor(t);
  valid.push(t);
 }
 guestTables.splice(0,guestTables.length,...valid);return true;
}
export function resetLayout(){guestTables.splice(0,guestTables.length,...copy(original));}
export function moveTable(id,x,z){
 const t=guestTables.find(t=>t.id===id);if(!t)return;
 const dx=x-t.x,dz=z-t.z;t.x=x;t.z=z;for(const c of t.chairs){c.x+=dx;c.z+=dz;}return{dx,dz};
}
export function changeChairs(id,count){const t=guestTables.find(t=>t.id===id);if(!t)return;t.seats=Math.max(1,Math.min(12,Math.round(Number(count)||6)));t.chairs=chairsFor(t);}
export function tableObstacle(t){return t.type==='long'?{kind:'rect',id:t.id,x:t.x,z:t.z,w:t.width+.08,d:t.depth+.08}:{kind:'circle',id:t.id,x:t.x,z:t.z,r:t.radius+.08};}
function overlap(a,b){
 if(a.kind==='circle'&&b.kind==='circle')return Math.hypot(a.x-b.x,a.z-b.z)<a.r+b.r;
 if(a.kind==='rect'&&b.kind==='rect')return Math.abs(a.x-b.x)<(a.w+b.w)/2&&Math.abs(a.z-b.z)<(a.d+b.d)/2;
 const c=a.kind==='circle'?a:b,r=a.kind==='rect'?a:b;
 return Math.hypot(Math.max(0,Math.abs(c.x-r.x)-r.w/2),Math.max(0,Math.abs(c.z-r.z)-r.d/2))<c.r;
}
export function canPlace(t,x,z,ignore=[]){
 const dx=x-t.x,dz=z-t.z,candidate={...tableObstacle(t),x,z};
 const outline=t.type==='long'?[[x-t.width/2,z-t.depth/2],[x+t.width/2,z-t.depth/2],[x+t.width/2,z+t.depth/2],[x-t.width/2,z+t.depth/2]]:Array.from({length:12},(_,i)=>[x+Math.sin(i*Math.PI/6)*.74,z+Math.cos(i*Math.PI/6)*.74]);
 for(const c of t.chairs)for(let i=0;i<4;i++)outline.push([c.x+dx+Math.cos(i*Math.PI/2)*.21,c.z+dz+Math.sin(i*Math.PI/2)*.21]);
 if(outline.some(([px,pz])=>!insidePolygon(px,pz,boundary)))return false;
 const fixed=[...columns.map(c=>({kind:'circle',...c,r:.33})),{kind:'rect',x:headTable.x,z:headTable.z,w:.9,d:1.95},{kind:'rect',x:9.88,z:3.12,w:3.28,d:.92}];
 return ![...fixed,...guestTables.filter(other=>other.id!==t.id&&!ignore.includes(other.id)).map(tableObstacle)].some(o=>overlap(candidate,o));
}
export function addTable(){
 if(guestTables.length>=32)return null;
 const t={id:'table-'+Date.now().toString(36),name:'Новый стол '+(guestTables.filter(t=>t.type==='round').length+1),type:'round',x:0,z:0,radius:.66,seats:6};t.chairs=chairsFor(t);
 for(let z=5.4;z<=8.8;z+=.4)for(let x=3;x<=15.2;x+=.4)if(canPlace(t,x,z)){const dx=x-t.x,dz=z-t.z;t.x=x;t.z=z;for(const c of t.chairs){c.x+=dx;c.z+=dz;}guestTables.push(t);return t;}
 return null;
}
