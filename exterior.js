import * as THREE from './vendor/three.module.min.js';

// Near objects are genuine geometry, so the view has parallax when walking.
// The distant hills come from the venue's own exterior photograph. Dimensions
// of the courtyard are estimates; this is not a surveyed exterior model.
export async function createExterior(loader){
 const root=new THREE.Group();root.name='Терраса, двор и дальний вид';
 const daylight={value:1};
 const basic=(color,extra={})=>new THREE.MeshBasicMaterial({color,...extra});
 const materials=[];
 function mat(color,extra={}){const m=basic(color,extra);materials.push([m,m.color.clone()]);return m;}
 const metal=mat('#333b3c'),stone=mat('#c8c1ad'),path=mat('#b5b2a4'),lawn=mat('#718449'),wall=mat('#d6d1bd'),roof=mat('#788c90');
 const grassMap=await loader.loadAsync('./assets/courtyard-grass.webp');grassMap.colorSpace=THREE.SRGBColorSpace;grassMap.wrapS=grassMap.wrapT=THREE.RepeatWrapping;grassMap.repeat.set(18,14);grassMap.anisotropy=4;
 lawn.map=grassMap;lawn.color.set('#c1c6a7');materials.find(([m])=>m===lawn)[1].copy(lawn.color);
 const unitBox=new THREE.BoxGeometry(1,1,1);
 function box(w,h,d,m,x,y,z){const o=new THREE.Mesh(unitBox,m);o.position.set(x,y,z);o.scale.set(w,h,d);root.add(o);return o;}
 function line(points,r=.012){const c=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));const o=new THREE.Mesh(new THREE.TubeGeometry(c,24,r,4,false),metal);root.add(o);}
 const distantMap=await loader.loadAsync('./assets/venue-hills.webp');distantMap.colorSpace=THREE.SRGBColorSpace;
 const distant=mat('#e5e5e1',{map:distantMap});
 distant.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
 float grey=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=mix(vec3(grey),diffuseColor.rgb,.72)*1.7;`);};
 distant.side=THREE.BackSide;distantMap.wrapS=THREE.RepeatWrapping;distantMap.repeat.x=3;
 const panorama=new THREE.Mesh(new THREE.CylinderGeometry(32,32,36,96,1,true),distant);panorama.position.set(8,10,8);root.add(panorama);
 // The venue photo shows a planted courtyard, pale paths and dark ironwork.
 box(90,.08,70,lawn,8,-1.85,35);box(50,.04,2.2,path,8,-1.79,15.3);
 box(3.2,.16,1.7,stone,14.05,-.10,10.9);
 for(const z of [11.64]){
  box(3.1,.035,.035,metal,14.05,.98,z);box(3.1,.025,.025,metal,14.05,.17,z);
  for(let i=0;i<23;i++)box(.014,.81,.014,metal,12.55+i*.136,.56,z);
  for(let i=0;i<4;i++){
   const cx=12.87+i*.78;
   for(const sign of [-1,1])line(Array.from({length:25},(_,k)=>{const t=k/24*Math.PI*2;return[cx+sign*(.02+.16*(1-Math.cos(t))),.57+.22*Math.sin(t),z];}),.009);
  }
 }
 // Low boundary and shrubs are several metres beyond the glazing, never a
 // solid screen in front of it. Thin fence members expose the distant view.
 box(38,.07,.08,metal,8,-.40,20.3);box(38,.025,.04,metal,8,-1.45,20.3);
 for(let i=0;i<155;i++)box(.012,1.07,.014,metal,-11+i*.25,-.94,20.3);
 const foliageMap=await loader.loadAsync('./assets/courtyard-foliage.webp');foliageMap.colorSpace=THREE.SRGBColorSpace;
 const foliage=mat('#d3d3c2',{map:foliageMap,transparent:false,alphaTest:.42,side:THREE.DoubleSide});
 for(let i=0;i<22;i++){
  const x=-9+i*1.65,z=17.8+(i%3)*2.6,h=1.8+(i%4)*.18;
  for(const angle of [0,Math.PI/3,-Math.PI/3]){const o=new THREE.Mesh(new THREE.PlaneGeometry(h*.42,h),foliage);o.position.set(x,-1.78+h/2,z);o.rotation.y=angle;root.add(o);}
  box(.55,.025,.55,stone,x,-1.78,z);
 }
 // Irregular stepping stones around a planted oval, as in the grounds photo.
 for(let i=0;i<45;i++){const a=i/45*Math.PI*2;const p=box(.62,.03,.28,stone,6+7*Math.cos(a),-1.78,23+4.5*Math.sin(a));p.rotation.y=-a;}
 return {root,setLighting(mode){const night=mode==='lamps'||mode==='evening';daylight.value=night?.075:1;for(const [m,c] of materials)m.color.copy(c).multiplyScalar(daylight.value);},info:()=>({nearGeometry:true,distantPhoto:'venue-hills.webp',estimatedCourtyard:true})};
}
