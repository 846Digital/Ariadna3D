import * as THREE from './vendor/three.module.min.js';

// Cycles traces the fixed room offline. Its two lightmap bases are independent
// of movable furniture. Directional probes light furniture at its current pose.
const NX=18,NY=6,NZ=12,VALUES=NX*4*NY*NZ*4;
const declarations=`
uniform highp sampler3D venueLight;
uniform sampler2D venueLampMap;
uniform vec2 venueMix;
uniform float venueBounceStrength;
varying vec3 vVenueWorld;
vec3 venueIrradiance(vec3 normalWorld){
 vec3 p=clamp((vVenueWorld-vec3(.06))/(vec3(16.68,3.39,9.94)-vec3(.06)),0.,1.);
 p=p*vec3(17./18.,5./6.,11./12.)+vec3(.5/18.,.5/6.,.5/12.);
 p.x*=.25;vec3 c0=texture(venueLight,p).rgb;
 p.x+=.25;vec3 cx=texture(venueLight,p).rgb;
 p.x+=.25;vec3 cy=texture(venueLight,p).rgb;
 p.x+=.25;vec3 cz=texture(venueLight,p).rgb;
 return max(c0+cx*normalWorld.x+cy*normalWorld.y+cz*normalWorld.z,c0*.10)*venueBounceStrength;
}`;

export async function createIrradiance(renderer,authored){
 const response=await fetch('./assets/hall-irradiance.bin?v=10');if(!response.ok)throw new Error('Не загрузилось освещение зала');
 const buffer=await response.arrayBuffer();if(buffer.byteLength!==VALUES*4)throw new Error('Неполная карта освещения');
 const bases=[0,1].map(i=>Float32Array.from(new Uint16Array(buffer,i*VALUES*2,VALUES),THREE.DataUtils.fromHalfFloat));
 const attached=new WeakSet(),cache=new Map(),volumeUniform={value:null},strengthUniform={value:1},mixUniform={value:new THREE.Vector2(1,.58)};
 const maps={};
 await Promise.all(['room','ceiling','floor'].map(async tag=>{
  const pair=await Promise.all(['day','lamps'].map(mode=>authored.compressed.loadAsync(`./assets/light-${tag}-${mode}.ktx2?v=10`)));
  pair.forEach(t=>{t.channel=1;t.colorSpace=THREE.NoColorSpace;t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());});maps[tag]=pair;
 }));
 const modes={day:[1,.58],windows:[1.15,0],lamps:[0,1.2],evening:[.035,1]};let weights=modes.day;
 function setLighting(mode){
  mode=modes[mode]?mode:'day';weights=modes[mode];mixUniform.value.fromArray(weights);strengthUniform.value=1;
  if(!cache.has(mode)){
   const data=new Uint16Array(VALUES);for(let i=0;i<VALUES;i++)data[i]=THREE.DataUtils.toHalfFloat(bases[0][i]*weights[0]+bases[1][i]*weights[1]);
   const texture=new THREE.Data3DTexture(data,NX*4,NY,NZ);texture.format=THREE.RGBAFormat;texture.type=THREE.HalfFloatType;texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.unpackAlignment=1;texture.needsUpdate=true;cache.set(mode,texture);
  }
  volumeUniform.value=cache.get(mode);
 }
 setLighting('day');
 return{
  maps,
  attach(material){
   if(!material?.isMeshStandardMaterial||attached.has(material))return;attached.add(material);
   const lampUniform={value:material.userData.venueLampMap||maps.room[1]};
   material.onBeforeCompile=shader=>{
    shader.uniforms.venueLight=volumeUniform;shader.uniforms.venueBounceStrength=strengthUniform;shader.uniforms.venueMix=mixUniform;shader.uniforms.venueLampMap=lampUniform;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vVenueWorld;');
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
     vec4 venuePosition=vec4(transformed,1.);
     #ifdef USE_INSTANCING
      venuePosition=instanceMatrix*venuePosition;
     #endif
     vVenueWorld=(modelMatrix*venuePosition).xyz;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+declarations);
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_begin>',`#include <lights_fragment_begin>
     #if defined(RE_IndirectDiffuse) && !defined(USE_LIGHTMAP)
      irradiance+=venueIrradiance(inverseTransformDirection(geometryNormal,viewMatrix));
     #endif`);
    let chunks=THREE.ShaderChunk.lights_fragment_maps;
    chunks=chunks.replace('vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );',`vec4 dayLight=texture2D(lightMap,vLightMapUv);vec4 lampLight=texture2D(venueLampMap,vLightMapUv);
     vec4 lightMapTexel=vec4((dayLight.rgb*dayLight.rgb*venueMix.x+lampLight.rgb*lampLight.rgb*venueMix.y)*16.*venueBounceStrength,1.);`);
    // Diffuse environment is already traced into lightmaps/probes. The captured
    // environment remains active for glass and rough/specular reflections.
    chunks=chunks.replace('iblIrradiance += getIBLIrradiance( geometryNormal );','iblIrradiance += vec3(0.);');
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_maps>',chunks);
    if(material.userData.venueGlass)shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`#ifndef USE_TRANSMISSION
     diffuseColor.a*=.28+.72*pow(1.-abs(dot(normal,geometryViewDir)),3.);
     #endif
     #include <opaque_fragment>`);
   };
   material.customProgramCacheKey=()=> 'venue-cycles-v1'+(material.lightMap?'-atlas':'-probe')+(material.userData.venueGlass?'-glass':'');material.needsUpdate=true;
  },
  setLighting,
  info:()=>({engine:'Cycles',bounces:5,probes:NX*NY*NZ,surfaceAtlases:3,furnitureBaked:false,mix:[...weights]}),
  dispose(){cache.forEach(t=>t.dispose());Object.values(maps).flat().forEach(t=>t.dispose());},
 };
}
