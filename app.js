import {boundary,tables,columns,longTable,headTable,views,SEATS,canStand} from './layout.js?v=20261116-2';

const $=id=>document.getElementById(id),canvas=$('scene');
const coarse=matchMedia('(pointer:coarse)').matches,reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
const defaults={style:'reference',lighting:'day',quality:'auto',speed:1,sensitivity:1,map:true,decor:true};
let preferences={...defaults};
try{preferences={...defaults,...JSON.parse(localStorage.getItem('ariadna-viewer-v1')||'{}')};}catch{}
if(!['reference','rose','olive'].includes(preferences.style))preferences.style='reference';
if(!['day','windows','lamps','evening'].includes(preferences.lighting))preferences.lighting='day';
if(!['auto','high','low'].includes(preferences.quality))preferences.quality='auto';
for(const key of ['speed','sensitivity'])preferences[key]=Math.min(1.8,Math.max(.4,Number(preferences[key])||1));
let renderer,hall,THREE,camera,planCamera,presentation,renderStill,renderJob=null,mode='walk',started=false,ready=false,dirty=true,renderingFailed=false;
let yaw=0,pitch=0,lastTime=0,notificationTimer,zoom=1,mapTime=0,transitioning=false;
let velocity={x:0,z:0},joystick={x:0,y:0},keys=new Set(),lastView='entrance';
const position={x:views.entrance.x,z:views.entrance.z},eyeHeight=1.58;
let drag=null,pinch=null;const pointers=new Map();
let detailRestoreAt=0,detailSettled=true;
function markMotion(){detailRestoreAt=performance.now()+140;detailSettled=false;}
for(const name of ['pointermove','touchmove','keydown','wheel'])canvas.addEventListener(name,markMotion,{passive:true});
document.addEventListener('keydown',markMotion,{passive:true});

function persist(){try{localStorage.setItem('ariadna-viewer-v1',JSON.stringify(preferences));}catch{}}
function notify(message){$('notification').textContent=message;$('notification').hidden=false;clearTimeout(notificationTimer);notificationTimer=setTimeout(()=>$('notification').hidden=true,4200);}
function failure(message){renderingFailed=true;$('welcome').hidden=true;$('failure').hidden=false;$('failure-message').textContent=message;}
function clearMovement(){keys.clear();velocity.x=velocity.z=0;joystick.x=joystick.y=0;$('joystick-thumb').style.transform='';}
function releasePointer(){if(document.pointerLockElement===canvas)document.exitPointerLock();clearMovement();}
function anyDialog(){return !!document.querySelector('dialog[open]');}
function openDialog(id){releasePointer();const dialog=$(id);if(!dialog.open)dialog.showModal();}
for(const button of document.querySelectorAll('.close-dialog'))button.addEventListener('click',()=>button.closest('dialog').close());
for(const dialog of document.querySelectorAll('dialog')){
 dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
 dialog.addEventListener('close',()=>{clearMovement();dirty=true;});
}
$('help-button').addEventListener('click',()=>openDialog('help-dialog'));
$('settings-button').addEventListener('click',()=>openDialog('settings-dialog'));
$('references-button').addEventListener('click',()=>{selectReference(preferences.style==='reference'?'decor':preferences.style);openDialog('references-dialog');});
$('fallback-references').addEventListener('click',()=>openDialog('references-dialog'));
$('retry-button').addEventListener('click',()=>location.reload());
$('dismiss-hint').addEventListener('click',()=>$('walk-hint').hidden=true);

