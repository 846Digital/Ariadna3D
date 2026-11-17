import {guestTables,serializeLayout,restoreLayout,resetLayout,moveTable,changeChairs,canPlace,addTable,tableObstacle,seatCount} from './table-layout.js?v=20261117-7';
import {updateTableObstacles} from './layout.js?v=20261117-7';

const $=id=>document.getElementById(id),storageKey='ariadna-seating-v1';
export function loadSeating(){try{const saved=localStorage.getItem(storageKey);if(saved)restoreLayout(JSON.parse(saved));}catch{}updateTableObstacles(guestTables.map(tableObstacle));}
export function createTableEditor({getHall,getPoint,changed,resized,notify}){
 let active=false,selected=guestTables[0]?.id||null,drag=null;
 const current=()=>guestTables.find(t=>t.id===selected);
 function save(){try{localStorage.setItem(storageKey,JSON.stringify(serializeLayout()));}catch{}updateTableObstacles(guestTables.map(tableObstacle));changed();}
 function refresh(){
  if(!current())selected=guestTables[0]?.id||null;
  for(const id of ['selected-table','swap-table']){
   const select=$(id),value=id==='selected-table'?selected:select.value;select.replaceChildren();
   for(const t of guestTables)if(id==='selected-table'||t.id!==selected){const option=document.createElement('option');option.value=t.id;option.textContent=t.name;select.append(option);}
   if([...select.options].some(o=>o.value===value))select.value=value;
  }
  $('chair-count').value=current()?.seats||6;$('plan-instruction').textContent=active?'Перетаскивайте столы вместе со стульями':'Нажмите на свободное место, чтобы оказаться там';
  for(const id of ['chair-count','remove-table','table-left','table-right','table-up','table-down'])$(id).disabled=!current();
  $('swap-tables').disabled=guestTables.length<2;$('swap-table').disabled=guestTables.length<2;
  $('table-summary').textContent=`${guestTables.length} гостевых столов · ${seatCount()} мест с президиумом`;
  getHall()?.selectTable(active?selected:null);changed();
 }
 function rebuild(){getHall()?.rebuildTables();getHall()?.selectTable(active?selected:null);save();refresh();}
 function translate(id,x,z){const delta=moveTable(id,x,z);if(delta)getHall()?.translateTable(id,delta.dx,delta.dz);changed();}
 function cancelDrag(){if(drag){translate(drag.tableId,drag.startX,drag.startZ);drag=null;}}
 $('edit-tables').addEventListener('click',()=>{cancelDrag();active=!active;$('table-editor').hidden=!active;$('edit-tables').textContent=active?'Готово':'Изменить расстановку';$('edit-tables').setAttribute('aria-expanded',String(active));refresh();resized();});
 $('selected-table').addEventListener('change',e=>{selected=e.target.value;refresh();});
 $('chair-count').addEventListener('change',()=>{const t=current();if(!t)return;changeChairs(t.id,$('chair-count').value);rebuild();});
 $('add-table').addEventListener('click',()=>{const t=addTable();if(!t){notify('Для нового стола со стульями не хватает свободного места. Сначала переместите другие столы.');return;}selected=t.id;rebuild();notify('Добавлен стол с 6 стульями');});
 $('remove-table').addEventListener('click',()=>{const index=guestTables.findIndex(t=>t.id===selected);if(index<0)return;guestTables.splice(index,1);selected=guestTables[Math.min(index,guestTables.length-1)]?.id||null;rebuild();});
 $('reset-tables').addEventListener('click',()=>{resetLayout();selected=guestTables[0].id;rebuild();notify('Восстановлена исходная расстановка на 47 мест');});
 $('swap-tables').addEventListener('click',()=>{
  const a=current(),b=guestTables.find(t=>t.id===$('swap-table').value);if(!a||!b)return;
  if(!canPlace(a,b.x,b.z,[b.id])||!canPlace(b,a.x,a.z,[a.id])){notify('Эти столы не помещаются в выбранных местах со стульями.');return;}
  const x=a.x,z=a.z;translate(a.id,b.x,b.z);translate(b.id,x,z);save();refresh();
 });
 for(const [id,dx,dz] of [['table-left',-.10,0],['table-right',.10,0],['table-up',0,-.10],['table-down',0,.10]])$(id).addEventListener('click',()=>{const t=current();if(!t)return;if(!canPlace(t,t.x+dx,t.z+dz)){notify('Здесь мешает стена, колонна или другой стол');return;}translate(t.id,t.x+dx,t.z+dz);save();});
 refresh();
 return{
  isActive:()=>active,
  refresh,
  leave(){cancelDrag();active=false;$('table-editor').hidden=true;$('edit-tables').textContent='Изменить расстановку';$('edit-tables').setAttribute('aria-expanded','false');getHall()?.selectTable(null);},
  down(event){
   if(!active)return false;const p=getPoint(event.clientX,event.clientY);if(!p)return true;
   const t=[...guestTables].reverse().find(t=>t.type==='long'?Math.abs(p.x-t.x)<t.width/2+.2&&Math.abs(p.z-t.z)<t.depth/2+.2:Math.hypot(p.x-t.x,p.z-t.z)<.83);
   if(t){selected=t.id;drag={pointerId:event.pointerId,tableId:t.id,startX:t.x,startZ:t.z,offsetX:p.x-t.x,offsetZ:p.z-t.z};refresh();}
   return true;
  },
  move(event){if(!active)return false;if(drag?.pointerId===event.pointerId){const p=getPoint(event.clientX,event.clientY);if(p)translate(drag.tableId,p.x-drag.offsetX,p.z-drag.offsetZ);}return true;},
  up(event,cancel=false){
   if(!active)return false;
   if(drag?.pointerId===event.pointerId){const t=current();if(cancel||!canPlace(t,t.x,t.z)){translate(t.id,drag.startX,drag.startZ);if(!cancel)notify('Стол должен помещаться внутри зала и не пересекать другие столы.');}drag=null;save();refresh();}
   return true;
  },
  cancel:cancelDrag,
  layout:serializeLayout,
 };
}
