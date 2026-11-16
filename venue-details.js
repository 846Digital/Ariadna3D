import * as THREE from './vendor/three.module.min.js';

// The right-hand rectangle in the seating plan is a low music platform.
// Its open front, rounded corners, botanical wall and PA follow the venue photos.
export function addMusicStage(room,planWalls,materials,stageWallMap){
 const stage=new THREE.Group();stage.position.set(16.65,0,5.7);stage.rotation.y=-Math.PI/2;stage.name='Небольшая музыкальная сцена';room.add(stage);
 const dark=materials.dark,metal=materials.silver;
 const boxGeometry=new THREE.BoxGeometry(1,1,1);
 function box(w,h,d,material,x,y,z){const mesh=new THREE.Mesh(boxGeometry,material);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);stage.add(mesh);mesh.userData.shadow=true;return mesh;}
 function rod(a,b,r,material=dark){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),8),material);mesh.position.copy(start.add(end).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());stage.add(mesh);return mesh;}
 const width=3.56,depth=2.10,height=.23,r=.24;
 const outline=new THREE.Shape();outline.moveTo(-width/2,0);outline.lineTo(width/2,0);outline.lineTo(width/2,-depth+r);outline.quadraticCurveTo(width/2,-depth,width/2-r,-depth);outline.lineTo(-width/2+r,-depth);outline.quadraticCurveTo(-width/2,-depth,-width/2,-depth+r);outline.closePath();
 const baseGeometry=new THREE.ExtrudeGeometry(outline,{depth:height,bevelEnabled:false,curveSegments:8});baseGeometry.rotateX(-Math.PI/2);
 const base=new THREE.Mesh(baseGeometry,dark);stage.add(base);base.receiveShadow=true;
 const topGeometry=new THREE.ShapeGeometry(outline,8);topGeometry.rotateX(-Math.PI/2);
 const marble=document.createElement('canvas');marble.width=marble.height=512;const mc=marble.getContext('2d');mc.fillStyle='#4e4945';mc.fillRect(0,0,512,512);
 let localSeed=7491;const random=()=>{localSeed=(localSeed*1664525+1013904223)>>>0;return localSeed/4294967296;};
 for(let i=0;i<56;i++){let x=random()*650-65,y=random()*512;mc.beginPath();mc.moveTo(x,y);for(let j=0;j<7;j++){x+=random()*70-35;y+=random()*80-35;mc.lineTo(x,y);}mc.strokeStyle=i%4?'rgba(194,182,168,.22)':'rgba(228,218,204,.38)';mc.lineWidth=.4+random()*1.2;mc.stroke();}
 const marbleMap=new THREE.CanvasTexture(marble);marbleMap.colorSpace=THREE.SRGBColorSpace;marbleMap.wrapS=marbleMap.wrapT=THREE.RepeatWrapping;marbleMap.repeat.set(1.8,1.1);
 const top=new THREE.Mesh(topGeometry,new THREE.MeshStandardMaterial({map:marbleMap,color:'#b8aea4',roughness:.78}));top.position.y=height+.004;top.receiveShadow=true;stage.add(top);
 for(let x=-1.48;x<=1.48;x+=.075)box(.011,height-.035,.012,materials.wood,x,height/2,depth+.002);
 const plan=new THREE.Mesh(topGeometry,materials.wood);plan.position.copy(stage.position);plan.position.y=height;plan.rotation.copy(stage.rotation);planWalls.add(plan);

 // A quiet, broad botanical mural: texture rather than hundreds of tiny meshes.
 const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=1024;const c=canvas.getContext('2d');
 const wash=c.createLinearGradient(0,0,0,1024);wash.addColorStop(0,'#bba99b');wash.addColorStop(.55,'#c3aea0');wash.addColorStop(1,'#9d9795');c.fillStyle=wash;c.fillRect(0,0,1536,1024);
 for(let i=0;i<43;i++){
  const x=random()*1536,base=1040,height=150+random()*650,lean=(random()-.5)*220;
  c.strokeStyle='rgba(101,83,72,.27)';c.lineWidth=1.2+random()*1.3;c.beginPath();c.moveTo(x,base);c.bezierCurveTo(x+lean*.15,base-height*.38,x+lean*.8,base-height*.7,x+lean,base-height);c.stroke();
  for(let j=0;j<6;j++){const u=.18+j*.13,xx=x+lean*u,yy=base-height*u,side=j%2?1:-1;const length=14+random()*34;c.beginPath();c.moveTo(xx,yy);c.quadraticCurveTo(xx+side*length,yy-10,xx+side*length*.8,yy-34);c.stroke();c.save();c.translate(xx+side*length*.8,yy-34);c.rotate(side*.55);c.fillStyle='rgba(99,83,73,.16)';c.beginPath();c.ellipse(0,0,6+random()*5,14+random()*9,0,0,Math.PI*2);c.fill();c.restore();}
 }
 const muralMap=new THREE.CanvasTexture(canvas);muralMap.colorSpace=THREE.SRGBColorSpace;muralMap.anisotropy=4;
 const mural=new THREE.Mesh(new THREE.PlaneGeometry(width,2.95),new THREE.MeshStandardMaterial({map:stageWallMap||muralMap,roughness:.96}));mural.position.set(0,1.59,.01);stage.add(mural);
 box(width,.07,.13,materials.trim,0,3.10,.06);

 const grilleCanvas=document.createElement('canvas');grilleCanvas.width=grilleCanvas.height=64;const gc=grilleCanvas.getContext('2d');gc.fillStyle='#242421';gc.fillRect(0,0,64,64);gc.fillStyle='#111210';for(let y=2;y<64;y+=4)for(let x=2;x<64;x+=4){gc.beginPath();gc.arc(x+(y%8?1:0),y,.9,0,Math.PI*2);gc.fill();}
 const grille=new THREE.CanvasTexture(grilleCanvas);grille.wrapS=grille.wrapT=THREE.RepeatWrapping;grille.repeat.set(2,3);grille.colorSpace=THREE.SRGBColorSpace;
 const speakerFace=new THREE.MeshStandardMaterial({map:grille,color:'#aaa9a2',roughness:.9});
 for(const x of [-1.34,1.34]){
  box(.48,.43,.48,dark,x,height+.215,.43);
  rod([x,height+.43,.43],[x,height+1.23,.43],.014);
  box(.39,.64,.31,dark,x,height+1.49,.43);box(.365,.61,.005,speakerFace,x,height+1.49,.589);
  rod([x,height,.37],[x,height+2.16,.37],.014);
  rod([x-.23,height+2.13,.37],[x+.23,height+2.13,.37],.012);
  for(const offset of [-.14,.14]){const lamp=new THREE.Mesh(new THREE.CylinderGeometry(.067,.072,.12,12),dark);lamp.rotation.x=Math.PI/2;lamp.position.set(x+offset,height+2.16,.37);stage.add(lamp);const lens=new THREE.Mesh(new THREE.CircleGeometry(.055,12),new THREE.MeshBasicMaterial({color:'#ebe6dd'}));lens.position.set(x+offset,height+2.16,.434);stage.add(lens);}
 }
 rod([.15,height,.8],[.15,height+1.34,.8],.009,metal);rod([.15,height+1.34,.8],[-.08,height+1.48,1.0],.009,metal);
 for(let i=0;i<3;i++){const a=i*Math.PI*2/3;rod([.15,height+.12,.8],[.15+Math.cos(a)*.2,height,.8+Math.sin(a)*.2],.009);}
 const mic=new THREE.Mesh(new THREE.CylinderGeometry(.017,.014,.12,10),dark);mic.position.set(-.1,height+1.49,1.02);mic.rotation.z=.9;stage.add(mic);
 return {x:15.6,z:5.7,width:2.1,depth:3.56,height};
}