const references={
 decor:['reference-decor.jpg','Фотография свадебного президиума с молочной и шоколадной драпировкой','Ваш референс свадебного оформления.'],
 hall:['reference-hall.jpg','Банкетный зал с молочными скатертями, коричневыми стульями и кольцевыми люстрами','Ваш референс банкетного зала.'],
 plan:['seating-plan.jpg','Исходная схема рассадки на 47 человек','Ваша схема. По ней восстановлены контур помещения и расположение столов.'],
 architecture:['venue-interior.jpg','Основной зал Ариадны: зеркальные полосы, бра, бар и кольцевые светильники','Фотография с официального сайта: зеркальные полосы, бра, бар и светильники.'],
 windows:['venue-windows.jpg','Арочные двери, окна и белые колонны в основном зале','Фотография с официального сайта: окна, колонны и цилиндрические подвесы.'],
 bar:['venue-bar.jpg','Барная стойка с тёмным фасадом и терракотовыми стульями','Фотография барной зоны с официального сайта.'],
 stage:['venue-stage.jpg','Музыкальная сцена с низким тёмным подиумом, растительной росписью и акустикой справа от бара','Дополнительный ракурс основного зала: низкая сцена справа от бара, телевизор на стене слева.'],
 rose:['preview-rose.webp','Та же 3D-модель: пыльно-розовые ткани и оливковые акценты','Пыльная роза. Кадр из модели: меняются только цвета, геометрия и декор совпадают с исходным вариантом.'],
 olive:['preview-olive.webp','Та же 3D-модель: оливковые ткани и шоколадные акценты','Олива и шоколад. Кадр из модели: меняются только цвета, геометрия и декор совпадают с исходным вариантом.'],
};
function selectReference(name){
 const [file,alt,caption]=references[name];$('reference-image').src='./assets/'+file+'?v=20261116-2';$('reference-image').alt=alt;$('reference-caption').textContent=caption;
 for(const b of document.querySelectorAll('[data-reference]')){const active=b.dataset.reference===name;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));}
}
for(const button of document.querySelectorAll('[data-reference]'))button.addEventListener('click',()=>selectReference(button.dataset.reference));
$('reference-image').addEventListener('error',()=>{$('reference-caption').textContent='Фотография не загрузилась. Проверьте папку assets и обновите страницу.';});

function updateSettingsUI(){
 $('decor-style').value=preferences.style;$('lighting').value=$('lighting-quick').value=preferences.lighting;$('quality').value=preferences.quality;
 $('speed').value=preferences.speed;$('sensitivity').value=preferences.sensitivity;$('show-map').checked=preferences.map;$('show-decor').checked=preferences.decor;
 $('speed-value').textContent=preferences.speed<1?'Медленно':preferences.speed>1.2?'Быстро':'Обычная';
}
function updateQuality(){
 if(!renderer)return;
 const autoCap=Math.min(coarse?1.25:1.5,Math.sqrt((coarse?900000:1400000)/Math.max(1,canvas.clientWidth*canvas.clientHeight)));
 const cap=preferences.quality==='low'?1:preferences.quality==='high'?2:autoCap;
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,cap));
 renderer.shadowMap.enabled=preferences.quality!=='low';renderer.shadowMap.needsUpdate=true;resize();
 presentation?.setQuality(preferences.quality);
 hall?.setQuality(preferences.quality);
}
function applyStyle(value,announce=true){
 if(!['reference','rose','olive'].includes(value))return;
 preferences.style=value;if(hall)hall.setStyle(value);persist();dirty=true;
 const descriptions={reference:'Шоколад, молочный и белый',rose:'Пыльная роза, оливковый и белый',olive:'Оливковый, шоколад и тёплый белый'};
 const palette=document.querySelector('.palette');palette.lastChild.textContent=' '+descriptions[value];
 const colors={reference:['#4b3024','#eee4d3','#f7f1e7'],rose:['#bc9094','#68714c','#f7f1e7'],olive:['#858767','#563b2e','#f7f1e7']};
 palette.querySelectorAll('span').forEach((s,i)=>s.style.backgroundColor=colors[value][i]);
}
$('decor-style').addEventListener('change',event=>applyStyle(event.target.value));
$('lighting-quick').addEventListener('change',event=>{preferences.lighting=event.target.value;hall?.setLighting(preferences.lighting);updateSettingsUI();persist();dirty=true;});
for(const id of ['lighting','quality','speed','sensitivity'])$(id).addEventListener(id==='speed'||id==='sensitivity'?'input':'change',event=>{
 preferences[id]=id==='speed'||id==='sensitivity'?Number(event.target.value):event.target.value;
 if(id==='quality')updateQuality();if(id==='lighting'&&hall)hall.setLighting(preferences.lighting);
 updateSettingsUI();persist();dirty=true;
});
$('show-map').addEventListener('change',event=>{preferences.map=event.target.checked;persist();refreshControls();});
$('show-decor').addEventListener('change',event=>{preferences.decor=event.target.checked;if(hall)hall.setDecor(preferences.decor);persist();dirty=true;});
$('reset-settings').addEventListener('click',()=>{preferences={...defaults};updateSettingsUI();applyStyle(preferences.style,false);if(hall){hall.setLighting(preferences.lighting);hall.setDecor(true);}updateQuality();refreshControls();persist();notify('Настройки сброшены');});
updateSettingsUI();applyStyle(preferences.style,false);

