import * as THREE from './vendor/three.module.min.js';
import {createIrradiance} from './irradiance.js?v=20261117-9';
import {createExterior} from './exterior.js?v=20261117-9';
import {createContactShadows} from './contact-shadows.js?v=20261117-9';
import {guestTables,seatCount} from './table-layout.js?v=20261117-9';
import {Reflector} from './vendor/Reflector.js';
import {partedCurtain,curtainSwag,tableSwag,gatheredFestoon,fabricGather} from './presidium-geometry.js?v=20261117-9';
import {addMusicStage} from './venue-details.js?v=20261117-9';
import {upholsteredShell,shellSeam,cushion,petal,leafGeometry,foldedNapkin,drapedNapkin,anthuriumPetal,pooledFabric,gatheredTableFront,suspendedSwag} from './detail-geometry.js?v=20261117-9';
import {boundary,HEIGHT,columns,headTable} from './layout.js?v=20261117-9';

export const palettes={
 reference:{name:'По фотографии',cloth:'#eadbc2',napkin:'#4b3024',backdrop:'#eee0c8',drape:'#4c2d1e',pink:'#f2e9df',green:'#e7e6d8'},
 rose:{name:'Пыльная роза',cloth:'#bc9094',napkin:'#68714c',backdrop:'#c69ea2',drape:'#707853',pink:'#d6a5b1',green:'#829267'},
 olive:{name:'Олива и шоколад',cloth:'#858767',napkin:'#563b2e',backdrop:'#a2a58a',drape:'#563a2c',pink:'#d1bcab',green:'#7d8d62'},
 pistachio:{name:'Бежевый и фисташковый',cloth:'#e4d3b3',napkin:'#a5b378',backdrop:'#eadcc4',drape:'#a0ac71',white:'#f3d5d3',pink:'#e5b4bd',green:'#a4bb75'},
 milk:{name:'Молочный и фисташковый',cloth:'#eee1ca',napkin:'#a2b077',backdrop:'#f0e5d2',drape:'#9da96d',white:'#f4d5d4',pink:'#e3a5b5',green:'#8da65d'},
};

const geometries=new Map();
const geometry=(key,create)=>{if(!geometries.has(key))geometries.set(key,create());return geometries.get(key);};
const unitBox=()=>geometry('box',()=>new THREE.BoxGeometry(1,1,1));
const unitSphere=()=>geometry('sphere',()=>new THREE.SphereGeometry(1,12,8));
const cylinder=(rt,rb,h,n=24)=>geometry(`cyl-${rt}-${rb}-${h}-${n}`,()=>new THREE.CylinderGeometry(rt,rb,h,n));
const ring=(r,t=.005)=>geometry(`ring-${r}-${t}`,()=>new THREE.TorusGeometry(r,t,4,32));
const Y=new THREE.Vector3(0,1,0);
let seed=7463;
function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}

function proceduralTexture(type){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=type==='stone'?512:256;
 const c=canvas.getContext('2d'),n=canvas.width,image=c.createImageData(n,n);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  let value;
  if(type==='stone')value=104+(random()-.5)*15+Math.sin(x*.045+y*.025)*3+Math.sin(x*.12-y*.08)*1.5;
  else if(type==='fabric')value=190+((x%3===0||y%3===0)?-16:4)+(random()-.5)*14;
  else value=222+(random()-.5)*9+Math.sin(x*.06+Math.sin(y*.03)*3)*3;
  const i=(y*n+x)*4;image.data[i]=value;image.data[i+1]=value;image.data[i+2]=value;image.data[i+3]=255;
 }
 c.putImageData(image,0,0);
 if(type==='stone'){c.strokeStyle='#777671';c.lineWidth=1.4;c.strokeRect(0,0,n,n);}
 const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
 texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
 if(type==='stone')texture.repeat.set(16.74/1.1,10/1.1);
 if(type==='fabric')texture.repeat.set(3,3);
 return texture;
}

function mesh(g,m,parent,x=0,y=0,z=0,sx=1,sy=1,sz=1){
 const object=new THREE.Mesh(g,m);object.position.set(x,y,z);object.scale.set(sx,sy,sz);parent.add(object);return object;
}
function box(w,h,d,m,parent,x=0,y=0,z=0){return mesh(unitBox(),m,parent,x,y,z,w,h,d);}
function sphere(rx,ry,rz,m,parent,x,y,z){return mesh(unitSphere(),m,parent,x,y,z,rx,ry,rz);}
function rod(a,b,r,m,parent){
 const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),delta=vb.clone().sub(va);
 const object=mesh(cylinder(1,1,1,8),m,parent,...va.clone().add(vb).multiplyScalar(.5).toArray(),r,delta.length(),r);
 object.quaternion.setFromUnitVectors(Y,delta.normalize());return object;
}
function tube(points,r,m,parent,closed=false){
 const key='tube-'+r+'-'+closed+'-'+JSON.stringify(points);
  const geo=geometry(key,()=>{const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),closed);return new THREE.TubeGeometry(curve,Math.max(12,Math.min(closed?96:48,points.length*2)),r,r<.004?3:5,closed);});
 return mesh(geo,m,parent);
}
function group(parent,x=0,y=0,z=0,rotation=0){const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rotation;parent.add(g);return g;}

// Thousands of petals, cutlery pieces, and chair parts become a small number of
// GPU draw calls. Every batch retains its own visibility group for style changes.
function instanceStatic(root){
 root.updateMatrixWorld(true);
 const inverse=root.matrixWorld.clone().invert(),buckets=new Map(),remove=[];
 root.traverse(object=>{
  if(!object.isMesh||object.isInstancedMesh||object.userData.unbatched)return;
  const key=object.geometry.uuid+'-'+object.material.uuid+'-'+Boolean(object.userData.shadow);
  if(!buckets.has(key))buckets.set(key,{geometry:object.geometry,material:object.material,matrices:[],tableIds:[],shadow:!!object.userData.shadow});
  buckets.get(key).matrices.push(inverse.clone().multiply(object.matrixWorld));let ancestor=object;while(ancestor&&ancestor!==root&&!ancestor.userData.tableId)ancestor=ancestor.parent;buckets.get(key).tableIds.push(ancestor?.userData.tableId||null);remove.push(object);
 });
 for(const object of remove)object.removeFromParent();
 for(const b of buckets.values()){
  const instances=new THREE.InstancedMesh(b.geometry,b.material,b.matrices.length);
  b.matrices.forEach((matrix,i)=>instances.setMatrixAt(i,matrix));
  instances.castShadow=b.shadow;instances.receiveShadow=!b.material.transparent;
  instances.userData.tableIds=b.tableIds;instances.instanceMatrix.needsUpdate=true;instances.computeBoundingSphere();root.add(instances);
 }
}

// Unique light filaments have different curves but share three materials. Bake
// their transforms into a few buffers so their detail costs no extra draw calls.
function mergeStatic(root){
 root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert(),buckets=new Map(),remove=[];
 root.traverse(o=>{
  if(!o.isMesh||o.isInstancedMesh||o.userData.unbatched||Array.isArray(o.material))return;
  const key=o.material.uuid+'-'+!!o.userData.shadow;
  if(!buckets.has(key))buckets.set(key,{material:o.material,shadow:!!o.userData.shadow,p:[],n:[],uv:[],idx:[]});
  const b=buckets.get(key),g=o.geometry.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld)),offset=b.p.length/3;
  b.p.push(...g.attributes.position.array);if(g.attributes.normal)b.n.push(...g.attributes.normal.array);
  if(g.attributes.uv)b.uv.push(...g.attributes.uv.array);else for(let i=0;i<g.attributes.position.count;i++)b.uv.push(0,0);
  if(g.index)for(const k of g.index.array)b.idx.push(k+offset);else for(let i=0;i<g.attributes.position.count;i++)b.idx.push(i+offset);
  g.dispose();remove.push(o);
 });
 for(const o of remove)o.removeFromParent();
 for(const b of buckets.values()){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(b.uv,2));g.setIndex(b.idx);
  if(b.n.length===b.p.length)g.setAttribute('normal',new THREE.Float32BufferAttribute(b.n,3));else g.computeVertexNormals();
  const o=new THREE.Mesh(g,b.material);o.userData.shadow=b.shadow;root.add(o);
 }
}

function pleatedPlane(width,height,folds,amplitude=.028){
 const geo=new THREE.PlaneGeometry(width,height,Math.ceil(folds*9),20);
 const pos=geo.attributes.position;
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),y=pos.getY(i),u=x/width+.5,v=y/height+.5;
  const phase=u*folds*Math.PI*2+.20*Math.sin(u*27)+(1-v)*.14*Math.sin(u*11);
  pos.setZ(i,amplitude*(Math.sin(phase)+.22*Math.sin(phase*2))*(.7+.3*(1-v)));
  pos.setY(i,y+.006*Math.sin(u*51)*Math.pow(1-v,4));
 }
 geo.computeVertexNormals();return geo;
}

