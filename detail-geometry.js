import * as THREE from './vendor/three.module.min.js';

// Closed padded shell: the same sweep forms the back and the lowered armrests.
// All dimensions are in metres. Its surfaces remain curved at close range.
function shellTop(a,arms){const u=Math.max(0,Math.min(1,(Math.abs(a)-.73)/.92));return arms?1.01-.34*u*u*(3-2*u):.98+.018*Math.cos(a);}
export function upholsteredShell(arms=true){
 const p=[],uv=[],idx=[],N=32,R=16,span=arms?1.65:1.10;
 for(let i=0;i<=N;i++)for(let j=0;j<=R;j++){
  const a=(i/N-.5)*span*2,t=j/R*Math.PI*2;
  const top=shellTop(a,arms);
  const bottom=.455,mid=(top+bottom)/2,half=(top-bottom)/2;
  const radial=.029*Math.sin(t),r=.292+radial;
  p.push(r*Math.sin(a),mid+half*Math.cos(t),.055-r*Math.cos(a)-.035*(Math.cos(t)+1)/2);
  uv.push(i/N*1.8,j/R*2);
  if(i<N&&j<R){const k=i*(R+1)+j;idx.push(k,k+1,k+R+1,k+1,k+R+2,k+R+1);}
 }
 // End caps are rounded rather than open sheets.
 for(const i of [0,N]){
  const start=p.length/3,a=(i/N-.5)*span*2;
  const top=shellTop(a,arms);
  p.push(.292*Math.sin(a),(top+.455)/2,.055-.292*Math.cos(a)-.0175);uv.push(.5,.5);
  for(let j=0;j<R;j++){const k=i*(R+1)+j;if(i===0)idx.push(start,k+1,k);else idx.push(start,k,k+1);}
 }
 for(let i=0;i<idx.length;i+=3){const b=idx[i+1];idx[i+1]=idx[i+2];idx[i+2]=b;}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}

export function shellSeam(arms=true){
 const span=arms?1.65:1.10;
 return Array.from({length:65},(_,i)=>{
  const a=(i/64-.5)*span*2,top=shellTop(a,arms);
  return[.294*Math.sin(a),top-.005,.055-.294*Math.cos(a)-.035];
 });
}

export function cushion(){
 const shape=new THREE.Shape(),w=.49,d=.47,r=.105;
 shape.moveTo(-w/2+r,-d/2);shape.lineTo(w/2-r,-d/2);shape.quadraticCurveTo(w/2,-d/2,w/2,-d/2+r);
 shape.lineTo(w/2,d/2-r);shape.quadraticCurveTo(w/2,d/2,w/2-r,d/2);shape.lineTo(-w/2+r,d/2);
 shape.quadraticCurveTo(-w/2,d/2,-w/2,d/2-r);shape.lineTo(-w/2,-d/2+r);shape.quadraticCurveTo(-w/2,-d/2,-w/2+r,-d/2);
 const g=new THREE.ExtrudeGeometry(shape,{depth:.045,bevelEnabled:true,bevelThickness:.028,bevelSize:.015,bevelSegments:3,curveSegments:8,steps:1});
 g.rotateX(-Math.PI/2);g.computeVertexNormals();return g;
}

