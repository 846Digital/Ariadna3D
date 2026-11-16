import * as THREE from './vendor/three.module.min.js';
import {EffectComposer,RenderPass,GTAOPass,OutputPass} from './vendor/rendering.module.js';

export function createPresentation(renderer,scene,camera){
 const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:4});
 const composer=new EffectComposer(renderer,target),beauty=new RenderPass(scene,camera);
 const ao=new GTAOPass(scene,camera,512,512,undefined,{radius:.22,thickness:.14,distanceExponent:1,scale:1.0,samples:8},{radius:4,lumaPhi:8,depthPhi:3,normalPhi:4});
 ao.blendIntensity=.65;composer.addPass(beauty);composer.addPass(ao);composer.addPass(new OutputPass());
 let enabled=true,quality='auto';
 return{
  resize(w,h){composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(w,h);ao.setSize(Math.max(1,Math.round(w*.75)),Math.max(1,Math.round(h*.75)));},
  setQuality(value){quality=value;enabled=value!=='low';},
  render(camera,plan=false,moving=false){if(plan||!enabled){renderer.render(scene,camera);return;}beauty.camera=camera;ao.camera=camera;ao.enabled=quality==='high'||!moving;composer.render();},
 };
}

// Small camera crops keep GPU memory bounded during 4K exports. Padding avoids
// seams in the ambient-occlusion filter; supersampling resolves fine edges.
export async function renderStill(renderer,presentation,camera,{width=1920,height=1280,supersampling=2,onProgress=()=>{},signal}={}){
 const oldSize=renderer.getSize(new THREE.Vector2()),oldRatio=renderer.getPixelRatio();
 const output=document.createElement('canvas');output.width=width;output.height=height;
 const ctx=output.getContext('2d',{alpha:false});ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 const renderCamera=camera.clone(),tile=384,padding=12,ss=Math.max(1,Math.min(2,supersampling));
 const total=Math.ceil(width/tile)*Math.ceil(height/tile);let completed=0;
 renderer.setPixelRatio(1);presentation.setQuality('high');
 try{
  for(let y=0;y<height;y+=tile)for(let x=0;x<width;x+=tile){
   if(signal?.aborted)throw new DOMException('Рендер остановлен','AbortError');
   const w=Math.min(tile,width-x),h=Math.min(tile,height-y),left=Math.min(padding,x),top=Math.min(padding,y),right=Math.min(padding,width-x-w),bottom=Math.min(padding,height-y-h);
   const rw=(w+left+right)*ss,rh=(h+top+bottom)*ss;
   renderer.setSize(rw,rh,false);presentation.resize(rw,rh);
   renderCamera.setViewOffset(width,height,x-left,y-top,w+left+right,h+top+bottom);
   presentation.render(renderCamera);
   ctx.drawImage(renderer.domElement,left*ss,top*ss,w*ss,h*ss,x,y,w,h);
   onProgress(++completed/total,'Рассчитываем детали и отражения');await new Promise(requestAnimationFrame);
  }
  const blob=await new Promise(resolve=>output.toBlob(resolve,'image/png'));if(!blob)throw new Error('Не удалось сохранить изображение');return blob;
 }finally{renderer.setPixelRatio(oldRatio);renderer.setSize(oldSize.x,oldSize.y,false);}
}
