import * as THREE from './vendor/three.module.min.js';
import {EffectComposer,RenderPass,GTAOPass,OutputPass,ShaderPass} from './vendor/rendering.module.js?v=20261117-9';

export function createPresentation(renderer,scene,camera){
 const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:4});
 const composer=new EffectComposer(renderer,target),beauty=new RenderPass(scene,camera);
 const ao=new GTAOPass(scene,camera,512,512,undefined,{radius:.38,thickness:.16,distanceExponent:1,scale:1.0,samples:8},{radius:4,lumaPhi:8,depthPhi:3,normalPhi:4});
 const glow=new ShaderPass({uniforms:{tDiffuse:{value:null},texel:{value:new THREE.Vector2(1,1)}},vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`uniform sampler2D tDiffuse;uniform vec2 texel;varying vec2 vUv;
 vec3 bright(vec2 p){return max(texture2D(tDiffuse,p).rgb-vec3(1.3),vec3(0.));}
 void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;vec2 d=texel*4.;vec3 b=bright(vUv+vec2(d.x,0.))+bright(vUv-vec2(d.x,0.))+bright(vUv+vec2(0.,d.y))+bright(vUv-vec2(0.,d.y));b+=bright(vUv+d)*.5+bright(vUv-d)*.5;gl_FragColor=vec4(c+b*.035,1.);}`});
 ao.blendIntensity=.72;composer.addPass(beauty);composer.addPass(ao);composer.addPass(glow);composer.addPass(new OutputPass());
 let enabled=true,quality='auto',width=1,height=1,motionScale=1,adaptive=.75,samples=0,elapsed=0,warmup=0,lastMoving=false,averageMs=0;
 function configure(scale,moving=false){
  motionScale=scale;const ratio=renderer.getPixelRatio()*scale;
  composer.setPixelRatio(ratio);composer.setSize(width,height);
  const edge=moving?480:quality==='high'?1100:800;
  const aoScale=Math.min(.75,edge/Math.max(width*ratio,height*ratio));
  ao.setSize(Math.max(1,Math.round(width*ratio*aoScale)),Math.max(1,Math.round(height*ratio*aoScale)));
  glow.uniforms.texel.value.set(1/(width*ratio),1/(height*ratio));
 }
 return{
  resize(w,h){width=w;height=h;configure(1);},
  setQuality(value){if(quality!==value){adaptive=value==='high'?1:.75;samples=elapsed=warmup=0;}quality=value;enabled=value!=='low';configure(motionScale,lastMoving);},
  recordFrame(ms,moving){
   if(!moving||!lastMoving||quality==='low'){samples=elapsed=0;warmup=0;return;}
   if(ms<5||ms>180)return;
   warmup+=ms;if(warmup<500)return;
   samples++;elapsed+=ms;
   if(elapsed>1100&&samples>=15){averageMs=elapsed/samples;
    if(averageMs>29&&adaptive>.55)adaptive=Math.max(.55,Math.round((adaptive-.1)*100)/100);
    else if(averageMs<20&&adaptive<1)adaptive=Math.min(1,Math.round((adaptive+.05)*100)/100);
    samples=elapsed=0;
   }
  },
  info:()=>({quality,scale:motionScale,adaptive,averageMs:Math.round(averageMs*10)/10,output:[Math.round(width*renderer.getPixelRatio()),Math.round(height*renderer.getPixelRatio())],internal:[Math.round(width*renderer.getPixelRatio()*motionScale),Math.round(height*renderer.getPixelRatio()*motionScale)]}),
  render(camera,plan=false,moving=false){
   if(!plan)scene.userData.updateContactShadows?.();
   scene.userData.cameraMoving=moving;
   if(plan||!enabled){renderer.render(scene,camera);return;}
   const scale=moving?adaptive:1;
   if(scale!==motionScale||moving!==lastMoving)configure(scale,moving);
   lastMoving=moving;beauty.camera=camera;ao.camera=camera;ao.enabled=true;composer.render();
  },
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
