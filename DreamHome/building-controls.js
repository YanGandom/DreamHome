import {decorateLock} from './progression.js';
import {createLibraryCarry} from './library-carry.js';
import {createOutdoorPlot} from './outdoor-plots.js';
import * as THREE from './vendor/three.module.js';
import {pickSceneSurface} from './scene-picking.js';
import {createWallHandles,setResizeStripActive} from './wall-handles.js';
import {snap,addWallCrown} from './building-system.js';
import {createRoomFoundation,GROUND_TOP,ORIGINAL_FOUNDATION_COLOR} from './foundation-system.js';

export function createBuildingControls({scene,camera,renderer,controls,system,occluders=[],toast,onInteract,onSelect=()=>{},onLooseSelect=()=>{},onView=()=>{}}){
  const model=system.construction;if(!model)return null;
  const carry=createLibraryCarry();let pendingControls=null;
  function endCarry(){carry.hide();if(pendingControls!==null){controls.enabled=pendingControls;pendingControls=null}}
  const canvas=renderer.domElement,$=id=>document.getElementById(id),popup=$('build-ui'),options=$('build-options'),deleteDialog=$('foundation-delete-dialog');
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),handles=createWallHandles(scene,camera,canvas),ground=new THREE.Group(),bars=[];
  handles.root.name='BuildingWallHandles';ground.name='FoundationHandles';scene.add(ground);ground.visible=false;
  for(const [edge,bar]of Object.entries(handles.bars))bar.name='BuildingResize-'+edge;
  for(const edge of ['left','right','back','front']){const m=new THREE.Mesh(new THREE.BoxGeometry(1,.065,1),new THREE.MeshBasicMaterial({color:'#80cf7b',transparent:true,opacity:.85,depthTest:false,depthWrite:false,toneMapped:false}));m.userData.edge=edge;m.renderOrder=24;bars.push(m);ground.add(m)}
  const highlightGround=edge=>bars.forEach(bar=>setResizeStripActive(bar,bar.userData.edge===edge));
  const previewRoot=new THREE.Group(),previewMaterial=new THREE.MeshBasicMaterial({color:'#85c578',transparent:true,opacity:.42,depthWrite:false});previewRoot.name='ConstructionPreview';previewRoot.userData.editorHelper=true;previewRoot.visible=false;scene.add(previewRoot);
  let enabled=false,selected=null,drag=null,press=null,pending=null,library=null,suppress=false,lastTip=0,deleteId=null,deleteControlsEnabled=true,optionMode=null;
  const tools=[['room','房间地基'],['upper','二层地板'],['ground','地面'],['paving','室外地砖'],['garden','砖边花草地'],['wall','墙壁'],['door','门与门洞'],['flat','平屋顶'],['gable','双坡屋顶'],['chimney','烟囱']];
  const catalog=tools.map(([id,name])=>{const root=new THREE.Group(),mat=(c)=>new THREE.MeshStandardMaterial({color:c,roughness:.8}),stone=mat('#e0cfb3'),green=mat('#628578'),wood=mat('#a78359');
    const box=(w,h,d,x,y,z,m)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);root.add(o);return o};
    if(id==='room'){
      const foundation=createRoomFoundation({width:6,depth:6,material:mat});root.add(foundation.root);
      foundation.base.material=wood;const lower=new THREE.Group();lower.name='PreviewOutdoorGround';root.add(lower);
      for(const [w,h,y,m]of [[7.8,.73,-1.425,mat('#c3b29c')],[8,.18,-.97,mat('#e8d3b3')]]){const slab=box(w,h,w,0,y,0,m);lower.add(slab)}
    }
    if(id==='upper'){const slab=createRoomFoundation({width:6,depth:2,level:2,color:'#824920',material:mat});slab.base.material=wood;root.add(slab.root)}
    if(id==='paving'||id==='garden')root.add(createOutdoorPlot({width:4,depth:3,style:model.outdoorStyles.find(s=>s.id===(id==='garden'?'grass':'stone')),material:(c,o)=>new THREE.MeshStandardMaterial({color:c,...o})}));
    if(id==='wall'){box(3,2.18,.2,0,1.09,0,stone);addWallCrown(root,3,2.3,mat)}
    if(id==='ground'){box(5.8,.73,5.8,0,-.545,0,mat('#c3b29c'));box(6,.18,6,0,-.09,0,mat('#e8d3b3'))}
    if(id==='door'){for(const s of [-1,1])box(.14,2.1,.22,s*.53,1.05,0,stone);box(1.2,.14,.22,0,2.1,0,stone);const leaf=box(.9,2,.10,-.3,1,-.25,wood);leaf.rotation.y=-.8}
    if(id==='flat')box(3,.2,2.5,0,0,0,green);
    if(id==='gable')for(const s of [-1,1]){const p=box(3,.15,1.8,0,.5,s*.72,green);p.rotation.x=s*.6}
    if(id==='chimney'){box(.7,1.5,.7,0,.75,0,wood);box(.9,.15,.9,0,1.5,0,stone)}
    return{id:'tool-'+id,tool:id,sourceId:'tool-'+id,name,root,color:null};
  });
  for(const record of catalog.filter(r=>['flat','gable','chimney','door'].includes(r.tool)))system.registerLooseTemplate(record);
  function setRay(event){const b=canvas.getBoundingClientRect();pointer.set((event.clientX-b.left)/b.width*2-1,1-(event.clientY-b.top)/b.height*2);camera.updateMatrixWorld(true);scene.updateMatrixWorld(true);ray.setFromCamera(pointer,camera)}
  function hit(event){
    setRay(event);const picked=pickSceneSurface(ray,{system,occluders});if(!picked)return null;
    if(picked.object.userData.buildId||pending==='wall'&&system.get(picked.object.userData.furnitureId)?.kind==='wall')return picked;
    let onGround=false;for(let o=picked.object;o;o=o.parent)if(o===model.ground.root){onGround=true;break}
    if(!onGround)return null;
    const plot=model.groundAt(picked.point.x,picked.point.z,selected);return plot?{...picked,object:model.getModel(plot.id)}:null;
  }
  function point(event,y=1.02){setRay(event);return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-y),new THREE.Vector3())}
  function message(){if(performance.now()-lastTip>1600){toast(model.lastError||'请在有效的建筑表面上放置');lastTip=performance.now()}}
  function closeDelete(){if(!deleteId)return;deleteId=null;if(deleteDialog.open)deleteDialog.close();deleteDialog.hidden=true;controls.enabled=deleteControlsEnabled}
  function close(commit=true,settle=true){endCarry();closeDelete();const wasActive=!!selected||!!pending;if(drag){controls.enabled=drag.controlsEnabled;drag=null}highlightGround(null);pending=null;library=null;press=null;selected=null;previewRoot.visible=false;popup.hidden=true;options.hidden=true;handles.update(null,false);ground.visible=false;if(settle&&wasActive&&system.gesturing){if(commit)system.commitGesture();else system.cancelGesture()}}
  function select(id,existingGesture=false){if(!model.getModel(id))return false;if(!existingGesture){close();onSelect();system.beginGesture()}selected=id;onInteract();optionMode=null;options.hidden=true;update();return true}
  function active(){return model.find(selected)||model.room(selected?.replace(/-roof$/,''))?.roof}
  function update(){
    model.applyView(camera,selected);
    if(deleteId){popup.hidden=true;options.hidden=true;handles.update(null,false);ground.visible=false;return}
    const g=model.getModel(selected),item=active();popup.hidden=!selected||!g;
    if(!g){ground.visible=false;handles.update(null,false);return}
    const kind=g.userData.buildType,r=model.room(selected)||model.groundPlot(selected)||model.paving(selected),w=model.wall(selected),d=model.door(selected);
    $('build-floor-rotate').hidden=kind!=='room'||options.hidden||optionMode!=='floor';$('build-floor-rotate').textContent='↻ '+(item?.floorRotation||0)+'°';
    const wallRecord=w?model.getWall(selected):d?{kind:'wall',root:g,lengthAxis:'x',localBounds:new THREE.Box3(new THREE.Vector3(-d.width/2,0,-.1),new THREE.Vector3(d.width/2,d.height,.1))}:null;
    handles.update(wallRecord,enabled&&!!wallRecord);ground.visible=enabled&&!!r&&system.levelRule?.lockedFoundation?.id!==r.id;
    if(r){const thick=THREE.MathUtils.clamp(camera.position.distanceTo(g.position)*.004,.09,.25);for(const b of bars){const edge=b.userData.edge,side=edge==='left'||edge==='right',sign=edge==='left'||edge==='back'?-1:1;b.position.set(r.x+(side?sign*r.width/2:0),model.height(r)+.055,r.z+(!side?sign*r.depth/2:0));b.scale.set(side?thick:r.width*.8,1,side?r.depth*.8:thick)}ground.updateMatrixWorld(true)}
    const bounds=kind==='paving'?new THREE.Box3(new THREE.Vector3(r.x-r.width/2,model.height(r),r.z-r.depth/2),new THREE.Vector3(r.x+r.width/2,model.height(r)+.22,r.z+r.depth/2)):kind==='ground'?new THREE.Box3(new THREE.Vector3(r.x-r.width/2,GROUND_TOP-.91,r.z-r.depth/2),new THREE.Vector3(r.x+r.width/2,GROUND_TOP,r.z+r.depth/2)):new THREE.Box3().setFromObject(g),p=bounds.getCenter(new THREE.Vector3());p.y=bounds.max.y+.25;p.project(camera);const rect=canvas.getBoundingClientRect(),width=Math.min(330,rect.width-16),screenX=rect.left+(p.x+1)*rect.width/2,screenY=rect.top+(1-p.y)*rect.height/2;
    popup.style.width=width+'px';popup.style.left=Math.max(rect.left+8,Math.min(rect.left+rect.width-width-8,screenX-width/2))+'px';popup.style.top=Math.max(rect.top+76,Math.min(rect.top+rect.height-(options.hidden?115:optionMode==='floor'?230:185),screenY-66))+'px';popup.style.visibility=p.z>=-1&&p.z<=1?'visible':'hidden';
    $('build-size').textContent=r?`${r.width.toFixed(2)} × ${r.depth.toFixed(2)} m`:w?`${w.width.toFixed(2)} × ${model.state.height.toFixed(2)} m`:d?`${d.width.toFixed(2)} × ${d.height.toFixed(2)} m`:'';
    $('build-cancel').hidden=['room','ground','paving'].includes(kind);$('build-rotate').hidden=kind==='chimney'||kind==='roof'||system.levelRule?.lockedFoundation?.id===selected;$('build-material').hidden=['door','chimney','ground'].includes(kind);$('build-color').hidden=['ground','paving'].includes(kind);
    if(!options.hidden)for(const button of options.children){const chosen=button.dataset.color?button.dataset.color===item?.color:button.dataset.style===(item?.floorStyle||item?.style);button.classList.toggle('active',chosen);if(button.dataset.color||button.dataset.style)button.setAttribute('aria-pressed',String(chosen));decorateLock(button,system.progression,button.dataset.rewardOption,true)}
  }
  function startTool(tool){const libraryState=library;close();library=libraryState;onSelect();onInteract();system.beginGesture();pending=tool;previewRoot.clear();previewRoot.scale.set(1,1,1);const sample=catalog.find(r=>r.tool===tool)?.root.clone(true);if(sample){sample.traverse(o=>{if(o.isMesh)o.material=previewMaterial});if(tool==='room'&&model.view==='2')sample.getObjectByName('PreviewOutdoorGround').visible=false;previewRoot.add(sample)}toast({paving:'摆放室外铺装，拖动四边调整长宽，材质按钮更换地砖',garden:'摆放带砖边的花草地，材质按钮选择四种样式',room:'在空地上放置 6 × 6 米地基（最大 20 × 20 米）',upper:'自由摆放二层地板，可更换花纹和调整尺寸',ground:'摆放 6 × 6 米地面，可与周围地面融合',wall:'自由摆放墙壁，放到地基上自动吸附四边，每段最高 6 米',door:'点击新建墙面添加真实门洞',flat:'点击房间添加平顶',gable:'点击房间添加双坡顶',chimney:'点击屋顶摆放烟囱'}[tool])}
  function preview(event){if(!pending)return;const rect=canvas.getBoundingClientRect();previewRoot.visible=event.clientY>=rect.top&&event.clientY<rect.top+rect.height&&event.clientX>=rect.left&&event.clientX<rect.left+rect.width;carry.move(event,!previewRoot.visible);carry.move(event,!previewRoot.visible);if(!previewRoot.visible)return;if(pending==='upper'){const p=upperPoint(event);if(!p){previewRoot.visible=false;return}const draft=model.upperDraft(p);previewRoot.position.set(draft.x,model.height(draft),draft.z);previewRoot.scale.set(draft.width/6,1,draft.depth/2);previewMaterial.color.set(model.canPlaceRoom(draft)?'#85c578':'#de8070');return}const picked=hit(event),p=['ground','paving','garden'].includes(pending)?point(event,GROUND_TOP+.01):pending==='room'?point(event,model.view==='2'?1.02+model.state.height+.2:1.02):picked?.point||point(event,GROUND_TOP+.01);if(!p){previewRoot.visible=false;return}previewRoot.position.copy(p);previewMaterial.color.set(['room','ground'].includes(pending)||picked||['wall','flat','gable','chimney','door'].includes(pending)?'#85c578':'#de8070');if(pending==='room'){const r=model.snapRoom({id:'preview',x:p.x,z:p.z,width:6,depth:6,level:model.view==='2'?2:1});previewRoot.position.x=r.x;previewRoot.position.z=r.z;previewMaterial.color.set(model.canPlaceRoom(r)?'#85c578':'#de8070')}else if(pending==='ground'){const r={x:snap(p.x),z:snap(p.z),width:6,depth:6};previewRoot.position.x=r.x;previewRoot.position.z=r.z;previewMaterial.color.set(model.validGround(r)?'#85c578':'#de8070')}}
  function upperPoint(event){const p=point(event,1.02+model.state.height+.2);if(!p)return null;const draft=model.upperDraft(p);return point(event,model.height(draft))}
  function place(tool,event){
    const picked=hit(event),id=picked?.object.userData.buildId,type=picked?.object.userData.buildType;let result=false;
    if(tool==='room'){const p=point(event,model.view==='2'?1.02+model.state.height+.2:1.02);if(p)result=model.addRoom(p,model.view==='2'?2:1)}
    else if(tool==='upper'){const p=upperPoint(event);if(p)result=model.addUpper(p)}
    else if(tool==='paving'||tool==='garden'){const p=point(event,GROUND_TOP+.01);if(p)result=model.addPaving(p,tool==='garden'?'garden':'tiles')}
    else if(tool==='ground'){const p=point(event,GROUND_TOP);if(p)result=model.addGround(p)}
    else if(tool==='wall'){const base=system.get(picked?.object.userData.furnitureId);if(base?.kind==='wall'&&picked.face.normal.y>.5)result=model.addStackedWall(base.id);const r=!result&&model.room(id);if(r){const p=picked.point,localX=p.x-r.x,localZ=p.z-r.z,edge=Math.abs(localX/r.width)>Math.abs(localZ/r.depth)?localX<0?'left':'right':localZ<0?'back':'front';result=model.addWall(r.id,edge)}if(!result&&!base){const p=point(event,GROUND_TOP+.01);if(p)result=model.addFreeWall(p)}}
    else if(tool==='door'){const w=model.wall(id);if(w){const g=model.getModel(id),p=g.worldToLocal(picked.point.clone());result=model.addDoor(w.id,p.x)}}
    else if(tool==='flat'||tool==='gable'){const r=model.room(id)||model.room(model.wall(id)?.rooms[0])||model.room(id?.replace(/-roof$/,''));if(r&&model.setRoof(r.id,tool))result=r.id+'-roof'}
    else if(tool==='chimney'){const r=type==='roof'?model.room(id.replace(/-roof$/,'')):null;if(r)result=model.addDecoration(r.id,(picked.point.x-r.x)/r.width*2,(picked.point.z-r.z)/r.depth*2)}
    if(!result&&['flat','gable','chimney','door'].includes(tool)){const p=point(event,GROUND_TOP+.01);if(p){const r=system.add('loose-'+tool,p);if(r){pending=null;endCarry();previewRoot.visible=false;onLooseSelect(r.id);return true}}}
    if(result){pending=null;endCarry();previewRoot.visible=false;select(result,true);return true}message();return false;
  }
  function bindCard(card,record){
    card.addEventListener('pointerdown',e=>{if(e.button!==0||e.isPrimary===false)return;library={pointerId:e.pointerId,x:e.clientX,y:e.clientY,card,tool:record.tool,scroll:card.parentElement?.scrollLeft||0,moved:false,scrolling:false};suppress=false;card.setPointerCapture(e.pointerId)});
    card.addEventListener('click',event=>{if(suppress){suppress=false;return}startTool(record.tool);pendingControls=controls.enabled;controls.enabled=false;carry.start(card,event)});
    card.addEventListener('dragstart',e=>e.preventDefault());
    card.addEventListener('lostpointercapture',()=>{if(library?.card===card){const state=library;library=null;if(state.moved&&!state.scrolling)close(false)}});
  }
  function libraryMove(event){if(!library||event.pointerId!==library.pointerId)return;const dx=event.clientX-library.x,dy=event.clientY-library.y;if(!library.moved&&Math.hypot(dx,dy)<8)return;event.preventDefault();event.stopImmediatePropagation();if(!library.moved){library.moved=true;const rect=canvas.getBoundingClientRect();library.scrolling=event.clientY>=rect.top+rect.height&&Math.abs(dx)>Math.abs(dy)*1.3;if(!library.scrolling){const state=library;startTool(state.tool);pendingControls=controls.enabled;controls.enabled=false;carry.start(state.card,event);library=state}}if(library.scrolling){if(library.card.parentElement)library.card.parentElement.scrollLeft=library.scroll-dx;return}preview(event)}
  window.addEventListener('pointermove',event=>{if(pending&&!library)preview(event);else libraryMove(event)},{capture:true});
  window.addEventListener('pointerup',e=>{if(!library||e.pointerId!==library.pointerId)return;const state=library;library=null;if(state.card.hasPointerCapture(e.pointerId))state.card.releasePointerCapture(e.pointerId);if(!state.moved)return;suppress=true;e.preventDefault();e.stopImmediatePropagation();if(state.scrolling)return;const b=canvas.getBoundingClientRect();if(e.clientY>=b.top&&e.clientY<b.top+b.height&&e.clientX>=b.left&&e.clientX<b.left+b.width){if(!place(state.tool,e))close(false)}else close(false)},{capture:true});
  canvas.addEventListener('pointerdown',e=>{
    if(deleteId){e.preventDefault();e.stopImmediatePropagation();return}
    if(!enabled||e.button!==0||e.isPrimary===false)return;
    if(pending){e.preventDefault();e.stopImmediatePropagation();press={x:e.clientX,y:e.clientY,time:e.timeStamp,pending:true,pointerId:e.pointerId};canvas.setPointerCapture(e.pointerId);return}
    setRay(e);update();const resize=handles.pick(ray),roomHandle=ground.visible?ray.intersectObjects(bars)[0]:null;
    const picked=hit(e),id=picked?.object.userData.buildId;
    if(resize||roomHandle||id&&id===selected){
      e.preventDefault();e.stopImmediatePropagation();onInteract();const g=model.getModel(selected),item=model.find(selected);
      if(system.levelRule?.lockedFoundation?.id===selected)return;
      const y=g.position.y,origin=point(e,y);if(!origin)return;
      drag={pointerId:e.pointerId,controlsEnabled:controls.enabled,before:system.serialize(),item:clone(item),origin,y,edge:roomHandle?.object.userData.edge,resize:resize?handles.begin(resize.object.userData.resizeEdge,ray,e):null,clientX:e.clientX,clientY:e.clientY};
      highlightGround(drag.edge);
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
      if(['room','ground','paving'].includes(b.type)){const update=b.type==='paving'?model.updatePaving:b.type==='ground'?model.updateGround:model.updateRoom;if(drag.edge){const along=drag.edge==='left'||drag.edge==='right'?'width':'depth',sign=drag.edge==='left'||drag.edge==='back'?-1:1,delta=along==='width'?dx:dz,size=THREE.MathUtils.clamp(snap(b[along]+sign*delta),b.type==='paving'||b.type==='room'&&b.level===2?1:3,b.type==='ground'?24:model.limits.maxSize),axis=along==='width'?'x':'z';ok=update(b.id,{[along]:size,[axis]:b[axis]+sign*(size-b[along])/2})}else{const target=b.type!=='room'?{x:snap(b.x+dx),z:snap(b.z+dz)}:model.snapRoom({...b,x:b.x+dx,z:b.z+dz});ok=update(b.id,{x:target.x,z:target.z})}}
      if(b.type==='wall')ok=model.updateWall(b.id,{x:snap(b.x+dx),z:snap(b.z+dz)});
      if(b.type==='door'){const w=model.wall(b.wallId);ok=model.updateDoor(b.id,{offset:snap(b.offset+dx*Math.cos(w.angle)-dz*Math.sin(w.angle))})}
      if(b.type==='chimney'){const r=model.room(b.roomId),d=model.find(b.id);d.u=THREE.MathUtils.clamp(b.u+dx/r.width*2,-.8,.8);d.v=THREE.MathUtils.clamp(b.v+dz/r.depth*2,-.8,.8);model.redraw()}
    }if(!ok)message();update();
  },{capture:true});
  function stopDrag(cancel=false){if(!drag)return;const before=drag;drag=null;handles.setActive(null);highlightGround(null);controls.enabled=before.controlsEnabled;if(cancel)system.load(before.before);if(canvas.hasPointerCapture(before.pointerId))canvas.releasePointerCapture(before.pointerId);update()}
  canvas.addEventListener('pointerup',e=>{
    if(drag?.pointerId===e.pointerId){e.preventDefault();e.stopImmediatePropagation();stopDrag();return}
    if(!enabled||!press||press.pointerId!==e.pointerId)return;const before=press;press=null;
    if(before.pending){e.preventDefault();e.stopImmediatePropagation();if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);place(pending,e);return}
    // This press reached OrbitControls, so its release must reach it too.
    // Only suppress the competing floor/object selection, not pointer cleanup.
    if(before.moved||e.timeStamp-before.time>400)return;const picked=hit(e);if(before.id&&picked?.object.userData.buildId===before.id){e.preventDefault();e.buildingHandled=true;select(before.id)}else if(!before.id&&selected)close();
  },{capture:true});
  canvas.addEventListener('lostpointercapture',()=>stopDrag(true));
  function cancelPointer(){press=null;stopDrag(true);if(library){const state=library;library=null;suppress=true;if(state.moved&&!state.scrolling)close(false)}}
  window.addEventListener('pointercancel',cancelPointer,{capture:true});window.addEventListener('blur',()=>{cancelPointer();if(pending)close(false)});
  window.addEventListener('keydown',e=>{if(!(pending||selected))return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close(!!deleteId)}else if((e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())){e.preventDefault();e.stopImmediatePropagation();close(false);if(e.key.toLowerCase()==='y'||e.shiftKey)system.redo();else system.undo()}},{capture:true});
  $('build-confirm').addEventListener('click',()=>close());$('build-cancel').addEventListener('click',()=>close(false));
  $('build-remove').addEventListener('click',()=>{
    if(deleteId||!selected)return;
    const contents=model.removalContents(selected);
    if(contents?.count){deleteId=selected;deleteControlsEnabled=controls.enabled;controls.enabled=false;onInteract();press=null;update();deleteDialog.hidden=false;deleteDialog.showModal();$('foundation-delete-no').focus();return}
    if(contents?model.removeFoundation(selected):model.remove(selected))close();else message();
  });
  $('foundation-delete-yes').addEventListener('click',()=>{const id=deleteId;if(!id)return;closeDelete();if(model.removeFoundation(id))close();else{message();update()}});
  $('foundation-delete-no').addEventListener('click',()=>close());
  deleteDialog.addEventListener('cancel',e=>{e.preventDefault();close()});
  deleteDialog.addEventListener('click',e=>{if(e.target===deleteDialog)close()});
  $('build-rotate').addEventListener('click',()=>{const w=model.wall(selected),d=model.door(selected),r=model.room(selected);let ok=true;if(w)ok=model.updateWall(w.id,{angle:w.angle+Math.PI/12});else if(d)ok=model.updateDoor(d.id,{open:!d.open});else if(r)ok=model.rotateRoom(r.id);else if(model.paving(selected))ok=model.rotatePaving(selected);else if(model.groundPlot(selected))ok=model.rotateGround(selected);if(!ok)message();update()});
  function choices(list,callback,kind=null){optionMode=kind;options.replaceChildren();options.hidden=false;for(const option of list){const b=document.createElement('button');b.type='button';b.dataset.rewardOption=option.id;b.setAttribute('aria-label',option.name);b.title=option.name;if(kind==='floor'||kind==='outdoor')b.dataset.style=option.id;if(option.preview)b.style.backgroundImage=`url("${option.preview}")`;if(option.color){b.dataset.color=option.color;b.style.backgroundImage='none';b.style.backgroundColor=option.color}b.addEventListener('click',()=>{callback(option.id);update()});options.append(b)}update()}
  $('build-color').addEventListener('click',()=>choices((model.room(selected)?model.foundationColors:model.colors).map((color,i)=>({id:color,color,name:color===ORIGINAL_FOUNDATION_COLOR?'原场景地基色':'配色 '+(i+1)})),color=>model.color(selected,color)));
  $('build-material').addEventListener('click',()=>{if(model.paving(selected))choices(model.outdoorStyles.filter(s=>s.family===model.paving(selected).family),id=>model.setStyle(selected,id),'outdoor');else if(model.room(selected))choices(system.floorSystem.styles,id=>model.setStyle(selected,id),'floor');else if(model.wall(selected))choices(system.architecture.styles,id=>model.setStyle(selected,id));else{const r=model.room(selected?.replace(/-roof$/,''));if(r)model.setRoof(r.id,r.roof.style==='flat'?'gable':'flat')}});
  $('build-floor-rotate').addEventListener('click',()=>{if(model.room(selected)&&optionMode==='floor'){model.rotateFloor(selected);update()}});
  function setView(value,focusRoom=null){close();model.setView(value);onView(String(value),focusRoom);update()}
  return{catalog,bindCard,startTool,select,close,dismiss:()=>close(true,false),setView,update,setEnabled:value=>{enabled=value;if(!value)close()},get dragging(){return!!drag||!!library?.moved},get active(){return!!selected||!!pending},get selectedId(){return selected}};
}
