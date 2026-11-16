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
