import * as THREE from './vendor/three.module.min.js';

// Small shared 3D foliage sprays keep parallax around the terrace. Far plants
// reuse this mesh; there are no large crossed photographic rectangles.
export function createConiferGeometry(detail=false){
 const p=[],colors=[],indices=[];let seed=7201;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const axis=new THREE.Vector3(0,1,0);
 function leaf(center,direction,length,width){
  const side=new THREE.Vector3().crossVectors(direction,axis).normalize().multiplyScalar(width),tip=center.clone().addScaledVector(direction,length),mid=center.clone().lerp(tip,.52),start=p.length/3;
  const verts=[center,mid.clone().add(side),tip,mid.clone().sub(side)];
  const shade=.50+.45*rand()+.15*direction.y;
  for(const v of verts){p.push(...v.toArray());colors.push(.16*shade,.28*shade,.075*shade);}
  indices.push(start,start+1,start+2,start,start+2,start+3);
 }
 const tiers=detail?22:14,sprigs=detail?7:4;
 for(let tier=0;tier<tiers;tier++){
  const h=.1+tier/(tiers-1)*1.79,r=.36*Math.pow(1-h/2.1,.75),n=Math.round((detail?12:8)*(1-h/2.8));
  for(let k=0;k<n;k++){
   const a=k/n*Math.PI*2+tier*2.399+rand()*.15;
   for(let j=0;j<sprigs;j++){
    const u=j/sprigs,v=new THREE.Vector3(Math.sin(a)*r*u,h+.08*u,Math.cos(a)*r*u);
    for(const sign of [-1,1]){const b=a+sign*(.55+rand()*.6),direction=new THREE.Vector3(Math.sin(b),.55+rand()*.35,Math.cos(b)).normalize();leaf(v,direction,.075+rand()*.05,.021+rand()*.007);}
   }
  }
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();return g;
}
