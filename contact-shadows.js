import * as THREE from './vendor/three.module.min.js';

// Height-aware furniture shadows are rendered only after layout changes. The
// camera looks up from the floor, so near-floor cloth and chair feet retain
// dense contact while a tabletop casts a softer, lighter shadow.
export function createContactShadows(renderer,scene,getRoots){
 const target=new THREE.WebGLRenderTarget(2048,1224,{depthBuffer:true,stencilBuffer:false});
 const depth=new THREE.ShaderMaterial({side:THREE.DoubleSide,vertexShader:`varying float h;void main(){vec3 transformed=position;vec4 p=vec4(transformed,1.);
 #ifdef USE_INSTANCING
 p=instanceMatrix*p;
 #endif
 vec4 world=modelMatrix*p;h=max(0.,world.y);gl_Position=projectionMatrix*viewMatrix*world;}`,
 fragmentShader:'varying float h;void main(){float a=.64*exp(-h*2.4);gl_FragColor=vec4(vec3(a),1.);}' });
 const camera=new THREE.OrthographicCamera(-8.37,8.37,5,-5,.001,1.25);camera.position.set(8.37,-.02,5);camera.up.set(0,0,1);camera.lookAt(8.37,1,5);
 const uniforms={map:{value:target.texture},strength:{value:1},texel:{value:new THREE.Vector2(1/2048,1/1224)}};
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`uniform sampler2D map;uniform float strength;uniform vec2 texel;varying vec2 vUv;
 void main(){vec2 p=vec2(vUv.x,1.-vUv.y);float a=texture2D(map,p).r*.30;
 for(int i=0;i<8;i++){float t=float(i)*.785398;vec2 d=vec2(cos(t),sin(t));a+=texture2D(map,p+d*texel*3.5).r*.0875;}
 gl_FragColor=vec4(.09,.075,.055,a*strength);}`});
 const plane=new THREE.Mesh(new THREE.PlaneGeometry(16.74,10),material);plane.rotation.x=-Math.PI/2;plane.position.set(8.37,.001,5);plane.name='Тени соприкосновения мебели с полом';plane.userData.unbatched=true;plane.renderOrder=1;scene.add(plane);
 let dirty=true,updates=0;
 function update(){
  if(!dirty)return;dirty=false;updates++;
  const shadows=renderer.shadowMap.enabled,clear=new THREE.Color();renderer.getClearColor(clear);const alpha=renderer.getClearAlpha(),oldTarget=renderer.getRenderTarget(),override=scene.overrideMaterial,background=scene.background;
  // Keep only the chosen furniture roots in this offscreen depth pass. Restore
  // every visibility bit even if the graphics driver rejects the render.
  const state=scene.children.map(o=>[o,o.visible]);const allowed=new Set(getRoots());
  const nested=[];for(const root of allowed)root.traverse(o=>{if(o.isMesh&&o.material?.transparent){nested.push([o,o.visible]);o.visible=false;}});
  try{
   for(const [o,visible] of state)o.visible=visible&&allowed.has(o);
   scene.background=null;scene.overrideMaterial=depth;renderer.shadowMap.enabled=false;
   renderer.setRenderTarget(target);renderer.setClearColor(0,1);renderer.clear();renderer.render(scene,camera);
  }finally{
   scene.overrideMaterial=override;scene.background=background;renderer.shadowMap.enabled=shadows;
   for(const [o,v] of state)o.visible=v;for(const [o,v] of nested)o.visible=v;
   renderer.setRenderTarget(oldTarget);renderer.setClearColor(clear,alpha);
  }
 }
 return{update,invalidate(){dirty=true;},setLighting(mode){uniforms.strength.value=mode==='windows'?.9:mode==='lamps'?1.15:1;},setPlan(value){plane.visible=!value;},info:()=>({resolution:[2048,1224],refreshOnLayoutChange:true,updates,dirty}),dispose(){target.dispose();depth.dispose();material.dispose();plane.geometry.dispose();plane.removeFromParent();}};
}