function roundCloth(radius,height){
 const positions=[],uvs=[],indices=[],segments=160,rows=44;
 for(let y=0;y<=rows;y++)for(let i=0;i<=segments;i++){
  const t=i/segments*Math.PI*2,v=y/rows;
  const phase=t*11+.42*Math.sin(t*3)+.18*Math.sin(t*7);
  const amplitude=.007+.075*Math.pow(v,.74);
  const folds=Math.sin(phase)+.28*Math.sin(phase*2+.45)+.13*Math.sin(t*23+v*.65);
  const r=radius+.003+.008*Math.sin(v*Math.PI/2)+.055*v*v+amplitude*folds;
  const hem=.035+.025*(1+Math.sin(t*4+.3))+.016*Math.sin(t*7);
  positions.push(Math.sin(t)*r,height-(height-hem)*v+.008*Math.sin(t*8)*v*v,Math.cos(t)*r);
  // Grain follows the original flat circular cloth, rather than horizontal bands.
  const materialRadius=radius+v*(height-.04);
  uvs.push(.5+Math.sin(t)*materialRadius/2.8,.5+Math.cos(t)*materialRadius/2.8);
  if(y<rows&&i<segments){const a=y*(segments+1)+i,b=a+segments+1;indices.push(a,b,a+1,b,b+1,a+1);}
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}

function rectangularCloth(w,d,h){
 const positions=[],uvs=[],indices=[],N=112,R=14;
 for(let row=0;row<=R;row++)for(let i=0;i<=N;i++){
  const t=i/N*Math.PI*2,v=row/R,cs=Math.cos(t),sn=Math.sin(t);
  const scale=1/Math.max(Math.abs(cs)/(w/2),Math.abs(sn)/(d/2));
  const r=scale+.012+v*.025+v*v*.012*Math.sin(i/N*Math.PI*52);
  positions.push(cs*r,h-v*(h-.07)+.008*Math.sin(t*23)*v,sn*r);uvs.push(i/N*4,v);
  if(row<R&&i<N){const a=row*(N+1)+i,b=a+N+1;indices.push(a,b,a+1,b,b+1,a+1);}
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}

function chairBack(){
 const p=[],indices=[],uv=[],N=18,R=10;
 for(let j=0;j<=R;j++)for(let i=0;i<=N;i++){
  const u=i/N,v=j/R,a=(u-.5)*2.45;
  p.push(.31*Math.sin(a)*(1-.07*v),.46+v*.54,.025-.25*Math.cos(a)-.035*v);
  uv.push(u,v);
  if(j<R&&i<N){const k=j*(N+1)+i;indices.push(k,k+N+1,k+1,k+1,k+N+1,k+N+2);}
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}

function seatGeometry(){
 const shape=new THREE.Shape(),w=.5,d=.49,r=.10;
 shape.moveTo(-w/2+r,-d/2);shape.lineTo(w/2-r,-d/2);shape.quadraticCurveTo(w/2,-d/2,w/2,-d/2+r);
 shape.lineTo(w/2,d/2-r);shape.quadraticCurveTo(w/2,d/2,w/2-r,d/2);shape.lineTo(-w/2+r,d/2);
 shape.quadraticCurveTo(-w/2,d/2,-w/2,d/2-r);shape.lineTo(-w/2,-d/2+r);shape.quadraticCurveTo(-w/2,-d/2,-w/2+r,-d/2);
 const geo=new THREE.ExtrudeGeometry(shape,{depth:.065,bevelEnabled:true,bevelThickness:.018,bevelSize:.012,bevelSegments:2,steps:1,curveSegments:5});geo.rotateX(-Math.PI/2);return geo;
}

function ruffle(){
 const p=[0,.018,0],uv=[.5,.5],idx=[],N=32,R=5;
 for(let row=1;row<=R;row++)for(let i=0;i<=N;i++){
  const a=i/N*Math.PI*2,v=row/R,r=.048*v*(1+.12*Math.sin(a*9)+.045*Math.sin(a*17));
  p.push(Math.sin(a)*r,.014*(1-v)+.010*Math.sin(a*13)*v*v,Math.cos(a)*r);uv.push(.5+Math.sin(a)*v/2,.5+Math.cos(a)*v/2);
 }
 for(let i=0;i<N;i++)idx.push(0,i+1,i+2);
 for(let row=0;row<R-1;row++)for(let i=0;i<N;i++){const a=1+row*(N+1)+i,b=a+N+1;idx.push(a,b,a+1,b,b+1,a+1);}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();return geo;
}

export async function createHall(renderer){
 seed=7463;
 let contactShadows=null;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#bcb4a2');
 const room=new THREE.Group(),ceiling=new THREE.Group(),lightsVisual=new THREE.Group(),decor=new THREE.Group(),flowersRef=new THREE.Group(),flowersSubtle=new THREE.Group(),referenceExtras=new THREE.Group(),planWalls=new THREE.Group();
 const draperyReference=new THREE.Group(),draperyNew=new THREE.Group(),draperyPistachio=new THREE.Group(),presidiumFlowersOriginal=new THREE.Group(),presidiumFlowersNew=new THREE.Group();
 scene.add(room,ceiling,lightsVisual,decor,flowersRef,flowersSubtle,referenceExtras,planWalls,draperyReference,draperyNew,draperyPistachio,presidiumFlowersOriginal,presidiumFlowersNew);planWalls.visible=false;
 const fabric=proceduralTexture('fabric'),stone=proceduralTexture('stone'),plaster=proceduralTexture('plaster');
 const textureLoader=new THREE.TextureLoader();
 const textures={};
 const specifications={
  velvetNormal:['velour_velvet','nor_gl',2,2],velvetRough:['velour_velvet','Rough',2,2],velvetAO:['velour_velvet','AO',2,2],
  fabricNormal:['fabric_pattern_07','nor_gl',4,4],fabricRough:['fabric_pattern_07','Rough',4,4],
  plasterNormal:['white_plaster_02','nor_gl',2,2],plasterRough:['white_plaster_02','Rough',2,2],
 };
 await Promise.all(Object.entries(specifications).map(async([key,[asset,channel,rx,ry,color]])=>{
  const t=await textureLoader.loadAsync(`./assets/pbr-${asset}-${channel}.jpg`);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());if(color)t.colorSpace=THREE.SRGBColorSpace;textures[key]=t;
 }));
 const stageWallMap=await textureLoader.loadAsync('./assets/venue-stage.jpg');stageWallMap.colorSpace=THREE.SRGBColorSpace;
 // Sample only the unobstructed botanical wall, not furniture or equipment.
 stageWallMap.offset.set(.674,.50);stageWallMap.repeat.set(.16,.105);stageWallMap.anisotropy=4;
 for(const [key,file,rx,ry,color] of [['floorColor','stone-color',16.74/2.6,10/2.6,true],['floorNormal','stone-normal',16.74/2.6,10/2.6,false],['floorRough','stone-roughness',16.74/2.6,10/2.6,false],['velvetColor','upholstery-nap',1.5,1.5,true],['plasterColor','plaster-color',2,2,true]]){
  const t=await textureLoader.loadAsync('./assets/'+file+'.webp?v=20261117-9');t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(key.startsWith('floor')?16.74/2.4:rx,key.startsWith('floor')?10/2.4:ry);t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());if(color)t.colorSpace=THREE.SRGBColorSpace;textures[key]?.dispose();textures[key]=t;
 }
 const standard=(color,roughness=.8,extra={})=>new THREE.MeshStandardMaterial({color,roughness,...extra});
 const cloth=(color)=>new THREE.MeshPhysicalMaterial({color,roughness:.72,side:THREE.DoubleSide,normalMap:textures.fabricNormal,normalScale:new THREE.Vector2(.085,.085),roughnessMap:textures.fabricRough,sheen:.65,sheenRoughness:.72,sheenColor:'#f4eadd'});
 const m={
  wall:standard('#dcd3c4',.93,{map:textures.plasterColor,normalMap:textures.plasterNormal,normalScale:new THREE.Vector2(.08,.08),roughnessMap:textures.plasterRough}),ceiling:standard('#eeeae1'),trim:standard('#eeeae0',.66),
  floor:standard('#ffffff',.55,{map:textures.floorColor,normalMap:textures.floorNormal,normalScale:new THREE.Vector2(.12,.12),roughnessMap:textures.floorRough,envMapIntensity:1.4}),
  chair:new THREE.MeshPhysicalMaterial({color:'#665044',roughness:.94,map:textures.velvetColor,normalMap:textures.velvetNormal,normalScale:new THREE.Vector2(.16,.16),roughnessMap:textures.velvetRough,aoMap:textures.velvetAO,aoMapIntensity:.32,sheen:.42,sheenRoughness:.88,sheenColor:'#8e7566'}),piping:standard('#574238',.78),
  dark:standard('#25231f',.6),wood:standard('#30231c',.62),gold:standard('#af8850',.27,{metalness:.78}),silver:standard('#b7b8ad',.23,{metalness:.85}),
  ceramic:standard('#f1eee3',.22),plateInner:standard('#e5e1d4',.3),
  cloth:cloth(palettes.reference.cloth),napkin:cloth(palettes.reference.napkin),backdrop:cloth(palettes.reference.backdrop),drape:cloth(palettes.reference.drape),
  curtain:cloth('#ccbaa0'),stem:standard('#63734a'),leaf:standard('#6c8054',.9,{side:THREE.DoubleSide}),
  flowerWhite:new THREE.MeshPhysicalMaterial({color:'#fffdf5',roughness:.58,side:THREE.DoubleSide,sheen:.4,sheenColor:'#fff9eb'}),flowerPink:standard(palettes.reference.pink,.7,{side:THREE.DoubleSide}),flowerGreen:standard(palettes.reference.green,.77,{side:THREE.DoubleSide}),pollen:standard('#c7a346',.65),
  glass:new THREE.MeshPhysicalMaterial({color:'#ffffff',roughness:.035,metalness:0,transmission:0,thickness:.002,clearcoat:.18,clearcoatRoughness:.04,ior:1.46,transparent:true,opacity:.35,side:THREE.DoubleSide,forceSinglePass:true,depthWrite:false}),
  glassRim:standard('#dce8de',.1,{metalness:.35,transparent:true,opacity:.42,depthWrite:false}),
  mirror:standard('#a9b4ad',.08,{metalness:.95}),window:new THREE.MeshPhysicalMaterial({color:'#dbe8e7',roughness:.035,metalness:0,ior:1.46,clearcoat:1,clearcoatRoughness:.025,transparent:true,opacity:.055,side:THREE.DoubleSide,forceSinglePass:true,depthWrite:false}),
  glow:new THREE.MeshBasicMaterial({color:'#ffe3a6'}),shade:standard('#fff1d7',.8,{emissive:'#f9dfac',emissiveIntensity:.65}),
  lace:new THREE.MeshStandardMaterial({color:'#eee8dd',roughness:.92,side:THREE.DoubleSide,transparent:true,alphaTest:.3}),
  greenSofa:standard('#657044',.94,{bumpMap:fabric,bumpScale:.002}),barstool:new THREE.MeshPhysicalMaterial({color:'#914b28',roughness:.89,normalMap:textures.velvetNormal,normalScale:new THREE.Vector2(.28,.28),roughnessMap:textures.velvetRough,sheen:.75,sheenColor:'#bc784e'}),
 };
 // A fixed set of material slots changes flower colours without changing petals,
 // positions, visibility or the number of meshes and draw calls.
 m.glass.userData.venueGlass=true;
 const floralBases=[m.flowerWhite,m.flowerPink,m.flowerGreen];
 const flowerMaterials=floralBases.flatMap((base,category)=>Array.from({length:4},()=>({material:base.clone(),category})));
 let flowerSlot=0,flowerMode='current',presidium='original',tableDecor='flowers',tableDesign='original';
 function floralMaterial(base){const category=Math.max(0,floralBases.indexOf(base));return flowerMaterials[category*4+(flowerSlot++%4)].material;}
 const dopamine=['#f34983','#ff8d36','#f4ca35','#a574d1','#dd4772','#f6a75a','#a6be63','#c27fbd'];
 function updateFlowers(){const p=palettes[style];flowerMaterials.forEach(({material,category},i)=>material.color.set(flowerMode==='dopamine'?dopamine[i%dopamine.length]:category===0?(p.white||'#fffdf5'):category===1?p.pink:p.green));}
 // A local procedural environment gives metal and glass readable reflections.
 const envCanvas=document.createElement('canvas');envCanvas.width=512;envCanvas.height=256;const ec=envCanvas.getContext('2d');
 ec.fillStyle='#b7b0a2';ec.fillRect(0,0,512,256);ec.fillStyle='#e4ddd0';ec.fillRect(0,0,512,100);ec.fillStyle='#6b6257';ec.fillRect(0,180,512,76);
 for(let i=0;i<5;i++){ec.fillStyle='#fff9e8';ec.fillRect(12+i*100,65,30,105);ec.fillStyle='#78756a';ec.fillRect(25+i*100,65,2,105);}
 const envTex=new THREE.CanvasTexture(envCanvas);envTex.mapping=THREE.EquirectangularReflectionMapping;envTex.colorSpace=THREE.SRGBColorSpace;
 const pmrem=new THREE.PMREMGenerator(renderer),env=pmrem.fromEquirectangular(envTex);scene.environment=env.texture;scene.environmentIntensity=.55;envTex.dispose();pmrem.dispose();

 const floorShape=new THREE.Shape();boundary.forEach(([x,z],i)=>i?floorShape.lineTo(x,-z):floorShape.moveTo(x,-z));floorShape.closePath();
 const floorGeo=new THREE.ShapeGeometry(floorShape);floorGeo.rotateX(-Math.PI/2);
 const uvs=floorGeo.attributes.uv,positions=floorGeo.attributes.position;
 for(let i=0;i<uvs.count;i++)uvs.setXY(i,positions.getX(i)/16.74,positions.getZ(i)/10);
 const floor=mesh(floorGeo,m.floor,scene,0,-.008,0);floor.receiveShadow=true;
 const stageFloorGeometry=new THREE.PlaneGeometry(2.2,3.56);stageFloorGeometry.rotateX(-Math.PI/2);stageFloorGeometry.translate(15.64,-.008,5.7);
 for(let i=0;i<stageFloorGeometry.attributes.uv.count;i++)stageFloorGeometry.attributes.uv.setXY(i,stageFloorGeometry.attributes.position.getX(i)/16.74,stageFloorGeometry.attributes.position.getZ(i)/10);
 mesh(stageFloorGeometry,m.floor,scene).receiveShadow=true;

 function wall(a,b,parent,height=HEIGHT,mat=m.wall,y=height/2){
  const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
  const object=box(length,height,.17,mat,parent,(a[0]+b[0])/2,y,(a[1]+b[1])/2);object.rotation.y=-Math.atan2(dz,dx);object.userData.shadow=true;return object;
 }
 for(let i=0;i<boundary.length;i++){
  const a=boundary[i],b=boundary[(i+1)%boundary.length];
  wall(a,b,planWalls,.12,m.trim);
  if(![0,2,3,4,8].includes(i)){wall(a,b,room);wall(a,b,room,.09,m.wood,.045);wall(a,b,room,.08,m.trim,HEIGHT-.10);}
 }
 // The plan's right-hand inset is a raised platform, not a solid room projection.
 wall([16.74,3.92],[16.74,7.48],room);
 const musicStage=addMusicStage(room,planWalls,m,stageWallMap);
 // The long facade has actual openings, including the glazed arched terrace door.
 const openings=[{x:2.25,w:1.0,b:.76,t:2.62},{x:3.82,w:1.0,b:.76,t:2.62},{x:7.1,w:1.05,b:.76,t:2.62},{x:8.8,w:1.05,b:.76,t:2.62},{x:11.9,w:.92,b:.76,t:2.62},{x:14.05,w:2.7,b:.02,t:3.13,arch:true}];
 const facade=new THREE.Shape();facade.moveTo(0,0);facade.lineTo(16.74,0);facade.lineTo(16.74,HEIGHT);facade.lineTo(0,HEIGHT);facade.closePath();
 for(const o of openings){
  const hole=new THREE.Path(),left=o.x-o.w/2,right=o.x+o.w/2;
  hole.moveTo(left,o.b);hole.lineTo(left,o.arch?2.35:o.t);
  if(o.arch)hole.quadraticCurveTo(o.x,3.9,right,2.35);else hole.lineTo(right,o.t);
  hole.lineTo(right,o.b);hole.closePath();facade.holes.push(hole);
  const pane=box(o.w,.01,o.t-o.b,m.window,room,o.x,(o.t+o.b)/2,10.02);pane.rotation.x=Math.PI/2;
  box(o.w+.12,.055,.27,m.trim,room,o.x,o.b-.035,9.94);
  for(const x of [left,right])box(.055,o.arch?2.35-o.b:o.t-o.b,.07,m.dark,room,x,(o.b+(o.arch?2.35:o.t))/2,9.98).userData.shadow=true;
  box(.045,o.t-o.b-.12,.065,m.dark,room,o.x,(o.b+o.t)/2,9.96).userData.shadow=true;
  for(const y of o.arch?[.88,1.65,2.35]:[1.55,2.58])box(o.w,.035,.07,m.dark,room,o.x,y,9.97).userData.shadow=true;
  if(o.arch){
   const points=Array.from({length:25},(_,i)=>{const t=i/24;return [left+o.w*t,2.35+3.1*t*(1-t),9.97];});tube(points,.035,m.dark,room);
   for(const dx of [-.66,.66])box(.025,2.12,.055,m.dark,room,o.x+dx,1.16,9.95);
   for(const dx of [-.10,.10])rod([o.x+dx,1.0,9.89],[o.x+dx,1.16,9.89],.012,m.gold,room);
   for(const x of [left-.25,right+.25]){const curtain=mesh(pleatedPlane(.62,3.12,7,.04),m.curtain,room,x,1.56,9.72);curtain.userData.shadow=true;}
  }else{
   const blind=mesh(pleatedPlane(o.w+.08,.44,5,.006),m.curtain,room,o.x,2.48,9.84);blind.rotation.z=.01;
   tube([[left,2.27,9.84],[o.x,2.18,9.78],[right,2.27,9.84]],.014,m.piping,room);
   box(o.w,.52,.11,m.trim,room,o.x,.38,9.88);
   for(let j=0;j<10;j++)box(.026,.43,.04,m.wall,room,left+.05+j*(o.w-.1)/9,.38,9.8);
  }
 }
 const facadeGeo=new THREE.ExtrudeGeometry(facade,{depth:.16,bevelEnabled:false,curveSegments:24});mesh(facadeGeo,m.wall,room,0,0,9.99).userData.shadow=true;
 const exterior=await createExterior(textureLoader),outside=exterior.root;scene.add(outside);

 for(const c of columns){
  mesh(cylinder(.36,.36,.15,32),m.trim,planWalls,c.x,.075,c.z);
  mesh(cylinder(.29,.30,3.14,32),m.trim,room,c.x,1.64,c.z).userData.shadow=true;
  for(const [y,r,h] of [[.05,.37,.1],[.14,.34,.08],[3.13,.35,.12],[3.23,.39,.08],[3.30,.41,.06]])mesh(cylinder(r,r,h,32),m.trim,room,c.x,y,c.z);
 }
 // The photos show mirror bands and sconces only in the long-table wall recess.
 // The TV projection and the passages beside the bar are undecorated.
 const mirrors=[],mirrorFallbacks=[];let reflecting=false;
 for(const [spans,z] of [[[[.5,4.06]],3.49]]){
  const mp=[],mi=[];
  for(const [start,end] of spans)for(const y of [.94,2.65])for(let x=start;x<end-.10;x+=.23){
   const w=Math.min(.218,end-x),k=mp.length/3;
   mp.push(x-w/2,y-.14,0,x+w/2,y-.14,0,x+w/2,y+.14,0,x-w/2,y+.14,0);mi.push(k,k+1,k+2,k,k+2,k+3);
   for(const yy of [y-.145,y+.145])box(w,.006,.009,m.silver,room,x,yy,z+.10);
  }
  const mirrorGeometry=new THREE.BufferGeometry();mirrorGeometry.setAttribute('position',new THREE.Float32BufferAttribute(mp,3));mirrorGeometry.setIndex(mi);mirrorGeometry.computeVertexNormals();
  const mirror=new Reflector(mirrorGeometry,{textureWidth:512,textureHeight:256,color:0x848582,clipBias:.001,multisample:0});
  mirror.position.z=z+.108;mirror.userData.unbatched=true;mirror.userData.pathMaterial=m.mirror;room.add(mirror);mirrors.push(mirror);
  const fallback=mesh(mirrorGeometry,m.mirror,room,0,0,z+.108);fallback.userData.unbatched=true;fallback.visible=false;mirrorFallbacks.push(fallback);
  const reflect=mirror.onBeforeRender;let lastReflection=0;
  mirror.onBeforeRender=function(renderer,scene,camera){
   if(reflecting||camera.isOrthographicCamera||scene.overrideMaterial)return;
   const now=performance.now();if(scene.userData.cameraMoving&&now-lastReflection<75)return;lastReflection=now;
   reflecting=true;const states=mirrors.map(o=>o.visible);mirrors.forEach(o=>{o.visible=false;});mirror.visible=true;
   try{reflect.call(this,renderer,scene,camera);}finally{mirrors.forEach((o,i)=>{o.visible=states[i];});reflecting=false;}
  };
  for(const [start,end] of spans)for(let x=start+.55;x<end;x+=2.1){
   box(.065,.38,.065,m.gold,room,x,1.8,z+.10);box(.055,.24,.072,m.glow,room,x,1.8,z+.13);
   for(const yy of [1.58,2.02])box(.085,.04,.085,m.gold,room,x,yy,z+.1);
  }
 }
 // Venue photos put the screen on the long wall to the LEFT of the bar.
 const tv=group(room,5.8,0,3.99);tv.name='Телевизор на стене слева от бара';
 box(1.55,.88,.055,m.dark,tv,0,1.87,0);box(1.49,.82,.008,standard('#111b1d',.065,{metalness:.3}),tv,0,1.87,.033);
 box(.08,.045,.012,m.silver,tv,0,1.39,.03);
 for(const [x,z,rot] of [[7.57,.10,0],[13.2,.10,0],[16.65,2.8,Math.PI/2]]){
  const door=group(room,x,0,z,rot);box(1.05,2.25,.08,m.dark,door,0,1.125,0);box(.89,2.05,.025,m.wood,door,0,1.1,.05);rod([.31,.98,.09],[.31,1.14,.09],.013,m.gold,door);box(.43,.11,.02,standard('#769b8c'),door,0,2.42,0);
 }
 const bar=group(room,9.88,0,3.12);bar.name='Открытая барная стойка';
 box(3.24,1.02,.72,m.dark,bar,0,.51,0);box(3.42,.065,.92,m.wall,bar,0,1.055,0);
 for(let i=0;i<64;i++)box(.024,.94,.03,m.dark,bar,-1.58+i*.05,.53,.372);
 // Open steel frame: the room and coffee equipment remain visible through it.
 for(const y of [1.17,1.89,2.5])box(2.94,.027,.30,m.dark,bar,0,y,-.27);
 for(const x of [-1.46,-.51,.51,1.46])box(.025,1.36,.30,m.dark,bar,x,1.83,-.27);
 box(3.3,HEIGHT,.14,m.wall,bar,0,HEIGHT/2,-1.8);
 const backdoor=group(bar,-.72,0,-1.70);box(.86,2.26,.06,m.dark,backdoor,0,1.13,0);box(.72,2.12,.016,m.wood,backdoor,0,1.12,.04);
 box(.56,.34,.36,m.silver,bar,-.9,1.28,-.2);box(.56,.08,.4,m.dark,bar,-.9,1.10,-.17);for(const x of [-1.04,-.83])rod([x,1.28,.02],[x,1.18,.12],.012,m.silver,bar);
 const stoolSeat=cushion(),stoolBack=upholsteredShell(false);
 for(let i=0;i<4;i++){
  // Bar stools sit close to the counter, outside the guest-chair count.
  const stool=group(bar,-1.17+i*.78,0,.47,Math.PI);
  for(const dx of [-.17,.17])for(const dz of [-.17,.17])rod([dx,.02,dz],[dx*.83,.74,dz*.85],.013,m.dark,stool).userData.shadow=true;
  mesh(stoolSeat,m.barstool,stool,0,.74,0,.87,1,.85).userData.shadow=true;
  mesh(stoolBack,m.barstool,stool,0,.31,0,.88,.82,.88).userData.shadow=true;
  for(const z of [-.14,.14])rod([-.17,.28,z],[.17,.28,z],.008,m.dark,stool);
  for(const x of [-.17,.17])rod([x,.28,-.14],[x,.28,.14],.008,m.dark,stool);
 }
 box(3.28,.06,.78,m.wood,planWalls,9.88,1.05,3.12);
 // Ceiling projector. PA speakers and lighting belong on the raised platform.
 box(.045,.27,.045,m.silver,ceiling,13.2,3.24,6.55);box(.36,.13,.26,m.trim,ceiling,13.2,3.05,6.55);
 const lens=mesh(cylinder(.038,.038,.03,16),m.dark,ceiling,13.01,3.05,6.55);lens.rotation.z=Math.PI/2;

 // Coffered ceiling, continuous cove strips, vent grilles and suspended fittings.
 // Close all the rear wall recesses too: otherwise the exterior sky leaks through
 // the missing ceiling above the long-table and television projections.
 const completeCeiling=floorGeo.clone();for(let i=0;i<completeCeiling.index.count;i+=3){const a=completeCeiling.index.getX(i);completeCeiling.index.setX(i,completeCeiling.index.getX(i+1));completeCeiling.index.setX(i+1,a);}completeCeiling.computeVertexNormals();mesh(completeCeiling,m.ceiling,ceiling,0,3.455,0);
 box(16.74,.06,10,m.ceiling,ceiling,8.37,3.52,5);
 box(16.74,.12,6.5,m.ceiling,ceiling,8.37,3.51,6.75);
 box(5.2,.12,4,m.ceiling,ceiling,14.1,3.51,2);
 for(const [a,b] of [[.2,4.4],[4.6,8.6],[8.8,12.7],[12.9,16.5]]){
  const w=b-a;
  for(const z of [4.13,9.55]){box(w,.11,.20,m.trim,ceiling,(a+b)/2,3.35,z);box(w-.1,.025,.045,m.glow,ceiling,(a+b)/2,3.43,z+(z<6?.11:-.11));}
  for(const x of [a,b]){box(.16,.11,5.6,m.trim,ceiling,x,3.35,6.84);box(.04,.025,5.27,m.glow,ceiling,x+(x===a?.10:-.10),3.43,6.84);}
 }
 for(const x of [3.8,8.0,12.1,15.8]){
  box(.56,.035,.56,m.trim,ceiling,x,3.385,8.3);
  for(let i=0;i<12;i++)box(.39,.008,.012,m.wall,ceiling,x,3.36,8.09+i*.038);
  const vent=mesh(ring(.105,.014),m.trim,ceiling,x,3.37,4.62);vent.rotation.x=Math.PI/2;
 }
 const chandelierMaterials=[m.gold,m.glow];
 function ringLight(parent,x,y,z,r,phase){
  // Flat polished circular bands, not a thick wavy tube. The source photos
  // show fine scalloped luminous filaments underneath an otherwise level ring.
  const bandShape=new THREE.Shape();bandShape.absarc(0,0,r+.011,0,Math.PI*2,false);
  const hole=new THREE.Path();hole.absarc(0,0,r-.011,0,Math.PI*2,true);bandShape.holes.push(hole);
  const band=mesh(geometry('ring-band-'+r,()=>new THREE.ExtrudeGeometry(bandShape,{depth:.027,bevelEnabled:true,bevelThickness:.0015,bevelSize:.0015,bevelSegments:1,curveSegments:64})),m.gold,parent,x,y,z);band.rotation.x=Math.PI/2;
  const led=mesh(geometry('ring-led-'+r,()=>new THREE.RingGeometry(r-.009,r+.009,128)),m.glow,parent,x,y-.030,z);led.rotation.x=Math.PI/2;
  for(let k=0;k<3;k++){
   const a=k/3*Math.PI*2+phase;
   for(let strand=0;strand<4;strand++){
    const points=Array.from({length:17},(_,j)=>{const u=j/16,t=a+(u-.5)*.65;return[x+Math.cos(t)*r,y-.03-(.012+strand*.008)*Math.sin(u*Math.PI),z+Math.sin(t)*r];});
    tube(points,.0012,m.glow,parent);
   }
  }
  for(let i=0;i<3;i++){const t=i/3*Math.PI*2+.5;rod([x+Math.cos(t)*r,y+.02,z+Math.sin(t)*r],[x+Math.cos(t)*r,3.40,z+Math.sin(t)*r],.0013,m.silver,parent);}
 }
 for(const x of [2.3,6.5,10.7,14.7]){
  const g=group(lightsVisual);mesh(cylinder(.12,.12,.025,24),m.gold,g,x,3.41,6.63);
  ringLight(g,x-.22,2.91,6.56,.67,0);ringLight(g,x+.45,2.69,6.66,.44,1.2);ringLight(g,x-.24,2.54,7.05,.31,2.5);
 }
 for(const x of [2.2,5.6,8.7,12.2,15.3]){
  rod([x,3.4,9.02],[x,3.0,9.02],.009,m.dark,lightsVisual);
  mesh(cylinder(.18,.18,.68,24),m.shade,lightsVisual,x,2.68,9.02);
  for(const y of [2.34,3.02]){const rim=mesh(ring(.185,.012),m.dark,lightsVisual,x,y,9.02);rim.rotation.x=Math.PI/2;}
  for(const dx of [-.18,.18])rod([x+dx,2.34,9.02],[x+dx,3.02,9.02],.008,m.dark,lightsVisual);
 }
 for(const x of [2.5,5.65,9.7]){
  const wave=Array.from({length:21},(_,i)=>{const u=i/20;return[x-.5+u,2.95+.04*Math.sin(u*Math.PI*2),4.24];});
  tube(wave,.012,m.gold,lightsVisual);tube(wave.map(p=>[p[0],p[1]-.012,p[2]]),.007,m.glow,lightsVisual);
  rod([x,3.4,4.24],[x,3.0,4.24],.006,m.gold,lightsVisual);
 }

 const seating=group(scene),guestSeating=group(scene),guestShadows=group(scene),guestCandles=group(scene),chairObstacles=[];let chairCount=0;
 const chairGeo=upholsteredShell(),seatGeo=cushion();
 function chair(parent,x,z,rotation=0,worldObstacle=true){
  chairCount++;
  const g=group(parent,x,0,z,rotation);
  const seat=mesh(seatGeo,m.chair,g,0,.44,0);seat.userData.shadow=true;
  const back=mesh(chairGeo,m.chair,g);back.userData.shadow=true;
  for(const dx of [-1,1])for(const dz of [-1,1])rod([dx*.225,.02,dz*.215],[dx*.19,.43,dz*.175],.014,m.dark,g).userData.shadow=true;
  tube(shellSeam(),.0025,m.piping,g);
  const seatSeam=[];for(let i=0;i<64;i++){const a=i/64*Math.PI*2;const cs=Math.cos(a),sn=Math.sin(a);seatSeam.push([.235*Math.sign(cs)*Math.pow(Math.abs(cs),.45),.466,.223*Math.sign(sn)*Math.pow(Math.abs(sn),.45)]);}tube(seatSeam,.002,m.piping,g,true);
  if(worldObstacle)chairObstacles.push({kind:'circle',x,z,r:.23});
  return g;
 }
 const napkinGeo=foldedNapkin(),photoNapkinGeo=drapedNapkin();
 const glassProfile=[[0,0],[.024,0],[.029,.002],[.03,.004],[.028,.006],[.006,.009],[.003,.015],[.003,.078],[.007,.085],[.023,.099],[.036,.126],[.04,.151],[.036,.177],[.031,.193],[.0295,.193],[.0345,.177],[.0385,.151],[.0345,.127],[.021,.101],[.005,.087],[0,.085]].map(p=>new THREE.Vector2(...p));
 const glassGeo=geometry('wineglass',()=>new THREE.LatheGeometry(glassProfile,24));
 function wineglass(parent,x,y,z,scale=1){
  mesh(glassGeo,m.glass,parent,x,y,z,scale,scale,scale);
  const rim=mesh(ring(.031,.0015),m.glassRim,parent,x,y+.19*scale,z,scale,scale,scale);rim.rotation.x=Math.PI/2;
  mesh(cylinder(.0025,.0025,.075,8),m.glassRim,parent,x,y+.045*scale,z);
 }
 for(let row=0;row<2;row++)for(let i=0;i<14;i++){
  const glass=group(bar,-1.31+i*.2,1.87,-.14-row*.18);glass.rotation.x=Math.PI;wineglass(glass,0,0,0,.88);
 }
 function placeSetting(parent,x,z,angle=0,photo=false){
  const g=group(parent,x,.778,z,angle);
  mesh(cylinder(.148,.147,.004,40),photo?m.silver:m.gold,g,0,0,0);mesh(cylinder(.13,.126,.009,40),m.ceramic,g,0,.008,0);
  mesh(cylinder(.101,.105,.003,40),m.plateInner,g,0,.013,0);
  for(const r of [.111,.116,.121,.126]){const ridge=mesh(ring(r,.0009),m.ceramic,g,0,.014,0);ridge.rotation.x=Math.PI/2;}
  const rim=mesh(ring(.12,.003),m.ceramic,g,0,.014,0);rim.rotation.x=Math.PI/2;
  mesh(photo?photoNapkinGeo:napkinGeo,m.napkin,g,0,photo?0:.025,.015);
  for(const x of [-.175,.175]){
   rod([x,.015,-.08],[x,.015,.09],.004,m.silver,g);
   if(x<0)for(let i=0;i<4;i++)rod([x-.009+i*.006,.015,-.12],[x-.009+i*.006,.015,-.075],.0017,m.silver,g);
   else box(.014,.003,.085,m.silver,g,x,.016,-.075);
  }
  wineglass(g,.11,.003,-.22);wineglass(g,.20,.003,-.15,.73);
 }
 const tableClothGeo=roundCloth(.66,.765);
 chair(seating,.65,headTable.z-.43,Math.PI/2);chair(seating,.65,headTable.z+.43,Math.PI/2);

 const carnationGeo=petal('carnation'),orchidGeo=petal('orchid'),leafGeo=leafGeometry();
 function carnation(parent,x,y,z,mat=m.flowerWhite,size=1,angle=0){
  mat=floralMaterial(mat);
  const g=group(parent,x,y,z,angle);g.rotation.x=-.5;g.scale.setScalar(size);
  for(let row=0;row<4;row++)for(let k=0;k<9;k++){
   const a=k/9*Math.PI*2+row*.41,s=1-row*.16;
   const lobe=mesh(carnationGeo,mat,g,Math.sin(a)*.006,Math.cos(a)*.006,row*.008,s,s,s);
   lobe.rotation.set(.35+row*.19,0,-a);lobe.userData.shadow=true;
  }
  sphere(.012,.012,.012,mat,g,0,0,.027);
 }
 function orchid(parent,x,y,z,mat=m.flowerWhite,size=1,angle=0){
  mat=floralMaterial(mat);
  const g=group(parent,x,y,z,angle);g.rotation.x=-.08+random()*.18;g.rotation.z=(random()-.5)*.5;g.scale.setScalar(size);
  for(let k=0;k<5;k++){
   const a=k/5*Math.PI*2,s=k===1||k===4?1.12:.84;
   const lobe=mesh(orchidGeo,mat,g,0,0,0,s,s,1);lobe.rotation.z=-a;lobe.rotation.x=.12; lobe.userData.shadow=true;
  }
  const lip=mesh(orchidGeo,mat,g,0,-.006,.013,.42,.45,.62);lip.rotation.set(.7,0,Math.PI);
  sphere(.007,.009,.007,m.pollen,g,0,-.008,.026);
  sphere(.010,.006,.008,m.flowerWhite,g,0,.003,.025);
 }
 function flower(parent,x,y,z,mat=m.flowerWhite,size=1,angle=0){
  tube([[0,.02,0],[x*.3,y*.4,z*.3],[x*.8,y*.78,z*.8],[x,y,z]],.0018,m.stem,parent);
  for(let k=0;k<2;k++){const leaf=mesh(leafGeo,m.leaf,parent,x*.5,y*(.35+k*.2),z*.5);leaf.rotation.set(.2,k*2.4,k?-.65:.65);leaf.scale.setScalar(.64);}
  carnation(parent,x,y,z,mat,size,angle);
 }
 function orchidSpray(parent,x,y,z,height,spread,number,mat=m.flowerWhite){
  const g=group(parent,x,y,z),curve=[];
  for(let i=0;i<=12;i++){const u=i/12;curve.push([spread*Math.sin(u*1.6),height*u,.06*Math.sin(u*2)]);}
  tube(curve,.0026,m.stem,g);
  for(let i=0;i<number;i++){
   const u=.4+i/Math.max(1,number-1)*.55,side=i%2?1:-1;
   const bx=spread*Math.sin(u*1.6),by=height*u,bz=.06*Math.sin(u*2);
   const fx=bx+side*(.055+u*.045),fy=by+.014,fz=bz+.03;
   rod([bx,by,bz],[fx,fy,fz],.0016,m.stem,g);
   orchid(g,fx,fy,fz,i%4===0?mat:m.flowerWhite,.68+random()*.22,(random()-.5)*.5);
  }
  sphere(.014,.022,.013,m.flowerGreen,g,spread*Math.sin(1.6),height,.055);
 }
 function vase(parent,x,y,z,height=.16){
  const profile=[new THREE.Vector2(0,0),new THREE.Vector2(.035,.005),new THREE.Vector2(.034,height*.7),new THREE.Vector2(.025,height)];
  const geo=geometry('vase-'+height,()=>new THREE.LatheGeometry(profile,16));mesh(geo,m.glass,parent,x,y,z);
  const rim=mesh(ring(.025,.0015),m.glassRim,parent,x,y+height,z);rim.rotation.x=Math.PI/2;
 }
 function flowers(parent,x,y,z,reference=false){
  if(tableDesign==='photo'){photoFlowers(parent,x,y,z);return;}
  const g=group(parent,x,y,z);
  const count=3;
  for(let v=0;v<count;v++){
   const vx=(v-(count-1)/2)*.13,vz=Math.sin(v*2)*.09,h=.16+v*.035;
   vase(g,vx,0,vz,h);
   const fg=group(g,vx,0,vz);
   for(let i=0;i<3;i++){
    const a=i*2.4+v,fx=Math.sin(a)*.07,fz=Math.cos(a)*.065,fy=.30+random()*.10+v*.025;
    flower(fg,fx,fy,fz,i===0?m.flowerPink:i===1?m.flowerGreen:m.flowerWhite,.88,a);
   }
  }
 }

 const heartGeo=anthuriumPetal();
 function photoFlowers(parent,x,y,z){
  const g=group(parent,x,y,z);
  const base=mesh(cylinder(.18,.18,.005,40),m.mirror,g,0,.004,0);
  const profile=[[0,0],[.050,.005],[.062,.065],[.056,.16],[.035,.22],[.032,.235]].map(p=>new THREE.Vector2(...p));
  mesh(geometry('photo-vase',()=>new THREE.LatheGeometry(profile,24)),m.glass,g,0,.008,0);
  const rim=mesh(ring(.032,.0013),m.glassRim,g,0,.244,0);rim.rotation.x=Math.PI/2;
  for(let i=0;i<5;i++){
   const a=i*2.4,fx=Math.sin(a)*(.085+i*.012),fz=Math.cos(a)*(.08+i*.01),fy=.36+(i%3)*.065;
   flower(g,fx,fy,fz,i===1?m.flowerWhite:i===4?m.flowerGreen:m.flowerPink,1.0,a);
  }
  for(let i=0;i<3;i++){
   const a=i*2.35+.4,fx=Math.sin(a)*.16,fz=Math.cos(a)*.13,fy=.35+i*.065;
   rod([0,.02,0],[fx,fy,fz],.0018,m.stem,g);
   const bloom=group(g,fx,fy,fz,a);bloom.rotation.x=-.55;
   mesh(heartGeo,floralMaterial(i===2?m.flowerGreen:m.flowerPink),bloom);
   rod([0,0,.017],[0,.061,.047],.0028,m.pollen,bloom);
  }
  for(let i=0;i<5;i++){const a=i*2.4;const leaf=mesh(leafGeo,m.leaf,g,Math.sin(a)*.07,.19,Math.cos(a)*.06);leaf.rotation.set(.5,a,(i-2)*.22);leaf.scale.set(1.2,1.45,1.2);}
 }


 // Wedding backdrop, modelled in its own local frame: +z faces the room.
 const stage=group(decor,.16,0,headTable.z,Math.PI/2);
 const referenceDrape=group(draperyReference,.16,0,headTable.z,Math.PI/2);
 const newDrape=group(draperyNew,.16,0,headTable.z,Math.PI/2);
 const pistachioDrape=group(draperyPistachio,.16,0,headTable.z,Math.PI/2);
 mesh(pleatedPlane(4.65,2.94,48,.035),m.backdrop,stage,0,1.47,0);
 rod([-2.35,2.97,0],[2.35,2.97,0],.018,m.gold,stage);
 // Softly lit fabric: retain the detailed folds without a jagged sun-shadow
 // projected onto the adjacent pleated backdrop. GTAO supplies contact shading.
 mesh(suspendedSwag(),m.drape,referenceDrape);
 const rightFall=mesh(pleatedPlane(.40,2.96,9,.034),m.drape,referenceDrape,2.19,1.48,.045);rightFall.rotation.z=-.015;

 const head=group(stage,0,0,.89);
 box(1.86,.04,.82,m.cloth,head,0,.75,0).userData.shadow=true;mesh(rectangularCloth(1.86,.82,.765),m.cloth,head).userData.shadow=true;
 mesh(gatheredTableFront(1.86,.75),m.cloth,referenceDrape,0,.012,1.309).userData.shadow=true;
 placeSetting(head,-.43,-.08,Math.PI);placeSetting(head,.43,-.08,Math.PI);
 mesh(pooledFabric(1.14,.92),m.drape,referenceDrape,1.42,.014,1.02).userData.shadow=true;
 mesh(pooledFabric(2.1,.39),m.cloth,referenceDrape,0,.014,1.42).userData.shadow=true;
 const pedestal=group(referenceDrape,-1.80,0,.27);
 mesh(cylinder(.25,.29,.82,48),m.drape,pedestal,0,.41,0).userData.shadow=true;
 mesh(cylinder(.255,.255,.008,48),m.drape,pedestal,0,.867,0).userData.shadow=true;
 mesh(roundCloth(.25,.87),m.drape,pedestal).userData.shadow=true;
 mesh(pooledFabric(.86,.78),m.drape,pedestal,0,.01,0).userData.shadow=true;
 const stageRef=group(presidiumFlowersOriginal,.16,0,headTable.z,Math.PI/2);
 // Three source arrangements: pedestal, suspended orchid sprays and table corner.
 for(let i=0;i<5;i++)orchidSpray(stageRef,-1.83+(i%3)*.045,.84,.29+(i%2)*.06,.25+(i%3)*.10,(i-2)*.09,4,m.flowerPink);
 const upper=group(stageRef,1.11,1.92,.28);
 for(let i=0;i<6;i++){
  const g=group(upper,(i%2)*.08,0,0);g.rotation.z=(i-2.5)*.40;
  orchidSpray(g,0,0,0,.36+(i%3)*.08,(i-2.5)*.03,4,m.flowerPink);
 }
 const bouquet=group(stageRef,.65,.79,1.08);
 for(let i=0;i<4;i++){
  const branch=group(bouquet,(i-1.5)*.04,0,0);branch.rotation.z=(i-1.5)*.28;
  orchidSpray(branch,0,0,0,.20+(i%2)*.10,(i-1.5)*.07,3,m.flowerPink);
 }
 for(let i=0;i<5;i++){
  const leaf=mesh(leafGeo,m.leaf,bouquet,(i-2)*.045,.03,0);leaf.rotation.z=(i-2)*.55;leaf.rotation.y=i*.9;leaf.scale.set(.9,1.3,.9);
 }

 // The marked pearl strands and lace are specific to the original reference.
 const extras=group(referenceExtras,.16,0,headTable.z,Math.PI/2);
 for(let row=0;row<5;row++){
  const pts=[];for(let i=0;i<=36;i++){const u=i/36;pts.push([.72+u*.83,1.92-(.37+row*.12)*Math.sin(u*Math.PI),.30]);}
  tube(pts,.002,m.glassRim,extras);
  for(let i=0;i<=32;i++){const u=i/32;sphere(.008,.008,.008,m.ceramic,extras,.72+u*.83,1.92-(.37+row*.12)*Math.sin(u*Math.PI),.30);}
 }
 const laceCanvas=document.createElement('canvas');laceCanvas.width=laceCanvas.height=1024;
 const lc=laceCanvas.getContext('2d');lc.clearRect(0,0,1024,1024);lc.strokeStyle='#fff';lc.fillStyle='#fff';
 // Fine bobbin mesh and embroidered floral rosettes, with open transparent holes.
 lc.lineWidth=.7;
 for(let d=-1024;d<2048;d+=12){lc.beginPath();lc.moveTo(d,0);lc.lineTo(d+1024,1024);lc.stroke();lc.beginPath();lc.moveTo(d,0);lc.lineTo(d-1024,1024);lc.stroke();}
 for(let y=-20;y<1120;y+=170)for(let x=-40;x<1120;x+=170){
  const xx=x+(Math.round(y/170)%2)*85;
  for(let k=0;k<7;k++){
   const a=k/7*Math.PI*2;
   for(let row=0;row<3;row++){
    lc.lineWidth=3-row*.65;lc.beginPath();lc.ellipse(xx+Math.cos(a)*27,y+Math.sin(a)*27,26-row*4,12-row*2,a,0,Math.PI*2);lc.stroke();
   }
  }
  lc.beginPath();lc.arc(xx,y,10,0,Math.PI*2);lc.fill();lc.lineWidth=2.2;
  lc.beginPath();lc.moveTo(xx+20,y+28);lc.bezierCurveTo(xx+90,y+25,xx+10,y+110,xx+85,y+125);lc.stroke();
  for(let k=0;k<5;k++){lc.beginPath();lc.ellipse(xx+46+k*4,y+58+k*13,12,4,k%2?.6:-.6,0,Math.PI*2);lc.stroke();}
 }
 const laceMap=new THREE.CanvasTexture(laceCanvas);laceMap.wrapS=laceMap.wrapT=THREE.RepeatWrapping;laceMap.repeat.set(1,1.7);laceMap.anisotropy=8;m.lace.map=laceMap;m.lace.alphaTest=.12;
 const lace=mesh(pleatedPlane(.66,.94,7,.025),m.lace,extras,.65,.46,1.347);lace.userData.shadow=true;
 mesh(pooledFabric(.75,.42),m.lace,extras,.65,.018,1.47);

 // Second presidium: the user's new chocolate curtain collage.
 for(const side of [-1,1]){
  mesh(partedCurtain(side),m.drape,newDrape);
  for(let i=0;i<4;i++)mesh(curtainSwag(side,i),m.drape,newDrape);
  mesh(pooledFabric(1.65,.74),m.drape,newDrape,side*1.53,.012,.26).userData.shadow=true;
  mesh(tableSwag(),m.cloth,newDrape,side*.465,.005,1.325).userData.shadow=true;
 }
 mesh(pooledFabric(2.24,.62),m.cloth,newDrape,0,.012,1.41).userData.shadow=true;
 const newFloral=group(presidiumFlowersNew,.16,0,headTable.z,Math.PI/2);
 for(const side of [-1,1]){
  const floorBouquet=group(newFloral,side*1.12,.06,1.34);
  for(let i=0;i<10;i++){
   const a=i*2.4,r=.09+random()*.18,x=Math.sin(a)*r,z=Math.cos(a)*r,y=.14+random()*.27;
   flower(floorBouquet,x,y,z,i%3===0?m.flowerPink:m.flowerWhite,.95+random()*.25,a);
  }
  for(let i=0;i<3;i++)orchidSpray(floorBouquet,side*.12,.02,-.06,.34+i*.12,side*(.05+i*.06),3,m.flowerPink);
  const tableBouquet=group(newFloral,side*.68,.79,.98);
  for(let i=0;i<4;i++)flower(tableBouquet,Math.sin(i*2.4)*.10,.10+i*.025,Math.cos(i*2.4)*.08,i%2?m.flowerPink:m.flowerWhite,.85,i);
 }
 const wax=standard('#f3e4cc',.82),flame=new THREE.MeshBasicMaterial({color:'#ffd49a'});
 for(const [x,z,h] of [[-1.48,1.42,.24],[-1.30,1.66,.18],[-.97,1.70,.28],[1.25,1.63,.22],[1.48,1.39,.30],[-.69,1.13,.13],[.58,1.12,.17]]){
  const baseY=Math.abs(x)<.8?.78:.02;
  mesh(cylinder(.025,.025,h,12),wax,newDrape,x,baseY+h/2,z);
  vase(newDrape,x,baseY,z,h+.04);sphere(.006,.014,.006,flame,newDrape,x,baseY+h+.014,z);
 }
 for(const [x,z,r] of [[-1.48,1.15,.11],[-1.29,1.18,.075],[1.46,1.16,.10]])mesh(geometry('mirror-ball',()=>new THREE.SphereGeometry(1,24,16)),m.silver,newDrape,x,r+.014,z,r,r,r);

 // Third composition follows the milk/pistachio photograph: full-width gathered
 // upper fabric, a high central gather, two middle gathers and low outer falls.
 for(const side of [-1,1]){
  mesh(gatheredFestoon(side),m.drape,pistachioDrape);
  mesh(gatheredFestoon(side,true),m.drape,pistachioDrape);
  const tail=mesh(pleatedPlane(.30,1.12,5,.028),m.drape,pistachioDrape,side*2.20,.56,.17);tail.rotation.z=side*.025;
  mesh(pooledFabric(.62,.46),m.drape,pistachioDrape,side*2.16,.012,.24);
  for(const [x,y] of [[1.57,1.78],[2.27,1.07]])mesh(fabricGather(),m.drape,pistachioDrape,side*x,y,.25);
 }
 mesh(fabricGather(),m.drape,pistachioDrape,0,2.87,.25,1.3,1.3,1.3);
 mesh(gatheredTableFront(1.86,.75),m.cloth,pistachioDrape,0,.012,1.309).userData.shadow=true;
 mesh(tableSwag(1.86),m.cloth,pistachioDrape,0,.005,1.34).userData.shadow=true;
 mesh(pooledFabric(2.08,.45),m.cloth,pistachioDrape,0,.012,1.43).userData.shadow=true;
 // Small reflective bases stay beneath the transparent table vases.
 for(const side of [-1,1]){const base=mesh(cylinder(.13,.13,.005,32),m.mirror,pistachioDrape,side*.67,.783,1.02);}

 // Subtle contact shadows keep furniture grounded without moving lights.
 const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;const sc=shadowCanvas.getContext('2d');
 const gradient=sc.createRadialGradient(32,32,3,32,32,32);gradient.addColorStop(0,'rgba(18,14,9,.15)');gradient.addColorStop(.6,'rgba(18,14,9,.06)');gradient.addColorStop(1,'rgba(18,14,9,0)');sc.fillStyle=gradient;sc.fillRect(0,0,64,64);
 const shadowMap=new THREE.CanvasTexture(shadowCanvas),shadowMaterial=new THREE.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
 const shadows=group(scene);
 for(const t of [{x:headTable.x,z:headTable.z}]){const s=mesh(geometry('shadowplane',()=>new THREE.PlaneGeometry(1,1)),shadowMaterial,shadows,t.x,.004,t.z,2.05,2.05,1);s.rotation.x=-Math.PI/2;}
 for(const c of chairObstacles){const s=mesh(geometry('shadowplane',()=>new THREE.PlaneGeometry(1,1)),shadowMaterial,shadows,c.x,.006,c.z,.83,.83,1);s.rotation.x=-Math.PI/2;}

 // Rebuild only guest furniture after add/remove/chair edits. Dragging uses
 // instance translations, keeping the low draw-call count of the original hall.
 const candleWax=standard('#f6ebd6',.78),candleFlame=new THREE.MeshBasicMaterial({color:'#ffe0a0'}),candleCore=new THREE.MeshBasicMaterial({color:'#fff8dd'});
 function tableCandles(parent,x,z){
  const g=group(parent,x,.779,z);
  // Clear open cylinders and ivory pillar candles, as in the new phone photo.
  for(const [dx,dz,h,r] of [[-.14,-.12,.28,.043],[.02,-.13,.36,.046],[.17,-.05,.24,.043],[-.20,.04,.17,.040],[-.04,.04,.22,.045],[.12,.13,.13,.039],[-.13,.18,.11,.036],[.01,.22,.16,.040]]){
   const profile=[new THREE.Vector2(0,0),new THREE.Vector2(r,.003),new THREE.Vector2(r,h),new THREE.Vector2(r-.0015,h),new THREE.Vector2(r-.0015,.005)];
   mesh(geometry('candle-cylinder-'+h,()=>new THREE.LatheGeometry(profile,16)),m.glass,g,dx,0,dz);
   const rim=mesh(ring(r,.0014),m.glassRim,g,dx,h,dz);rim.rotation.x=Math.PI/2;
   const waxHeight=h*.61;
   mesh(cylinder(r*.72,r*.72,waxHeight,16),candleWax,g,dx,waxHeight/2+.006,dz);
   rod([dx,waxHeight+.007,dz],[dx,waxHeight+.017,dz],.0012,m.dark,g);
   sphere(.006,.016,.006,candleFlame,g,dx,waxHeight+.028,dz);sphere(.003,.009,.003,candleCore,g,dx,waxHeight+.025,dz);
  }
 }
 function refreshChairObstacles(){
  chairObstacles.splice(0,chairObstacles.length,...guestTables.flatMap(t=>t.chairs.map(c=>({kind:'circle',...c,r:.23}))),{kind:'circle',x:.65,z:headTable.z-.43,r:.23},{kind:'circle',x:.65,z:headTable.z+.43,r:.23});
  chairCount=seatCount();
 }
 function rebuildTables(){
  const previousSeed=seed;seed=1753;flowerSlot=0;
  for(const root of [guestSeating,flowersRef,guestCandles,guestShadows]){root.traverse(o=>{if(o.isInstancedMesh)o.dispose();});root.clear();}
  for(const t of guestTables){
   const root=group(guestSeating,t.x,0,t.z);root.userData.tableId=t.id;
   if(t.type==='long'){
    box(t.width,.04,t.depth,m.cloth,root,0,.75,0).userData.shadow=true;
    mesh(geometry('long-cloth',()=>rectangularCloth(2.64,.82,.765)),m.cloth,root).userData.shadow=true;
   }else{
    mesh(cylinder(.14,.3,.70),m.dark,root,0,.35,0);mesh(cylinder(.67,.67,.04,48),m.cloth,root,0,.75,0).userData.shadow=true;
    mesh(tableClothGeo,m.cloth,root).userData.shadow=true;
   }
   for(const c of t.chairs){
    const angle=t.type==='long'?(c.z<t.z?Math.PI:0):Math.atan2(c.x-t.x,c.z-t.z);
    chair(root,c.x-t.x,c.z-t.z,angle+Math.PI,false);
    if(t.type==='long')placeSetting(root,c.x-t.x,c.z<t.z?-.19:.19,c.z<t.z?Math.PI:0,tableDesign==='photo');
    else placeSetting(root,Math.sin(angle)*.44,Math.cos(angle)*.44,tableDesign==='photo'?angle:-angle,tableDesign==='photo');
   }
   const floral=group(flowersRef);floral.userData.tableId=t.id;
   if(t.type==='long')for(const x of [-.8,.75])flowers(floral,t.x+x,.779,t.z,true);
   else flowers(floral,t.x,.779,t.z,true);
   const candles=group(guestCandles);candles.userData.tableId=t.id;
   if(t.type==='long')for(const x of [-.70,.70])tableCandles(candles,t.x+x,t.z);else tableCandles(candles,t.x,t.z);
   const shadowRoot=group(guestShadows);shadowRoot.userData.tableId=t.id;
   const contact=(x,z,w,d)=>{const o=mesh(geometry('shadowplane',()=>new THREE.PlaneGeometry(1,1)),shadowMaterial,shadowRoot,x,.004,z,w,d,1);o.rotation.x=-Math.PI/2;};
   contact(t.x,t.z,t.type==='long'?3.1:2.05,t.type==='long'?1.35:2.05);
   for(const c of t.chairs)contact(c.x,c.z,.83,.83);
  }
  for(const root of [guestSeating,flowersRef,guestCandles,guestShadows])instanceStatic(root);
  refreshChairObstacles();seed=previousSeed;renderer.shadowMap.needsUpdate=true;contactShadows?.invalidate();
 }
 rebuildTables();
 const selection=mesh(new THREE.RingGeometry(.75,.80,48),new THREE.MeshBasicMaterial({color:'#c17743',side:THREE.DoubleSide,transparent:true,opacity:.9,depthTest:false}),scene,0,.795,0);selection.rotation.x=-Math.PI/2;selection.renderOrder=5;selection.visible=false;let selectedTable=null;
 function selectTable(id){selectedTable=id;const t=guestTables.find(t=>t.id===id);selection.visible=plan&&!!t;if(t){selection.position.set(t.x,.795,t.z);selection.scale.set(t.type==='long'?t.width/1.45:1,t.type==='long'?t.depth/1.45:1,1);}}
 function translateTable(id,dx,dz){
  const matrix=new THREE.Matrix4();
  for(const root of [guestSeating,flowersRef,guestCandles,guestShadows])root.traverse(o=>{
   if(!o.isInstancedMesh)return;let changed=false;
   o.userData.tableIds?.forEach((tableId,i)=>{if(tableId!==id)return;o.getMatrixAt(i,matrix);matrix.elements[12]+=dx;matrix.elements[14]+=dz;o.setMatrixAt(i,matrix);changed=true;});
   if(changed){o.instanceMatrix.needsUpdate=true;o.computeBoundingSphere();}
  });
  refreshChairObstacles();selectTable(selectedTable);renderer.shadowMap.needsUpdate=true;contactShadows?.invalidate();
 }

 const ambient=new THREE.HemisphereLight('#edf0f3','#63594b',.24);scene.add(ambient);
 // Diffuse daylight enters at each real opening, below the Roman blinds.
 const windowLights=openings.map(o=>{
  const top=o.arch?o.t:2.20,bottom=o.b+.06;
  const light=new THREE.SpotLight('#f0f4ff',12,16,1.45,1,2);
  light.position.set(o.x,(top+bottom)/2,9.79);light.target.position.set(o.x,.75,4.8);
  light.userData.strength=Math.min(2.5,(o.w-.08)*(top-bottom)/1.5);
  scene.add(light,light.target);return light;
 });
 // A restrained sun supplements the soft window light with directional shadows.
 const sun=new THREE.DirectionalLight('#fff8eb',.5);sun.position.set(8,3.9,15.5);sun.target.position.set(6.5,0,4.2);sun.castShadow=true;
 sun.shadow.mapSize.set(4096,4096);Object.assign(sun.shadow.camera,{left:-11,right:11,top:8,bottom:-8,near:.5,far:35});sun.shadow.bias=-.00012;sun.shadow.normalBias=.012;sun.shadow.radius=2;scene.add(sun,sun.target);
 // Wide downward cones avoid the old point-light ceiling hotspots.
 const chandelierLights=[2.3,6.5,10.7,14.7].map(x=>{
  const light=new THREE.SpotLight('#ffe5c8',6,11,1.42,.85,2);
  light.position.set(x,2.72,6.67);light.target.position.set(x,0,6.67);scene.add(light,light.target);return light;
 });
 const pendantLights=[2.2,5.6,8.7,12.2,15.3].map(x=>{
  const light=new THREE.PointLight('#ffe8d0',1.2,4,2);light.position.set(x,2.63,9.02);scene.add(light);return light;
 });

 mergeStatic(lightsVisual);
 for(const root of [room,ceiling,lightsVisual,seating,decor,flowersSubtle,referenceExtras,draperyReference,draperyNew,draperyPistachio,presidiumFlowersOriginal,presidiumFlowersNew,planWalls,outside,shadows])instanceStatic(root);
 let style='reference',plan=false,decorVisible=true,lightingMode='day',lightingInitialized=false;
 const reflectionEnvironments=new Map();
 function updateEnvironment(value){
  if(!irradiance||plan)return;
  const key=value+'|'+style+'|'+presidium+'|'+tableDecor+'|'+tableDesign;
  if(!reflectionEnvironments.has(key)){
   const target=new THREE.WebGLCubeRenderTarget(256,{type:THREE.HalfFloatType});
   const probe=new THREE.CubeCamera(.08,45,target);probe.position.set(8.1,1.7,6.7);
   const visibility=mirrors.map(o=>o.visible);mirrors.forEach(o=>o.visible=false);
   const oldEnvironment=scene.environment;scene.environment=env.texture;
   try{
    probe.update(renderer,scene);
    const generator=new THREE.PMREMGenerator(renderer);reflectionEnvironments.set(key,generator.fromCubemap(target.texture));generator.dispose();
   }finally{target.dispose();scene.environment=oldEnvironment;mirrors.forEach((o,i)=>o.visible=visibility[i]);}
  }
  scene.environment=reflectionEnvironments.get(key).texture;
  if(reflectionEnvironments.size>6){const oldest=reflectionEnvironments.keys().next().value;if(oldest!==key){reflectionEnvironments.get(oldest).dispose();reflectionEnvironments.delete(oldest);}}
 }
 function updateVisibility(){
  selectTable(selectedTable);ceiling.visible=!plan;lightsVisual.visible=!plan;room.visible=!plan;outside.visible=!plan;planWalls.visible=plan;contactShadows?.setPlan(plan);
  decor.visible=decorVisible;flowersRef.visible=decorVisible&&tableDecor==='flowers';guestCandles.visible=decorVisible&&tableDecor==='candles';flowersSubtle.visible=false;referenceExtras.visible=decorVisible&&presidium==='original';
  draperyReference.visible=presidiumFlowersOriginal.visible=decorVisible&&presidium==='original';
  draperyNew.visible=decorVisible&&presidium==='new';draperyPistachio.visible=decorVisible&&presidium==='pistachio';presidiumFlowersNew.visible=decorVisible&&presidium!=='original';
 }
 function setStyle(value){
  if(!palettes[value])return;style=value;const p=palettes[value];
  for(const key of ['cloth','napkin','backdrop','drape'])m[key].color.set(p[key]);m.flowerPink.color.set(p.pink);m.flowerGreen.color.set(p.green);
  updateFlowers();updateVisibility();renderer.shadowMap.needsUpdate=true;
  if(lightingInitialized)updateEnvironment(lightingMode);
 }
 function setLighting(value){
  const settings={
   day:{sun:.50,windows:12,lamps:6,pendants:1.2,ambient:.36,environment:.30,exposure:1.02},
   windows:{sun:.65,windows:16,lamps:0,pendants:0,ambient:.30,environment:.28,exposure:1.02},
   lamps:{sun:0,windows:0,lamps:18,pendants:3.2,ambient:.38,environment:.12,exposure:1.02},
   evening:{sun:0,windows:.7,lamps:14,pendants:2.6,ambient:.32,environment:.14,exposure:1.02},
  };
  if(!settings[value])return;lightingMode=value;const p=settings[value],night=value==='lamps'||value==='evening';scene.userData.evening=night;
  // Keep light counts fixed: switching modes must not rebuild all GPU shaders.
  ambient.intensity=irradiance ? .035 : p.ambient;ambient.color.set(night?'#ffe5c9':'#edf0f3');sun.intensity=irradiance?p.sun*3:p.sun;
  irradiance?.setLighting(value);contactShadows?.setLighting(value);
  windowLights.forEach(light=>{light.intensity=p.windows*light.userData.strength*(irradiance?.3:1);});
  chandelierLights.forEach(light=>{light.intensity=p.lamps*(irradiance?.35:1);});
  pendantLights.forEach(light=>{light.intensity=p.pendants;});
  m.window.color.set(night?'#667d89':'#dbe8e7');exterior.setLighting(value);scene.background.set(night?'#283340':'#b4d9e2');
  m.glow.color.set(value==='windows'?'#89857c':night?'#ffe0b9':'#fff0d5');if(value!=='windows')m.glow.color.multiplyScalar(3.2);m.shade.emissiveIntensity=value==='windows'?0:night?.8:.48;scene.environmentIntensity=irradiance ? .40 : p.environment;
  renderer.toneMappingExposure=p.exposure;renderer.shadowMap.needsUpdate=true;
  lightingInitialized=true;updateEnvironment(value);
 }
 function setQuality(value){
  const high=value==='high',low=value==='low';
  renderer.transmissionResolutionScale=high?.6:.3;
  const transmission=high?.96:0;
  if(m.glass.transmission!==transmission){m.glass.transmission=transmission;m.glass.opacity=high?1:.35;m.glass.needsUpdate=true;}
  mirrors.forEach(mirror=>{mirror.visible=!low;mirror.getRenderTarget().setSize(high?1024:512,high?512:256);});
  mirrorFallbacks.forEach(mirror=>{mirror.visible=low;});
  const size=high?4096:2048;
  if(sun.shadow.mapSize.x!==size){sun.shadow.mapSize.set(size,size);sun.shadow.map?.dispose();sun.shadow.map=null;renderer.shadowMap.needsUpdate=true;}
 }
 let irradiance=null;
 try{
  irradiance=await createIrradiance();
  scene.traverse(o=>{if(o.isMesh)for(const material of Array.isArray(o.material)?o.material:[o.material])irradiance.attach(material);});
  // Three broad window highlights and four ring sources supplement the baked
  // diffuse field; the remaining local sources require no per-pixel light loop.
  for(const light of [...windowLights.filter((_,i)=>[1,3,4].includes(i)),...pendantLights]){light.removeFromParent();light.target?.removeFromParent();}
 }catch(error){console.warn('Используется обычное освещение:',error.message);}
 contactShadows=createContactShadows(renderer,scene,()=>[seating,guestSeating,decor,draperyReference,draperyNew,draperyPistachio]);
 scene.userData.updateContactShadows=()=>contactShadows.update();
 setStyle('reference');
 return {scene,chairObstacles,materials:m,setStyle,setLighting,setQuality,rebuildTables,translateTable,selectTable,
  setPresidium(value){if(!['original','new','pistachio'].includes(value))return;presidium=value;updateVisibility();contactShadows?.invalidate();renderer.shadowMap.needsUpdate=true;if(lightingInitialized)updateEnvironment(lightingMode);},
  setFlowers(value){if(!['current','dopamine'].includes(value))return;flowerMode=value;updateFlowers();},
  setTableDecor(value){if(!['flowers','candles'].includes(value))return;tableDecor=value;updateVisibility();renderer.shadowMap.needsUpdate=true;if(lightingInitialized)updateEnvironment(lightingMode);},
  setTableDesign(value){if(!['original','photo'].includes(value)||value===tableDesign)return;tableDesign=value;rebuildTables();updateVisibility();if(lightingInitialized)updateEnvironment(lightingMode);},
  applyPhotoPreset(){presidium='pistachio';tableDecor='flowers';flowerMode='current';if(tableDesign!=='photo'){tableDesign='photo';rebuildTables();}contactShadows?.invalidate();setStyle('milk');},
  flowerColors:()=>flowerMaterials.map(({material})=>'#'+material.color.getHexString()),
  lightSources:()=>({mode:lightingMode,windows:sun.intensity,windowAreas:windowLights.map(light=>light.intensity),lamps:chandelierLights.map(light=>light.intensity),pendants:pendantLights.map(light=>light.intensity),exposure:renderer.toneMappingExposure,mirrorGroups:mirrors.length,exterior:exterior.info(),contactShadows:contactShadows.info(),irradiance:irradiance?.info()||null}),
  setPlan(value){plan=value;updateVisibility();if(!plan&&lightingInitialized)updateEnvironment(lightingMode);},setDecor(value){decorVisible=value;updateVisibility();contactShadows?.invalidate();},
  stats(){let instances=0,drawObjects=0,modelTriangles=0,flowerTriangles=0;const floral=new Set([m.flowerWhite,m.flowerPink,m.flowerGreen,m.pollen,m.leaf,m.stem,...flowerMaterials.map(f=>f.material)]);scene.traverse(o=>{if(o.isInstancedMesh){instances+=o.count;drawObjects++;}if(o.isMesh){const n=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);modelTriangles+=n;if(floral.has(o.material))flowerTriangles+=n;}});return{seats:seatCount(),guestChairs:chairCount,instances,drawObjects,modelTriangles,flowerTriangles,style,presidium,flowerMode,tableDecor,tableDesign,bar:{x:9.88,z:3.12},television:{x:5.8,z:3.99},musicStage};},
  geometrySignature(){scene.updateMatrixWorld(true);let hash=2166136261;const push=value=>{const s=String(value);for(let i=0;i<s.length;i++)hash=Math.imul(hash^s.charCodeAt(i),16777619);};scene.traverseVisible(o=>{if(!o.isMesh)return;push(o.geometry.id);push(o.count||1);for(const v of o.matrixWorld.elements)push(v.toFixed(5));if(o.isInstancedMesh)for(const v of o.instanceMatrix.array)push(v.toFixed(5));});return(hash>>>0).toString(16);},
  dispose(){env.dispose();irradiance?.dispose();contactShadows?.dispose();reflectionEnvironments.forEach(t=>t.dispose());},
 };
}

export {THREE};
