// Coordinates follow the supplied seating plan. One drawing pixel = 0.02 m.
// Absolute dimensions are estimates; relative positions follow the reference.
export const SCALE = 0.02;
export const planPoint = (x, y) => [(x - 33) * SCALE, (y - 60) * SCALE];
export const HEIGHT = 3.45;
export const boundary = [
  [33,560],[870,560],[870,434],[760,434],[760,256],[870,256],
  [870,60],[610,60],[610,256],[445,256],[445,60],[380,60],
  [380,254],[240,254],[240,235],[50,235],[50,254],[33,254]
].map(([x,y]) => planPoint(x,y));

export const tables = [
  { id:'round-1', name:'Гостевой стол 1', ...point(312,319), seats:5, radius:.66,chairs:chairPoints([[307,277],[344,289],[351,324],[322,357],[274,301]]) },
  { id:'round-2', name:'Гостевой стол 2', ...point(485,320), seats:6, radius:.66,chairs:chairPoints([[480,274],[515,284],[530,320],[513,351],[470,355],[444,307]]) },
  { id:'round-3', name:'Гостевой стол 3', ...point(609,320), seats:6, radius:.66,chairs:chairPoints([[583,277],[635,282],[651,326],[628,355],[593,358],[567,309]]) },
  { id:'round-4', name:'Гостевой стол 4', ...point(190,500), seats:6, radius:.66,chairs:chairPoints([[187,458],[150,480],[167,537],[214,541],[233,516],[225,475]]) },
  { id:'round-5', name:'Гостевой стол 5', ...point(347,500), seats:6, radius:.66,chairs:chairPoints([[345,456],[309,477],[311,535],[364,541],[391,518],[382,474]]) },
  { id:'round-6', name:'Гостевой стол 6', ...point(504,496), seats:6, radius:.66,chairs:chairPoints([[503,450],[466,472],[469,533],[519,537],[543,516],[540,472]]) },
];
function point(px,py) { const [x,z] = planPoint(px,py); return {x,z}; }
function chairPoints(points) { return points.map(([x,z])=>point(x,z)); }
export const columns = [point(289,510),point(578,510)];
export const longTable = {x:2.62,z:4.4,width:2.64,depth:.82,seats:10};
export const headTable = {x:1.02,z:7.24,width:.82,depth:1.86,seats:2};
export const SEATS = tables.reduce((n,t)=>n+t.seats,0)+longTable.seats+headTable.seats;
export const views = {
  entrance:{label:'Общий вид',x:13.3,z:7.0,lookX:3.2,lookZ:6.7,pitch:0},
  decor:{label:'Президиум',x:3.6,z:7.24,lookX:.2,lookZ:7.24,pitch:-.03},
  tables:{label:'Длинный гостевой стол',x:4.7,z:6.65,lookX:2.6,lookZ:3.52,pitch:-.12},
  windows:{label:'У окон',x:13.4,z:8.8,lookX:4.0,lookZ:9.2,pitch:.03},
  bar:{label:'Барная зона',x:12.8,z:6.5,lookX:10.0,lookZ:3.3,pitch:-.03},
};
export const obstacles = [
  ...tables.map(t=>({kind:'circle',x:t.x,z:t.z,r:t.radius+.08})),
  ...columns.map(c=>({kind:'circle',...c,r:.33})),
  {kind:'rect',x:longTable.x,z:longTable.z,w:2.72,d:.9},
  {kind:'rect',x:headTable.x,z:headTable.z,w:.9,d:1.95},
  {kind:'rect',x:9.88,z:3.12,w:3.28,d:.92},
];
export function insidePolygon(x,z,polygon=boundary) {
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const [xi,zi]=polygon[i], [xj,zj]=polygon[j];
    if(((zi>z)!==(zj>z))&&(x<(xj-xi)*(z-zi)/(zj-zi)+xi)) inside=!inside;
  }
  return inside;
}
export function canStand(x,z,radius=.18,extra=[]) {
  for(let k=0;k<8;k++) {
    const a=k*Math.PI/4;
    if(!insidePolygon(x+Math.cos(a)*radius,z+Math.sin(a)*radius)) return false;
  }
  return ![...obstacles,...extra].some(o=>o.kind==='circle'
    ? Math.hypot(x-o.x,z-o.z)<o.r+radius
    : Math.abs(x-o.x)<o.w/2+radius&&Math.abs(z-o.z)<o.d/2+radius);
}