function resize(){
 if(!renderer||renderJob)return;
 const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
 const width=Math.max(19,12.5*w/h)/zoom,height=width*h/w;
 Object.assign(planCamera,{left:-width/2,right:width/2,top:height/2,bottom:-height/2});planCamera.updateProjectionMatrix();dirty=true;
 presentation?.resize(w,h);
}
function orientCamera(){camera.position.set(position.x,eyeHeight,position.z);camera.rotation.set(pitch,yaw,0,'YXZ');}
function setView(name){
 if(!ready||!views[name])return;
 releasePointer();const v=views[name];position.x=v.x;position.z=v.z;yaw=Math.atan2(-(v.lookX-v.x),-(v.lookZ-v.z));pitch=v.pitch;
 orientCamera();lastView=name;
 if(mode!=='walk')setMode('walk');
 for(const b of document.querySelectorAll('[data-view]')){const active=b.dataset.view===name;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));}
 $('location-label').textContent=v.label;dirty=true;
 markMotion();
 if(started){$('walk-hint').hidden=true;$('walk-hint').dataset.dismissed='true';}
 if(started)canvas.focus({preventScroll:true});
}
function refreshControls(){
 for(const id of ['location','view-controls','corner-actions'])$(id).hidden=!started;
 $('minimap-wrap').hidden=!started||mode!=='walk'||!preferences.map;
 $('joystick').hidden=!started||mode!=='walk'||!coarse;
 $('plan-hint').hidden=!started||mode!=='plan';
 $('walk-hint').hidden=!started||mode!=='walk'||$('walk-hint').dataset.dismissed==='true';
 $('walk-mode').classList.toggle('selected',mode==='walk');$('walk-mode').setAttribute('aria-pressed',String(mode==='walk'));
 $('plan-mode').classList.toggle('selected',mode==='plan');$('plan-mode').setAttribute('aria-pressed',String(mode==='plan'));
 $('crosshair').hidden=document.pointerLockElement!==canvas;
}
function setMode(value){
 if(!ready)return;
 if(!started)start();releasePointer();mode=value;hall.setPlan(mode==='plan');refreshControls();dirty=true;
 if(mode==='walk'){orientCamera();canvas.focus({preventScroll:true});}
}
function start(){
 if(!ready)return;
 started=true;$('welcome').hidden=true;refreshControls();canvas.focus({preventScroll:true});dirty=true;
}
$('start-button').addEventListener('click',start);
$('walk-mode').addEventListener('click',()=>setMode('walk'));
$('plan-mode').addEventListener('click',()=>setMode('plan'));
$('minimap-button').addEventListener('click',()=>setMode('plan'));
$('home-button').addEventListener('click',()=>setView('entrance'));
$('dismiss-hint').addEventListener('click',()=>{$('walk-hint').dataset.dismissed='true';});
for(const b of document.querySelectorAll('[data-view]'))b.addEventListener('click',()=>setView(b.dataset.view));

