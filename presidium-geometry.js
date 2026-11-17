import * as THREE from './vendor/three.module.min.js';

function surface(columns,rows,point){
 const positions=[],uv=[],indices=[];
 for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++){
  const u=i/columns,v=j/rows;positions.push(...point(u,v));uv.push(u*3,v*3);
  if(j<rows&&i<columns){const a=j*(columns+1)+i,b=a+columns+1;indices.push(a,b,a+1,a+1,b,b+1);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}

// The inner hems open from the centre fixing into two heavy, gathered curtains.
export function partedCurtain(side){
 return surface(104,100,(u,v)=>{
  const inner=.035+(side<0?1.08:.98)*Math.pow(Math.sin(v*Math.PI/2),.80);
  const x=side*(2.325*(1-u)+inner*u);
  const gather=Math.sin(u*Math.PI)*Math.sin(v*Math.PI);
  const pleat=Math.sin(u*Math.PI*30+.9*Math.sin(v*7))+.24*Math.sin(u*Math.PI*60);
  return [x,2.96*(1-v),.12+.032*pleat*(.5+v*.5)+.045*gather+.08*u*u];
 });
}

export function curtainSwag(side,index){
 const outerY=[2.75,2.12,1.48,.84][index],innerY=[2.58,2.14,1.57,1.04][index];
 const innerX=[.40,.64,.87,1.04][index],sag=[.36,.38,.32,.24][index];
 return surface(72,28,(u,v)=>{
  const hanging=Math.sin(u*Math.PI),x=side*(2.30*(1-u)+innerX*u);
  return[x,outerY*(1-u)+innerY*u-(sag+v*.14)*hanging-v*.012,.16+.08*u+.08*hanging+.016*Math.sin(v*Math.PI*14)*hanging];
 });
}

export function tableSwag(width=.93){
 return surface(72,28,(u,v)=>{
  const sag=Math.pow(Math.sin(u*Math.PI),.72);
  return [(u-.5)*width,.735-(.27+.24*v)*sag,.02+.065*Math.sin(v*Math.PI)*sag+.015*Math.sin(v*Math.PI*14)*sag];
 });
}

// Four broad festoons meet at gathered points. Each is a continuous sheet:
// the folds follow the hanging lower edge, rather than separate rope-like arcs.
export function gatheredFestoon(side,outer=false){
 const start=outer?1.57:0,end=outer?2.325:1.57;
 const startY=outer?1.78:2.88,endY=outer?1.04:1.78,sag=outer?.32:.64;
 return surface(112,64,(u,v)=>{
  const hanging=Math.sin(u*Math.PI),hem=startY*(1-u)+endY*u-sag*Math.pow(hanging,.84);
  const top=2.96,phase=v*Math.PI*15+.26*Math.sin(u*5)+u*.33;
  const gathering=Math.pow(hanging,.6)*(.22+.78*Math.sin(v*Math.PI/2));
  const fold=(Math.sin(phase)+.24*Math.sin(phase*2+.4))*.065*gathering;
  const vertical=.014*Math.sin(u*57+.5*Math.sin(v*4))*(1-v)*.6;
  return [side*(start+u*(end-start)),top+(hem-top)*v,.13+fold+vertical+.045*hanging];
 });
}

export function fabricGather(){
 return surface(48,16,(u,v)=>{
  const a=u*Math.PI*2,b=v*Math.PI*2,r=.042+.012*Math.cos(b)+.006*Math.sin(a*9);
  return [Math.cos(a)*r,Math.sin(a)*r*.76,.012*Math.sin(b)];
 });
}
