import * as THREE from './vendor/three.module.min.js';

// Six-bounce architectural radiosity, sampled in world space. Furniture is never
// baked into this volume: editing its instances samples lighting at the new pose.
const NX=48,NY=14,NZ=32,VALUES=NX*4*NY*NZ*4;
const declarations=`
uniform highp sampler3D venueLight;
uniform sampler2D venueSurface;
varying vec3 vVenueWorld;
vec3 venueIrradiance(vec3 normalWorld){
 vec3 result=vec3(0.);
 if((vVenueWorld.y<.035&&normalWorld.y>.8)||(vVenueWorld.y>3.30&&normalWorld.y<-.7)){
  vec2 uv=clamp(vVenueWorld.xz/vec2(16.74,10.),0.,1.);
  uv=uv*vec2(191./192.,111./112.)+vec2(.5/192.,.5/112.);
  uv.y=uv.y*.5+(vVenueWorld.y>3.30?.5:0.);
  result=texture2D(venueSurface,uv).rgb;
 }else{
 vec3 p=clamp((vVenueWorld-vec3(.06))/(vec3(16.68,3.39,9.94)-vec3(.06)),0.,1.);
 // Each coefficient occupies one contiguous x slab; half-texel insets prevent
 // trilinear filtering from mixing adjacent spherical-harmonic coefficients.
 p=p*vec3(47./48.,13./14.,31./32.)+vec3(.5/48.,.5/14.,.5/32.);
 p.x*=.25;
 vec3 c0=texture(venueLight,p).rgb;
 p.x+=.25;
 vec3 cx=texture(venueLight,p).rgb;
 p.x+=.25;
 vec3 cy=texture(venueLight,p).rgb;
 p.x+=.25;
 vec3 cz=texture(venueLight,p).rgb;
 result=max(c0+cx*normalWorld.x+cy*normalWorld.y+cz*normalWorld.z,c0*.12);
 }
 return result;
}`;

export async function createIrradiance(){
 const response=await fetch('./assets/hall-irradiance.bin');
 if(!response.ok)throw new Error('Не загрузилось освещение зала');
 const buffer=await response.arrayBuffer();
 if(buffer.byteLength!==VALUES*2*2)throw new Error('Неполная карта освещения');
 const attached=new WeakSet(),cache=new Map(),volumeUniform={value:null},surfaceUniform={value:null};
 const surfaceResponse=await fetch('./assets/surface-irradiance.bin');if(!surfaceResponse.ok)throw new Error('Не загрузилось освещение поверхностей');
 const surfaceBuffer=await surfaceResponse.arrayBuffer(),surfaceValues=192*224*4;
 if(surfaceBuffer.byteLength!==surfaceValues*4)throw new Error('Неполная карта поверхностей');
 const decode=(buffer,count)=>[0,1].map(i=>Float32Array.from(new Uint16Array(buffer,i*count*2,count),THREE.DataUtils.fromHalfFloat));
 const volumeBases=decode(buffer,VALUES),surfaceBases=decode(surfaceBuffer,surfaceValues);
 const modes={day:[1,.58],windows:[1.15,0],lamps:[0,1.2],evening:[.035,1]};let weights=modes.day;
 const blend=(bases,weights)=>{const data=new Uint16Array(bases[0].length);for(let i=0;i<data.length;i++)data[i]=THREE.DataUtils.toHalfFloat(bases[0][i]*weights[0]+bases[1][i]*weights[1]);return data;};
 function setLighting(mode){
  mode=modes[mode]?mode:'day';weights=modes[mode];
  if(!cache.has(mode)){
   const volume=new THREE.Data3DTexture(blend(volumeBases,weights),NX*4,NY,NZ);volume.format=THREE.RGBAFormat;volume.type=THREE.HalfFloatType;volume.minFilter=volume.magFilter=THREE.LinearFilter;volume.unpackAlignment=1;volume.needsUpdate=true;
   const surface=new THREE.DataTexture(blend(surfaceBases,weights),192,224,THREE.RGBAFormat,THREE.HalfFloatType);surface.minFilter=surface.magFilter=THREE.LinearFilter;surface.needsUpdate=true;
   cache.set(mode,{volume,surface});
  }
  const current=cache.get(mode);volumeUniform.value=current.volume;surfaceUniform.value=current.surface;
 }
 setLighting('day');
 return{
  attach(material){
   if(!material?.isMeshStandardMaterial||attached.has(material))return;
   attached.add(material);
   material.onBeforeCompile=shader=>{
    shader.uniforms.venueLight=volumeUniform;shader.uniforms.venueSurface=surfaceUniform;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vVenueWorld;');
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
     vec4 venuePosition=vec4(transformed,1.);
     #ifdef USE_INSTANCING
      venuePosition=instanceMatrix*venuePosition;
     #endif
     vVenueWorld=(modelMatrix*venuePosition).xyz;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+declarations);
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_begin>',`#include <lights_fragment_begin>
     #if defined(RE_IndirectDiffuse)
      irradiance+=venueIrradiance(inverseTransformDirection(geometryNormal,viewMatrix));
     #endif`);
    if(material.userData.venueGlass)shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`#ifndef USE_TRANSMISSION
     diffuseColor.a*=.28+.72*pow(1.-abs(dot(normal,geometryViewDir)),3.);
     #endif
     #include <opaque_fragment>`);
   };
   material.customProgramCacheKey=()=> 'venue-radiosity-v2'+(material.userData.venueGlass?'-glass':'');material.needsUpdate=true;
  },
  setLighting,
  info:()=>({bounces:6,probes:NX*NY*NZ,furnitureBaked:false,mix:[...weights]}),
  dispose(){cache.forEach(({volume,surface})=>{volume.dispose();surface.dispose();});},
 };
}