function stepPosition(dx,dz){
 const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.035));
 for(let i=0;i<n;i++){
  if(canStand(position.x+dx/n,position.z,.16,hall.chairObstacles))position.x+=dx/n;
  if(canStand(position.x,position.z+dz/n,.16,hall.chairObstacles))position.z+=dz/n;
 }
}
function move(dt){
 if(!started||mode!=='walk'||anyDialog()||document.hidden)return false;
 const left=keys.has('ArrowLeft'),right=keys.has('ArrowRight');
 if(left||right){yaw+=(left?1:-1)*dt*1.45;dirty=true;}
 const forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-joystick.y;
 const sideways=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+joystick.x;
 const length=Math.max(1,Math.hypot(forward,sideways)),speed=1.65*preferences.speed*(keys.has('ShiftLeft')||keys.has('ShiftRight')?1.65:1);
 const tx=(-Math.sin(yaw)*forward+Math.cos(yaw)*sideways)/length*speed;
 const tz=(-Math.cos(yaw)*forward-Math.sin(yaw)*sideways)/length*speed;
 const blend=1-Math.exp(-12*dt);velocity.x+=(tx-velocity.x)*blend;velocity.z+=(tz-velocity.z)*blend;
 const moving=Math.hypot(velocity.x,velocity.z)>.005;
 if(moving){stepPosition(velocity.x*dt,velocity.z*dt);dirty=true;lastView='';for(const b of document.querySelectorAll('[data-view]')){b.classList.remove('selected');b.setAttribute('aria-pressed','false');}}
 if(dirty)orientCamera();return moving||left||right;
}

window.addEventListener('keydown',event=>{
 if(!started||anyDialog()||/INPUT|SELECT|TEXTAREA|BUTTON/.test(document.activeElement?.tagName))return;
 if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(event.code)){event.preventDefault();keys.add(event.code);}
});
window.addEventListener('keyup',event=>keys.delete(event.code));window.addEventListener('blur',clearMovement);
document.addEventListener('visibilitychange',()=>{clearMovement();lastTime=0;dirty=true;});
document.addEventListener('pointerlockchange',()=>{clearMovement();$('crosshair').hidden=document.pointerLockElement!==canvas;});
document.addEventListener('mousemove',event=>{
 if(document.pointerLockElement!==canvas||mode!=='walk'||anyDialog())return;
 yaw-=event.movementX*.002*preferences.sensitivity;pitch=THREE.MathUtils.clamp(pitch-event.movementY*.002*preferences.sensitivity,-1.25,1.25);orientCamera();dirty=true;
});

