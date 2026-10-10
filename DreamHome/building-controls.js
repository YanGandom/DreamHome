import * as THREE from './vendor/three.module.js';
import {createWallHandles} from './wall-handles.js';
import {snap} from './building-system.js';

export function createBuildingControls({scene,camera,renderer,controls,system,toast,onInteract,onSelect=()=>{},onView=()=>{}}){
  const model=system.construction;if(!model)return null;
  const canvas=renderer.domElement,$=id=>document.getElementById(id),popup=$('build-ui'),options=$('build-options');
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),handles=createWallHandles(scene,camera,canvas),ground=new THREE.Group(),bars=[];
  handles.root.name='BuildingWallHandles';ground.name='FoundationHandles';scene.add(ground);ground.visible=false;
  for(const [edge,bar]of Object.entries(handles.bars))bar.name='BuildingResize-'+edge;
  for(const edge of ['left','right','back','front']){const m=new THREE.Mesh(new THREE.BoxGeometry(1,.065,1),new THREE.MeshBasicMaterial({color:'#80cf7b',transparent:true,opacity:.85,depthTest:false}));m.userData.edge=edge;m.renderOrder=24;bars.push(m);ground.add(m)}
  const previewRoot=new THREE.Group(),previewMaterial=new THREE.MeshBasicMaterial({color:'#85c578',transparent:true,opacity:.42,depthWrite:false});previewRoot.name='ConstructionPreview';previewRoot.userData.editorHelper=true;previewRoot.visible=false;scene.add(previewRoot);
  let enabled=false,selected=null,drag=null,press=null,pending=null,library=null,suppress=false,lastTip=0;
  const tools=[['room','房间地基'],['wall','墙壁'],['door','门与门洞'],['flat','平屋顶'],['gable','双坡屋顶'],['chimney','烟囱']];
  const catalog=tools.map(([id,name])=>{const root=new THREE.Group(),mat=(c)=>new THREE.MeshStandardMaterial({color:c,roughness:.8}),stone=mat('#e0cfb3'),green=mat('#628578'),wood=mat('#a78359');
    const box=(w,h,d,x,y,z,m)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);root.add(o);return o};
    if(id==='room'){box(3,.3,3,0,0,0,stone);for(let i=-1;i<=1;i++)box(.025,.02,3,i,.16,0,wood)}
    if(id==='wall')box(3,2.3,.2,0,1.15,0,stone);
    if(id==='door'){for(const s of [-1,1])box(.14,2.1,.22,s*.53,1.05,0,stone);box(1.2,.14,.22,0,2.1,0,stone);const leaf=box(.9,2,.10,-.3,1,-.25,wood);leaf.rotation.y=-.8}
    if(id==='flat')box(3,.2,2.5,0,0,0,green);
    if(id==='gable')for(const s of [-1,1]){const p=box(3,.15,1.8,0,.5,s*.72,green);p.rotation.x=s*.6}
    if(id==='chimney'){box(.7,1.5,.7,0,.75,0,wood);box(.9,.15,.9,0,1.5,0,stone)}
    return{id:'tool-'+id,tool:id,sourceId:'tool-'+id,name,root,color:null};
  });
  function setRay(event){const b=canvas.getBoundingClientRect();pointer.set((event.clientX-b.left)/b.width*2-1,1-(event.clientY-b.top)/b.height*2);camera.updateMatrixWorld(true);scene.updateMatrixWorld(true);ray.setFromCamera(pointer,camera)}
  function hit(event){setRay(event);return ray.intersectObject(model.root,true)[0]||null}
  function point(event,y=1.02){setRay(event);return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-y),new THREE.Vector3())}
  function message(){if(performance.now()-lastTip>1600){toast(model.lastError||'请在有效的建筑表面上放置');lastTip=performance.now()}}
  function close(commit=true,settle=true){const wasActive=!!selected||!!pending;if(drag){controls.enabled=drag.controlsEnabled;drag=null}pending=null;library=null;selected=null;previewRoot.visible=false;popup.hidden=true;options.hidden=true;handles.update(null,false);ground.visible=false;if(settle&&wasActive&&system.gesturing){if(commit)system.commitGesture();else system.cancelGesture()}}
  function select(id,existingGesture=false){if(!model.getModel(id))return false;if(!existingGesture){close();onSelect();system.beginGesture()}selected=id;onInteract();options.hidden=true;update();return true}
  function active(){return model.find(selected)||model.room(selected?.replace(/-roof$/,''))?.roof}
  function update(){
    model.applyView(camera,selected);
    const g=model.getModel(selected),item=active();popup.hidden=!selected||!g;
    if(!g){ground.visible=false;handles.update(null,false);return}
    const kind=g.userData.buildType,r=model.room(selected),w=model.wall(selected),d=model.door(selected);
    const wallRecord=w?model.getWall(selected):d?{kind:'wall',root:g,lengthAxis:'x',localBounds:new THREE.Box3(new THREE.Vector3(-d.width/2,0,-.1),new THREE.Vector3(d.width/2,d.height,.1))}:null;
    handles.update(wallRecord,enabled&&!!wallRecord);ground.visible=enabled&&!!r;
    if(r){const thick=THREE.MathUtils.clamp(camera.position.distanceTo(g.position)*.004,.09,.25);for(const b of bars){const edge=b.userData.edge,side=edge==='left'||edge==='right',sign=edge==='left'||edge==='back'?-1:1;b.position.set(r.x+(side?sign*r.width/2:0),model.height(r)+.055,r.z+(!side?sign*r.depth/2:0));b.scale.set(side?thick:r.width*.8,1,side?r.depth*.8:thick)}ground.updateMatrixWorld(true)}
    const bounds=new THREE.Box3().setFromObject(g),p=bounds.getCenter(new THREE.Vector3());p.y=bounds.max.y+.25;p.project(camera);const rect=canvas.getBoundingClientRect(),width=Math.min(330,rect.width-16),screenX=rect.left+(p.x+1)*rect.width/2,screenY=rect.top+(1-p.y)*rect.height/2;
    popup.style.width=width+'px';popup.style.left=Math.max(rect.left+8,Math.min(rect.left+rect.width-width-8,screenX-width/2))+'px';popup.style.top=Math.max(rect.top+76,Math.min(rect.top+rect.height-115,screenY-66))+'px';popup.style.visibility=p.z>=-1&&p.z<=1?'visible':'hidden';
    $('build-size').textContent=r?`${r.width.toFixed(2)} × ${r.depth.toFixed(2)} m`:w?`${w.width.toFixed(2)} × ${model.state.height.toFixed(2)} m`:d?`${d.width.toFixed(2)} × ${d.height.toFixed(2)} m`:'';
    $('build-enter').hidden=!r;$('build-rotate').hidden=kind==='chimney'||kind==='roof';$('build-material').hidden=kind==='door'||kind==='chimney';
  }
  function startTool(tool){const libraryState=library;close();library=libraryState;onSelect();onInteract();system.beginGesture();pending=tool;previewRoot.clear();const sample=catalog.find(r=>r.tool===tool)?.root.clone(true);if(sample){sample.traverse(o=>{if(o.isMesh)o.material=previewMaterial});if(tool==='room')sample.scale.set(2,1,2);previewRoot.add(sample)}toast({room:'在空地上放置 6 × 6 米地基',wall:'点击地基边缘添加墙壁',door:'点击新建墙面添加真实门洞',flat:'点击房间添加平顶',gable:'点击房间添加双坡顶',chimney:'点击屋顶摆放烟囱'}[tool])}
  function preview(event){if(!pending)return;const rect=canvas.getBoundingClientRect();previewRoot.visible=event.clientY>=rect.top&&event.clientY<rect.top+rect.height&&event.clientX>=rect.left&&event.clientX<rect.left+rect.width;if(!previewRoot.visible)return;const picked=hit(event),p=pending==='room'?point(event,model.view==='2'?1.02+model.state.height+.2:1.02):picked?.point;if(!p){previewRoot.visible=false;return}previewRoot.position.copy(p);previewMaterial.color.set(pending==='room'||picked?'#85c578':'#de8070');if(pending==='room'){const r=model.snapRoom({id:'preview',x:p.x,z:p.z,width:6,depth:6,level:model.view==='2'?2:1});previewRoot.position.x=r.x;previewRoot.position.z=r.z;previewMaterial.color.set(model.canPlaceRoom(r)?'#85c578':'#de8070')}}
  function place(tool,event){
    const picked=hit(event),id=picked?.object.userData.buildId,type=picked?.object.userData.buildType;let result=false;
    if(tool==='room'){const p=point(event,model.view==='2'?1.02+model.state.height+.2:1.02);if(p)result=model.addRoom(p,model.view==='2'?2:1)}
    else if(tool==='wall'){const r=model.room(id);if(r){const p=picked.point,localX=p.x-r.x,localZ=p.z-r.z,edge=Math.abs(localX/r.width)>Math.abs(localZ/r.depth)?localX<0?'left':'right':localZ<0?'back':'front';result=model.addWall(r.id,edge)}}
    else if(tool==='door'){const w=model.wall(id);if(w){const g=model.getModel(id),p=g.worldToLocal(picked.point.clone());result=model.addDoor(w.id,p.x)}}
    else if(tool==='flat'||tool==='gable'){const r=model.room(id)||model.room(model.wall(id)?.rooms[0])||model.room(id?.replace(/-roof$/,''));if(r&&model.setRoof(r.id,tool))result=r.id+'-roof'}
    else if(tool==='chimney'){const r=type==='roof'?model.room(id.replace(/-roof$/,'')):null;if(r)result=model.addDecoration(r.id,(picked.point.x-r.x)/r.width*2,(picked.point.z-r.z)/r.depth*2)}
    if(result){pending=null;previewRoot.visible=false;select(result,true);return true}message();return false;
  }
  function bindCard(card,record){
    card.addEventListener('pointerdown',e=>{if(e.button!==0||e.isPrimary===false)return;library={pointerId:e.pointerId,x:e.clientX,y:e.clientY,card,tool:record.tool,scroll:card.parentElement?.scrollLeft||0,moved:false,scrolling:false};suppress=false;card.setPointerCapture(e.pointerId)});
    card.addEventListener('click',()=>{if(suppress){suppress=false;return}startTool(record.tool)});
    card.addEventListener('dragstart',e=>e.preventDefault());
    card.addEventListener('lostpointercapture',()=>{if(library?.card===card){const state=library;library=null;if(state.moved&&!state.scrolling)close(false)}});
  }
  function libraryMove(event){if(!library||event.pointerId!==library.pointerId)return;const dx=event.clientX-library.x,dy=event.clientY-library.y;if(!library.moved&&Math.hypot(dx,dy)<8)return;event.preventDefault();event.stopImmediatePropagation();if(!library.moved){library.moved=true;const rect=canvas.getBoundingClientRect();library.scrolling=event.clientY>=rect.top+rect.height&&Math.abs(dx)>Math.abs(dy)*1.3;if(!library.scrolling){const state=library;startTool(state.tool);library=state}}if(library.scrolling){if(library.card.parentElement)library.card.parentElement.scrollLeft=library.scroll-dx;return}preview(event)}
  window.addEventListener('pointermove',libraryMove,{capture:true});
  window.addEventListener('pointerup',e=>{if(!library||e.pointerId!==library.pointerId)return;const state=library;library=null;if(state.card.hasPointerCapture(e.pointerId))state.card.releasePointerCapture(e.pointerId);if(!state.moved)return;suppress=true;e.preventDefault();e.stopImmediatePropagation();if(state.scrolling)return;const b=canvas.getBoundingClientRect();if(e.clientY>=b.top&&e.clientY<b.top+b.height&&e.clientX>=b.left&&e.clientX<b.left+b.width){if(!place(state.tool,e))close(false)}else close(false)},{capture:true});
  canvas.addEventListener('pointerdown',e=>{
    if(!enabled||e.button!==0||e.isPrimary===false)return;
    if(pending){e.preventDefault();e.stopImmediatePropagation();press={x:e.clientX,y:e.clientY,time:e.timeStamp,pending:true,pointerId:e.pointerId};canvas.setPointerCapture(e.pointerId);return}
    setRay(e);update();const resize=handles.pick(ray),roomHandle=ground.visible?ray.intersectObjects(bars)[0]:null;
    const picked=hit(e),id=picked?.object.userData.buildId;
    if(resize||roomHandle||id&&id===selected){
      e.preventDefault();e.stopImmediatePropagation();onInteract();const g=model.getModel(selected),item=model.find(selected);
      const y=g.position.y,origin=point(e,y);if(!origin)return;
      drag={pointerId:e.pointerId,controlsEnabled:controls.enabled,before:system.serialize(),item:clone(item),origin,y,edge:roomHandle?.object.userData.edge,resize:resize?handles.begin(resize.object.userData.resizeEdge,ray,e):null,clientX:e.clientX,clientY:e.clientY};
      controls.enabled=false;canvas.setPointerCapture(e.pointerId);return;
    }
    press={id,x:e.clientX,y:e.clientY,time:e.timeStamp,pointerId:e.pointerId};
  },{capture:true});
  const clone=v=>structuredClone(v);
  canvas.addEventListener('pointermove',e=>{
    if(!enabled)return;if(pending)preview(e);if(press&&Math.hypot(e.clientX-press.x,e.clientY-press.y)>7)press.moved=true;
    if(!drag||drag.pointerId!==e.pointerId)return;e.preventDefault();e.stopImmediatePropagation();if(Math.hypot(e.clientX-drag.clientX,e.clientY-drag.clientY)<4)return;
    const b=drag.item;if(!b)return;setRay(e);let ok=true;
    if(drag.resize){const delta=handles.delta(drag.resize,ray,e),edge=drag.resize.edge;if(b.type==='wall'){
        if(edge==='top')ok=model.setHeight(drag.before.building.height+delta);
        else{const width=THREE.MathUtils.clamp(snap(b.width+(edge==='left'?-delta:delta)),1,24),shift=(width-b.width)/2*(edge==='left'?-1:1);ok=model.updateWall(b.id,{width,x:b.x+Math.cos(b.angle)*shift,z:b.z-Math.sin(b.angle)*shift})}
      }else if(b.type==='door'){if(edge==='top')ok=model.updateDoor(b.id,{height:Math.round((b.height+delta)*20)/20});else{const width=Math.round((b.width+(edge==='left'?-delta:delta))*20)/20,offset=b.offset+(width-b.width)/2*(edge==='left'?-1:1);ok=model.updateDoor(b.id,{width,offset})}}
    }else{const p=point(e,drag.y);if(!p)return;const dx=p.x-drag.origin.x,dz=p.z-drag.origin.z;
      if(b.type==='room'){if(drag.edge){const along=drag.edge==='left'||drag.edge==='right'?'width':'depth',sign=drag.edge==='left'||drag.edge==='back'?-1:1,delta=along==='width'?dx:dz,size=THREE.MathUtils.clamp(snap(b[along]+sign*delta),3,24),axis=along==='width'?'x':'z';ok=model.updateRoom(b.id,{[along]:size,[axis]:b[axis]+sign*(size-b[along])/2})}else{const target=model.snapRoom({...b,x:b.x+dx,z:b.z+dz});ok=model.updateRoom(b.id,{x:target.x,z:target.z})}}
      if(b.type==='wall')ok=model.updateWall(b.id,{x:snap(b.x+dx),z:snap(b.z+dz)});
      if(b.type==='door'){const w=model.wall(b.wallId);ok=model.updateDoor(b.id,{offset:snap(b.offset+dx*Math.cos(w.angle)-dz*Math.sin(w.angle))})}
      if(b.type==='chimney'){const r=model.room(b.roomId),d=model.find(b.id);d.u=THREE.MathUtils.clamp(b.u+dx/r.width*2,-.8,.8);d.v=THREE.MathUtils.clamp(b.v+dz/r.depth*2,-.8,.8);model.redraw()}
    }if(!ok)message();update();
  },{capture:true});
  function stopDrag(cancel=false){if(!drag)return;const before=drag;drag=null;controls.enabled=before.controlsEnabled;if(cancel)system.load(before.before);if(canvas.hasPointerCapture(before.pointerId))canvas.releasePointerCapture(before.pointerId);update()}
  canvas.addEventListener('pointerup',e=>{
    if(drag?.pointerId===e.pointerId){e.preventDefault();e.stopImmediatePropagation();stopDrag();return}
    if(!enabled||!press||press.pointerId!==e.pointerId)return;const before=press;press=null;
    if(before.pending){e.preventDefault();e.stopImmediatePropagation();if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(!before.moved)place(pending,e);return}
    if(before.moved||e.timeStamp-before.time>400)return;const picked=hit(e);if(before.id&&picked?.object.userData.buildId===before.id){e.preventDefault();e.stopImmediatePropagation();select(before.id)}else if(!before.id&&selected)close();
  },{capture:true});
  canvas.addEventListener('lostpointercapture',()=>stopDrag(true));
  function cancelPointer(){press=null;stopDrag(true);if(library){const state=library;library=null;suppress=true;if(state.moved&&!state.scrolling)close(false)}}
  window.addEventListener('pointercancel',cancelPointer,{capture:true});window.addEventListener('blur',cancelPointer);
  window.addEventListener('keydown',e=>{if(!(pending||selected))return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close(false)}else if((e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())){e.preventDefault();e.stopImmediatePropagation();close(false);if(e.key.toLowerCase()==='y'||e.shiftKey)system.redo();else system.undo()}},{capture:true});
  $('build-confirm').addEventListener('click',()=>close());$('build-cancel').addEventListener('click',()=>close(false));
  $('build-remove').addEventListener('click',()=>{if(model.remove(selected))close();else message()});
  $('build-rotate').addEventListener('click',()=>{const w=model.wall(selected),d=model.door(selected),r=model.room(selected);let ok=true;if(w)ok=model.updateWall(w.id,{angle:w.angle+Math.PI/12});else if(d)ok=model.updateDoor(d.id,{open:!d.open});else if(r)ok=model.rotateRoom(r.id);if(!ok)message();update()});
  function choices(list,callback){options.replaceChildren();options.hidden=false;for(const option of list){const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',option.name);b.title=option.name;if(option.preview)b.style.backgroundImage=`url("${option.preview}")`;if(option.color)b.style.backgroundColor=option.color;b.addEventListener('click',()=>{callback(option.id);update()});options.append(b)}}
  $('build-color').addEventListener('click',()=>choices(model.colors.map((color,i)=>({id:color,color,name:'配色 '+(i+1)})),color=>model.color(selected,color)));
  $('build-material').addEventListener('click',()=>{if(model.room(selected))choices(system.floorSystem.styles,id=>model.setStyle(selected,id));else if(model.wall(selected))choices(system.architecture.styles,id=>model.setStyle(selected,id));else{const r=model.room(selected?.replace(/-roof$/,''));if(r)model.setRoof(r.id,r.roof.style==='flat'?'gable':'flat')}});
  function setView(value,focusRoom=null){close();model.setView(value);onView(String(value),focusRoom);update()}
  $('build-enter').addEventListener('click',()=>{const r=model.room(selected);if(r)setView(r.level,r)});
  return{catalog,bindCard,startTool,select,close,dismiss:()=>close(true,false),setView,update,setEnabled:value=>{enabled=value;if(!value)close()},get dragging(){return!!drag||!!library?.moved},get active(){return!!selected||!!pending},get selectedId(){return selected}};
}