// Curved petal faces +z. Shape and crimped edge are geometry, not a billboard.
export function petal(kind='orchid'){
 const p=[],uv=[],idx=[],N=kind==='orchid'?8:6,R=kind==='orchid'?10:8;
 for(let j=0;j<=R;j++)for(let i=0;i<=N;i++){
  const v=j/R,u=i/N*2-1;
  const carnation=kind==='carnation';
  const width=carnation?.035:.038,length=carnation?.052:.093;
  const outline=Math.pow(Math.sin(Math.PI*v),carnation?.48:.67);
  const x=u*width*outline*(1+(carnation?.065:.018)*Math.sin(v*43+u*19));
  const z=(carnation?.022:.010)*Math.sin(v*Math.PI)-u*u*.006*Math.sin(v*Math.PI)
   +(carnation?.006:.0017)*Math.sin(u*24+v*32)*Math.pow(Math.abs(u),3)*Math.sin(v*Math.PI);
  p.push(x,v*length,z+.0012*Math.sin(u*18)*Math.sin(v*Math.PI));uv.push(i/N,v);
  if(j<R&&i<N){const k=j*(N+1)+i;idx.push(k,k+1,k+N+1,k+1,k+N+2,k+N+1);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}

export function leafGeometry(){
 const p=[],uv=[],idx=[],N=4,R=8;
 for(let j=0;j<=R;j++)for(let i=0;i<=N;i++){
  const v=j/R,u=i/N*2-1;
  p.push(.018*u*Math.pow(Math.sin(v*Math.PI),.85),v*.14,.014*Math.sin(v*Math.PI)-.009*Math.abs(u)*Math.sin(v*Math.PI));uv.push(i/N,v);
  if(j<R&&i<N){const k=j*(N+1)+i;idx.push(k,k+1,k+N+1,k+1,k+N+2,k+N+1);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}

export function foldedNapkin(){
 const g=new THREE.PlaneGeometry(.19,.29,18,24),p=g.attributes.position;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),v=p.getY(i)/.29+.5;
  // Layered cloth rolled softly at the middle and opening at the ends.
  p.setXYZ(i,x*(.56+.44*Math.pow(Math.abs(v-.5)*2,.7)),.008+.018*Math.cos(x*34)+.009*Math.sin(v*3.6)+.006*Math.sin(x*165+v*3),p.getY(i));
 }
 g.computeVertexNormals();return g;
}

export function pooledFabric(width,depth){
 const p=[],uv=[],idx=[],N=72,R=48;
 for(let j=0;j<=R;j++)for(let i=0;i<=N;i++){
  const u=i/N,v=j/R,x=(u-.5)*width,z=(v-.5)*depth;
  const edge=Math.sin(u*Math.PI)*Math.sin(v*Math.PI),r=Math.hypot(x,z),a=Math.atan2(x,z);
  p.push(x,.012+edge*(.015+.022*Math.sin(a*17+r*8)+.012*Math.sin(a*31-r*10)),z);
  uv.push(u*2,v*2);
  if(j<R&&i<N){const k=j*(N+1)+i;idx.push(k,k+1,k+N+1,k+1,k+N+2,k+N+1);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}

export function gatheredTableFront(width,height){
 const p=[],uv=[],idx=[],N=180,R=48;
 for(let j=0;j<=R;j++)for(let i=0;i<=N;i++){
  const u=i/N,v=j/R,x=(u-.5)*width;
  const fold=Math.sin(u*Math.PI*58)+.27*Math.sin(u*Math.PI*116+.25);
  const fall=height*v;
  p.push(x*(1+.09*Math.pow(v,3)),height-fall+.009*Math.sin(u*91)*v,.025+(.008+.034*v)*fold+.16*Math.pow(v,8));
  uv.push(u*3,v*2);
  if(j<R&&i<N){const k=j*(N+1)+i;idx.push(k,k+N+1,k+1,k+1,k+N+1,k+N+2);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}

export function suspendedSwag(){
 const p=[],uv=[],idx=[],N=180,R=96;
 for(let j=0;j<=R;j++)for(let i=0;i<=N;i++){
  const u=i/N,v=j/R,x=-.69+u*3.04;
  const bottom=2.92-2.76*Math.pow(u,1.63),y=bottom+(2.96-bottom)*v;
  // Curves follow the load toward the upper right fixing point.
  const radius=Math.hypot((x-2.34)*.86,(y-2.96)*1.07);
  const folds=Math.sin(radius*30)+.22*Math.sin(radius*60+.3);
  p.push(x,y,.18+.033*folds*Math.pow(Math.sin(v*Math.PI),.35)+.06*Math.sin(u*Math.PI)*Math.sin(v*Math.PI));uv.push(u*3,v*2.8);
  if(j<R&&i<N){const k=j*(N+1)+i;idx.push(k,k+1,k+N+1,k+1,k+N+2,k+N+1);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