function planWorld(clientX,clientY){
 const rect=canvas.getBoundingClientRect(),point=new THREE.Vector2((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1),ray=new THREE.Raycaster();
 ray.setFromCamera(point,planCamera);const result=new THREE.Vector3();return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),result)?result:null;
}
function enterAt(clientX,clientY){
 const p=planWorld(clientX,clientY);if(!p)return;
 if(!canStand(p.x,p.z,.18,hall.chairObstacles)){notify('Выберите свободное место между столами');return;}
 position.x=p.x;position.z=p.z;pitch=0;setMode('walk');orientCamera();lastView='';$('location-label').textContent='Свободная прогулка';dirty=true;canvas.focus({preventScroll:true});
}
canvas.addEventListener('pointerdown',event=>{
 if(!started||!ready||anyDialog())return;
 pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
 if(mode==='plan'&&pointers.size===2){const p=[...pointers.values()];pinch={distance:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y),zoom};drag=null;return;}
 drag={id:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,moved:false};
 canvas.setPointerCapture(event.pointerId);
 if(mode==='walk'&&event.pointerType==='mouse'&&event.button===0&&typeof canvas.requestPointerLock==='function'){
  try{const request=canvas.requestPointerLock();if(request?.catch)request.catch(()=>{});}catch{}
 }
 canvas.focus({preventScroll:true});
});
canvas.addEventListener('pointermove',event=>{
 if(pointers.has(event.pointerId))pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
 if(pinch&&pointers.size===2){const p=[...pointers.values()];zoom=THREE.MathUtils.clamp(pinch.zoom*Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)/pinch.distance,.7,2.2);resize();return;}
 if(!drag||drag.id!==event.pointerId||document.pointerLockElement===canvas)return;
 const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
 if(Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>6)drag.moved=true;
 if(mode==='walk'){
  yaw-=dx*.0038*preferences.sensitivity;pitch=THREE.MathUtils.clamp(pitch-dy*.0038*preferences.sensitivity,-1.25,1.25);orientCamera();dirty=true;
 }
 drag.x=event.clientX;drag.y=event.clientY;
});
function endPointer(event){
 if(drag?.id===event.pointerId&&mode==='plan'&&!drag.moved&&!pinch)enterAt(event.clientX,event.clientY);
 pointers.delete(event.pointerId);if(pointers.size<2)pinch=null;if(drag?.id===event.pointerId)drag=null;
}
canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',event=>{pointers.delete(event.pointerId);drag=null;pinch=null;});
canvas.addEventListener('wheel',event=>{if(mode==='plan'&&started){event.preventDefault();zoom=THREE.MathUtils.clamp(zoom*Math.exp(-event.deltaY*.001),.7,2.2);resize();}},{passive:false});
canvas.addEventListener('contextmenu',event=>event.preventDefault());

let joystickId=null;
function updateJoystick(event){
 const rect=$('joystick').getBoundingClientRect(),dx=event.clientX-(rect.left+rect.width/2),dy=event.clientY-(rect.top+rect.height/2),r=rect.width*.32,len=Math.max(r,Math.hypot(dx,dy));
 joystick.x=dx/len;joystick.y=dy/len;$('joystick-thumb').style.transform=`translate(${joystick.x*r}px,${joystick.y*r}px)`;
}
$('joystick').addEventListener('pointerdown',event=>{if(joystickId!==null)return;event.preventDefault();joystickId=event.pointerId;$('joystick').setPointerCapture(event.pointerId);updateJoystick(event);});
$('joystick').addEventListener('pointermove',event=>{if(event.pointerId===joystickId)updateJoystick(event);});
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('joystick').addEventListener(type,event=>{if(event.pointerId!==joystickId)return;joystickId=null;joystick.x=joystick.y=0;$('joystick-thumb').style.transform='';});

