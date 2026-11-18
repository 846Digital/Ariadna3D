import * as THREE from './vendor/three.module.min.js';
import {GLTFLoader,KTX2Loader} from './vendor/assets.module.js';

export async function loadAuthored(renderer){
 const compressed=new KTX2Loader().setTranscoderPath('./vendor/').setWorkerLimit(2).detectSupport(renderer);
 const loader=new GLTFLoader().setKTX2Loader(compressed),geometries=new Map();
 for(const file of ['furniture','drapery']){
  const {scene}=await loader.loadAsync(`./assets/${file}.glb?v=10`);scene.updateMatrixWorld(true);
  scene.traverse(o=>{if(o.isMesh){const g=o.geometry.clone();g.applyMatrix4(o.matrixWorld);if(o.name.endsWith('-cloth'))g.translate(0,-.009,0);geometries.set(o.name,g);}});
 }
 return {geometry(name){const g=geometries.get(name);if(!g)throw new Error('Missing authored mesh: '+name);return g;},geometryInfo(){return Object.fromEntries([...geometries].map(([name,g])=>{g.computeBoundingBox();return[name,{triangles:(g.index?.count||g.attributes.position.count)/3,min:g.boundingBox.min.toArray(),max:g.boundingBox.max.toArray()}];}));},loader,compressed};
}

export async function installBakedShell(authored,lighting,roots,materials,floor,stageWallMap){
 const {scene:shell}=await authored.loader.loadAsync('./assets/hall-shell.glb?v=10');
 const targets={room:roots.room,ceiling:roots.ceiling,floor:roots.floor},materialCache=new Map(),prepared=[];
 shell.updateMatrixWorld(true);
 shell.traverse(o=>{
  if(!o.isMesh)return;let ancestor=o;while(ancestor&&!ancestor.name.startsWith('baked-'))ancestor=ancestor.parent;
  const tag=ancestor?.name.replace('baked-',''),target=targets[tag];if(!target)throw new Error('Unknown lightmap group: '+o.name);
  if(!o.geometry.attributes.uv1)throw new Error('Missing lightmap UVs: '+o.name);
  const convert=source=>{
   const key=tag+'|'+source.name;if(materialCache.has(key))return materialCache.get(key);
   const original=materials[source.name];if(original?.isMeshBasicMaterial)return original;
   const m=original?original.clone():source.clone();
   if(source.name==='custom-5')m.map=stageWallMap;
   if(m.isMeshStandardMaterial){m.lightMap=lighting.maps[tag][0];m.lightMapIntensity=1;m.userData.venueLampMap=lighting.maps[tag][1];}
   materialCache.set(key,m);return m;
  };
  const g=o.geometry.clone();g.applyMatrix4(o.matrixWorld);const mesh=new THREE.Mesh(g,Array.isArray(o.material)?o.material.map(convert):convert(o.material));
  mesh.name=o.name;mesh.castShadow=tag!=='floor';mesh.receiveShadow=true;mesh.userData.bakedShell=true;prepared.push({mesh,target});
 });
 if(!prepared.length)throw new Error('Empty architectural model');
 // Validate every mesh before replacing the old shell. Glass panes and the
 // two planar mirrors have independent render passes and remain in place.
 for(const root of [roots.room,roots.ceiling]){
  const remove=[];root.traverse(o=>{if(o.isMesh&&!o.userData.unbatched&&!o.material.transparent)remove.push(o);});remove.forEach(o=>o.removeFromParent());
 }
 floor.visible=false;prepared.forEach(({mesh,target})=>target.add(mesh));
 return materialCache;
}