if(!document.fullscreenEnabled)$('fullscreen-button').hidden=true;
$('fullscreen-button').addEventListener('click',async()=>{
 try{if(document.fullscreenElement)await document.exitFullscreen();else await $('app').requestFullscreen();}catch{notify('Полный экран недоступен в этом браузере');}
});
$('capture-button').addEventListener('click',()=>{if(ready){if(mode==='plan')setMode('walk');openDialog('render-dialog');}});
$('capture-quick').addEventListener('click',()=>{
 if(!renderer||!ready)return;
 try{
  presentation.render(mode==='plan'?planCamera:camera,mode==='plan');
  canvas.toBlob(blob=>{if(!blob){notify('Не удалось сохранить кадр');return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`ariadna-${preferences.style}-${mode}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);notify('Кадр сохранён');},'image/png');
 }catch{notify('Не удалось сохранить кадр. Попробуйте обновить страницу.');}
});
let renderPreviewURL=null;
if(coarse){$('render-size').value='1920';$('render-samples').value='1';}
$('render-cancel').addEventListener('click',()=>renderJob?.abort());
$('render-dialog').addEventListener('close',()=>{renderJob?.abort();});
$('render-start').addEventListener('click',async()=>{
 if(renderJob||!ready)return;
 const controller=new AbortController();renderJob=controller;releasePointer();
 $('render-start').disabled=true;$('capture-quick').disabled=true;$('render-progress').hidden=false;$('render-cancel').hidden=false;$('render-save').hidden=true;$('render-preview').hidden=true;
 try{
  const edge=Number($('render-size').value),width=Math.round(camera.aspect>=1?edge:edge*camera.aspect),height=Math.round(camera.aspect>=1?edge/camera.aspect:edge),supersampling=Number($('render-samples').value);
  presentation.resize(1,1);
  const blob=await renderStill(renderer,presentation,camera,{width,height,supersampling,signal:controller.signal,onProgress:(p,stage)=>{$('render-progress').value=p;$('render-status').textContent=stage+(p>0?' · '+Math.floor(p*100)+'%':'');}});
  if(renderPreviewURL)URL.revokeObjectURL(renderPreviewURL);renderPreviewURL=URL.createObjectURL(blob);
  $('render-preview').src=renderPreviewURL;$('render-preview').hidden=false;$('render-save').href=renderPreviewURL;$('render-save').download=`ariadna-${preferences.style}-${width}.png`;$('render-save').hidden=false;$('render-status').textContent=`Готово · ${width} × ${height} · PNG`;
 }catch(error){$('render-status').textContent=error.name==='AbortError'?'Рендер остановлен.':'Рендер не завершён: '+error.message;}
 finally{renderJob=null;$('render-start').disabled=false;$('capture-quick').disabled=false;$('render-cancel').hidden=true;updateQuality();dirty=true;}
});

function drawMap(){
 const c=$('minimap').getContext('2d'),w=456,h=280,s=25.2,ox=17,oy=12;
 const point=(x,z)=>[ox+x*s,oy+z*s];c.clearRect(0,0,w,h);c.fillStyle='#ece7dc';c.fillRect(0,0,w,h);
 c.beginPath();boundary.forEach(([x,z],i)=>i?c.lineTo(...point(x,z)):c.moveTo(...point(x,z)));c.closePath();c.fillStyle='#faf7ef';c.fill();c.strokeStyle='#8e7f6a';c.lineWidth=2.5;c.stroke();
 const color=preferences.style==='rose'?'#bc9094':preferences.style==='olive'?'#858767':'#d5c7b0';
 c.fillStyle=color;c.strokeStyle='#8d7d65';c.lineWidth=1;
 for(const t of tables){const [x,y]=point(t.x,t.z);c.beginPath();c.arc(x,y,t.radius*s,0,Math.PI*2);c.fill();c.stroke();}
 for(const t of [{...longTable,w:longTable.width,d:longTable.depth},{...headTable,w:headTable.width,d:headTable.depth}]){const [x,y]=point(t.x-t.w/2,t.z-t.d/2);c.fillRect(x,y,t.w*s,t.d*s);c.strokeRect(x,y,t.w*s,t.d*s);}
 c.fillStyle='#b7ad9c';for(const col of columns){c.beginPath();c.arc(...point(col.x,col.z),.31*s,0,Math.PI*2);c.fill();}
 const [x,y]=point(position.x,position.z),angle=-yaw-Math.PI/2;
 c.fillStyle='rgba(125,83,43,.14)';c.beginPath();c.moveTo(x,y);c.arc(x,y,45,angle-.55,angle+.55);c.closePath();c.fill();
 c.fillStyle='#6e462e';c.strokeStyle='#fffaf0';c.lineWidth=2;c.beginPath();c.arc(x,y,5,0,Math.PI*2);c.fill();c.stroke();
}
function frame(time){
 requestAnimationFrame(frame);if(!ready||renderingFailed||document.hidden||renderJob)return;
 const dt=lastTime?Math.min((time-lastTime)/1000,.05):.016;lastTime=time;
 move(dt);
 const moving=time<detailRestoreAt||keys.size>0||Math.abs(joystick.x)+Math.abs(joystick.y)>.01;
 if(!moving&&!detailSettled){dirty=true;detailSettled=true;}
 if(dirty){
  try{presentation.render(mode==='plan'?planCamera:camera,mode==='plan',moving);}catch(error){console.error(error);failure('Браузеру не удалось отрисовать зал. Обновите страницу или попробуйте другой браузер.');return;}
  drawMap();
  dirty=false;
 }
}

async function boot(){
 try{
  const module=await import('./scene.js?v=20261116-2');THREE=module.THREE;
  renderer=new THREE.WebGLRenderer({canvas,antialias:!coarse,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true});
  renderer.debug.onShaderError=(gl,program,vertex,fragment)=>{const report={program:gl.getProgramInfoLog(program),vertex:gl.getShaderInfoLog(vertex),fragment:gl.getShaderInfoLog(fragment)};console.error(JSON.stringify(report));throw new Error('Графический процессор не смог подготовить рендер');};
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
  camera=new THREE.PerspectiveCamera(60,1,.045,70);planCamera=new THREE.OrthographicCamera(-10,10,6,-6,.1,80);planCamera.up.set(0,0,-1);planCamera.position.set(8.37,30,5);planCamera.lookAt(8.37,0,5);
  $('load-status').textContent='Расставляем мебель и свадебный декор';await new Promise(resolve=>requestAnimationFrame(resolve));
  $('load-status').textContent='Загружаем материалы тканей и камня';hall=await module.createHall(renderer);ready=true;setView('entrance');applyStyle(preferences.style,false);hall.setLighting(preferences.lighting);hall.setDecor(preferences.decor);updateQuality();
  const graphics=await import('./render-still.js?v=20261116-2');renderStill=graphics.renderStill;presentation=graphics.createPresentation(renderer,hall.scene,camera);updateQuality();
  renderer.shadowMap.needsUpdate=true;presentation.render(camera);drawMap();
  $('start-button').disabled=false;$('start-label').textContent='Войти в зал';$('load-status').textContent=coarse?'Управление касанием':'Управление мышью и клавиатурой';
  window.addEventListener('resize',resize);new ResizeObserver(resize).observe($('app'));
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();failure('Графический контекст был потерян. Закройте лишние вкладки и обновите страницу.');});
  if(new URLSearchParams(location.search).has('qa'))window.__ARIADNA__={
   getState:()=>({ready,started,mode,position:{...position},yaw,pitch,preferences:{...preferences},...hall.stats(),lightSources:hall.lightSources(),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,focus:document.activeElement?.id,keys:[...keys]}),
   canStand:(x,z)=>canStand(x,z,.16,hall.chairObstacles),setView,setMode,applyStyle,start,
   project:(x,y,z)=>{const p=new THREE.Vector3(x,y,z).project(mode==='plan'?planCamera:camera);return{x:(p.x+1)*canvas.clientWidth/2,y:(1-p.y)*canvas.clientHeight/2};},
   materials:()=>Object.fromEntries(['cloth','napkin','backdrop','drape','chair'].map(key=>[key,'#'+hall.materials[key].color.getHexString()])),
   geometrySignature:()=>hall.geometrySignature(),gpu:()=>renderer.getContext().getParameter(renderer.getContext().getExtension('WEBGL_debug_renderer_info')?.UNMASKED_RENDERER_WEBGL||renderer.getContext().RENDERER),
   renderStill:async(options={})=>{renderJob=new AbortController();try{const blob=await renderStill(renderer,presentation,camera,options);return await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(blob);});}finally{renderJob=null;updateQuality();dirty=true;}},
  };
  requestAnimationFrame(frame);
 }catch(error){console.error(error);failure('Не удалось загрузить 3D-зал. Проверьте, что все файлы загружены на GitHub Pages, и откройте страницу в современном браузере с WebGL 2.');}
}
boot();
