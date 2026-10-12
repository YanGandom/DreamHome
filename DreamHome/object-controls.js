import {decorateLock} from './progression.js';
import {woodFinishesFor} from './railing-system.js';
import * as THREE from './vendor/three.module.js';
import {pickSceneSurface} from './scene-picking.js';
import {createGroundSelection} from './ground-selection.js';
import {createFloorControls} from './floor-controls.js';
import {createWallHandles} from './wall-handles.js';

const PALETTE=[['森林绿','#437244'],['奶油白','#e7d5af'],['蜂蜜黄','#d9a449'],['酒红','#963d43'],['雾蓝','#638b9c'],['玫瑰粉','#c58b91']];
const TAP_MS=350,TAP_DISTANCE=7;
const ROTATION_STEP=30;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
export const ROTATION_ARC={width:360,height:118,cx:180,cy:276,radius:250,halfAngle:Math.asin(.6)};
export function arcPoint(degrees){const a=(clamp(degrees,0,360)/180-1)*ROTATION_ARC.halfAngle;return{x:ROTATION_ARC.cx+ROTATION_ARC.radius*Math.sin(a),y:ROTATION_ARC.cy-ROTATION_ARC.radius*Math.cos(a)}}
export function angleFromArcPoint(x,y){const a=clamp(Math.atan2(x-ROTATION_ARC.cx,ROTATION_ARC.cy-y),-ROTATION_ARC.halfAngle,ROTATION_ARC.halfAngle);return Math.round((a/ROTATION_ARC.halfAngle+1)*180)}
export function compactButtonArc(width,diameters){
  const halfChord=(width-60)/2,radius=halfChord*1.8,oldHalf=Math.asin(halfChord/radius),oldDistance=2*radius*Math.sin(oldHalf/(diameters.length-1));
  const steps=diameters.slice(1).map((d,i)=>{const edges=(d+diameters[i])/2;return 2*Math.asin((edges+Math.max(0,oldDistance-edges)/2)/(2*radius))});
  let angle=-steps.reduce((sum,a)=>sum+a,0)/2;
  return diameters.map((_,i)=>{if(i)angle+=steps[i-1];return{x:width/2+radius*Math.sin(angle),y:24+radius*(1-Math.cos(angle))}});
}

export function createObjectControls({scene,camera,renderer,controls,system,occluders=[],onInteract=()=>{},onSelection=()=>{},onRemove=()=>{}}){
  const $=id=>document.getElementById(id),canvas=renderer.domElement;
  const popup=$('object-ui'),arc=$('rotation-arc'),palette=$('object-palette');
  const arcStart=arcPoint(0);
  $('arc-ticks').setAttribute('d',Array.from({length:360/ROTATION_STEP+1},(_,i)=>i*ROTATION_STEP).map(value=>{const p=arcPoint(value),nx=(p.x-ROTATION_ARC.cx)/ROTATION_ARC.radius,ny=(p.y-ROTATION_ARC.cy)/ROTATION_ARC.radius;return `M${p.x+nx*10} ${p.y+ny*10}l${nx*6} ${ny*6}`}).join(' '));
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const groundSelection=createGroundSelection(scene);
  const wallHandles=createWallHandles(scene,camera,canvas);
  const floorControls=system.floorSystem?createFloorControls({camera,renderer,system,onInteract,onSelection:id=>onSelection(null,id?'floor':null,id)}):null;
  let selectedId=null,mode=null,enabled=true,press=null,moving=null,arcDrag=null,rotationValue=0,lastHover=0,layoutWidth=0;
  const active=()=>{const r=system.get(selectedId);return r?.root.visible?r:null};
  const degrees=r=>(THREE.MathUtils.radToDeg(r.root.rotation.y)%360+360)%360;
  const isOperation=()=>['rotate','move','color','material'].includes(mode);

  function render(){
    const r=active();syncPalette(r);popup.hidden=!enabled||!r;groundSelection.update(enabled?r:null,mode==='move');wallHandles.update(r,enabled&&mode==='move');
    if(!r)return;
    popup.dataset.mode=mode;
    $('object-actions').hidden=['color','material'].includes(mode);$('object-rotation').hidden=mode!=='rotate';$('object-palette-panel').hidden=mode!=='color';$('object-finish').hidden=false;
    const wall=r.kind==='wall',special=['rotate','material'].includes(mode);
    $('object-color').hidden=special||r.kind==='scatter';$('object-delete').hidden=special;
    $('object-material').hidden=!wall||special;$('object-rotate').hidden=r.kind==='scatter';
    $('object-material-panel').hidden=mode!=='material';
    if(wall)for(const button of $('wall-material-options').children){decorateLock(button,system.progression,button.dataset.material,true);button.classList.toggle('active',button.dataset.material===r.wallMaterial)}
    for(const action of ['rotate','color']){const button=$('object-'+action);button.classList.toggle('active',mode===action);button.setAttribute('aria-pressed',String(mode===action))}
    const color=r.color||'#'+r.paint[0].color.getHexString();
    for(const button of palette.children){decorateLock(button,system.progression,button.dataset.color,true);const selected=button.dataset.color===color;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected))}
    const p=arcPoint(rotationValue),start=`M${arcStart.x} ${arcStart.y}`;for(const id of ['arc-thumb','arc-thumb-hit']){$(id).setAttribute('cx',p.x);$(id).setAttribute('cy',p.y)}$('arc-progress').setAttribute('d',rotationValue===0?start:`${start} A${ROTATION_ARC.radius} ${ROTATION_ARC.radius} 0 0 1 ${p.x} ${p.y}`);$('arc-value').textContent=rotationValue+'°';arc.setAttribute('aria-valuenow',String(rotationValue));arc.setAttribute('aria-valuetext',rotationValue+' 度');
    layoutButtons();update();
  }
  function layoutButtons(){
    const width=popup.offsetWidth||360;
    const wall=active()?.kind==='wall';
    const buttons=mode==='color'?[...palette.children]:mode==='material'?[...$('wall-material-options').children]:(active()?.kind==='scatter'?['delete']:mode==='rotate'?['rotate']:wall?['rotate','color','material','delete']:['rotate','color','delete']).map(action=>$('object-'+action));
    buttons.push($('object-confirm'));
    const points=compactButtonArc(width,buttons.map(b=>b.offsetWidth||(b.dataset.color?38:44))),sliderHeight=ROTATION_ARC.height*(width-104)/ROTATION_ARC.width,offset=mode==='rotate'?sliderHeight+4:0;
    buttons.forEach((button,i)=>{button.style.left=points[i].x+'px';button.style.top=points[i].y+offset+'px'});
    $('object-rotation').style.top='0px';
    popup.style.height=Math.max(...points.map(p=>p.y))+offset+24+'px';layoutWidth=width;
    $('arc-thumb-hit').setAttribute('r',Math.max(22,24/arcScale()));
  }
  function update(){
    floorControls?.update();
    const r=active(),box=groundSelection.update(enabled?r:null,mode==='move');wallHandles.update(r,enabled&&mode==='move');if(!r)return;
    // Freeze the screen-space slider while it is held, even as bounds rotate.
    if(arcDrag)return;
    if((popup.offsetWidth||360)!==layoutWidth)layoutButtons();
    camera.updateMatrixWorld();const rect=canvas.getBoundingClientRect();
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,inFront=false;
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
      const p=new THREE.Vector3(x,y,z).project(camera);if(p.z>=-1&&p.z<=1)inFront=true;
      const sx=rect.left+(p.x+1)*rect.width/2,sy=rect.top+(1-p.y)*rect.height/2;minX=Math.min(minX,sx);maxX=Math.max(maxX,sx);minY=Math.min(minY,sy);maxY=Math.max(maxY,sy);
    }
    const right=rect.left+rect.width,bottom=rect.top+rect.height;
    popup.style.visibility=inFront&&maxX>rect.left&&minX<right&&maxY>rect.top&&minY<bottom?'visible':'hidden';
    const width=popup.offsetWidth||360,height=popup.offsetHeight||Number.parseFloat(popup.style.height),margin=12;
    const left=clamp((minX+maxX-width)/2,rect.left+margin,Math.max(rect.left+margin,right-width-margin));
    let top=minY-height-4;if(top<rect.top+margin)top=maxY+4;
    top=clamp(top,rect.top+margin,Math.max(rect.top+margin,bottom-height-112));
    popup.style.left=Math.round(left)+'px';popup.style.top=Math.round(top)+'px';
  }
  function finishMove(cancel=false){
    if(!moving)return;const state=moving;moving=null;
    wallHandles.setActive(null);
    if(cancel&&state.beforeScatter)system.scatter.load(state.beforeScatter);
    if(cancel&&!state.beforeScatter){const r=system.get(state.id);r.root.position.copy(state.before);if(state.resize){r.root.scale.copy(state.resize.scale);if(r.railing)system.rebuildRailing(r,state.resize.width)}r.mount=state.beforeMount;r.surface=state.beforeSurface;r.root.updateMatrixWorld(true);system.architecture?.sync()}
    const record=system.get(state.id);if(record)record.root.userData.placementInvalid=false;
    controls.enabled=state.controlsEnabled;canvas.classList.remove('is-dragging','can-resize-height','can-resize-width');render();
    if(canvas.hasPointerCapture(state.pointerId))canvas.releasePointerCapture(state.pointerId);
  }
  function finishArc(cancel=false){
    if(!arcDrag)return;const state=arcDrag;arcDrag=null;
    // Restore the original orientation, including legacy angles between ticks.
    if(cancel){rotationValue=state.before;system.rotationPreview(selectedId,state.beforeAngle);render()}
    if(arc.hasPointerCapture(state.pointerId))arc.releasePointerCapture(state.pointerId);
  }
  function settle(commit){
    finishMove(!commit);finishArc(!commit);
    if(isOperation()){mode='menu';if(commit)system.commitGesture();else system.cancelGesture()}
  }
  function close(commit=true){
    press=null;settle(commit);floorControls?.close(commit);if(active())active().root.userData.placementInvalid=false;selectedId=null;mode=null;canvas.classList.remove('can-move','can-select','can-resize-height','can-resize-width');render();onSelection(null,null);
  }
  function select(id){
    const record=system.get(id);if(!record?.root.visible){close();return null}
    floorControls?.close();settle(true);selectedId=record.id;mode='move';enabled=true;rotationValue=Math.round(degrees(record));system.beginGesture();onInteract();render();onSelection(selectedId,mode);return record;
  }
  function beginMode(next){
    const record=active();if(!record||record.kind==='scatter'&&next!=='move'||!['rotate','move','color','material'].includes(next)||(next==='material'&&record.kind!=='wall'))return;
    settle(true);mode=next;rotationValue=Math.round(degrees(record));system.beginGesture();onInteract();render();onSelection(selectedId,mode);
  }
  function setAngle(value){if(mode!=='rotate'||!active())return;const wanted=clamp(Math.round(value/ROTATION_STEP)*ROTATION_STEP,0,360);rotationValue=wanted;if(!system.rotationPreview(selectedId,wanted)){rotationValue=Math.round(degrees(active()));render()}}
  function setEnabled(value){if(!value)close();enabled=value;render()}
  function setRay(event){const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);camera.updateMatrixWorld();raycaster.setFromCamera(pointer,camera)}
  function pick(event){
    setRay(event);scene.updateMatrixWorld(true);raycaster.far=Infinity;
    const hit=pickSceneSurface(raycaster,{system,occluders}),record=system.get(hit?.object.userData.furnitureId);
    return record&&!hit.object.userData.buildId&&system.construction?.editable(record)!==false?hit:null;
  }
  function pickFloor(event){
    if(!system.floorSystem)return null;
    setRay(event);scene.updateMatrixWorld(true);raycaster.far=Infinity;
    const hit=pickSceneSurface(raycaster,{system,occluders}),floor=system.floorSystem.get(hit?.object.userData.floorId);
    return floor&&!floor.dynamic&&hit.face.normal.y>.5&&system.construction?.editable(floor)!==false?hit:null;
  }
  function pickArrow(event,furnitureHit){
    if(mode!=='move'||!active())return null;
    setRay(event);raycaster.far=Infinity;const hit=groundSelection.pick(raycaster);if(!hit||furnitureHit&&furnitureHit.distance<hit.distance-.03)return null;
    raycaster.far=Math.max(0,hit.distance-.03);const blocked=raycaster.intersectObjects(occluders,true).some(h=>!h.object.material?.transparent||h.object.material.opacity>.65);raycaster.far=Infinity;return blocked?null:hit;
  }

  $('object-rotate').addEventListener('click',()=>beginMode('rotate'));
  $('object-color').addEventListener('click',()=>beginMode('color'));
  $('object-material').addEventListener('click',()=>beginMode('material'));
  for(const style of system.architecture?.styles||[]){const button=document.createElement('button');button.type='button';button.className='orbit-button wall-material-option';button.dataset.material=style.id;button.title=style.name;button.setAttribute('aria-label',style.name);button.style.backgroundImage=`url("${style.preview}")`;button.addEventListener('click',()=>{if(mode==='material')system.materialPreview(selectedId,style.id)});$('wall-material-options').append(button)}
  $('object-delete').addEventListener('click',()=>{const id=selectedId;close();if(id)onRemove(id)});
  $('object-confirm').addEventListener('click',()=>close());
  let paletteKind=null;
  function syncPalette(record){const kind=record?.sourceId==='stair-entrance'?'entrance':record?.woodFinish?'wood':'standard';if(kind===paletteKind)return;paletteKind=kind;palette.replaceChildren();
    for(const [name,color]of kind!=='standard'?woodFinishesFor(record).map(f=>[f.name,f.color]):PALETTE){const button=document.createElement('button');button.type='button';button.className='orbit-button color-option';button.dataset.color=color;button.style.backgroundColor=color;button.setAttribute('aria-label',name);button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>{if(mode==='color'&&active())system.colorPreview(selectedId,color)});palette.append(button)}
  }
  function arcScale(){return arc.getBoundingClientRect().width/ROTATION_ARC.width||1}
  const arcPosition=event=>{const r=arc.getBoundingClientRect();return{x:(event.clientX-r.left)*ROTATION_ARC.width/r.width,y:(event.clientY-r.top)*ROTATION_ARC.height/r.height}};
  const arcAngle=event=>{const p=arcPosition(event);return angleFromArcPoint(p.x,p.y)};
  const rawArcAngle=event=>{const p=arcPosition(event);return(Math.atan2(p.x-ROTATION_ARC.cx,ROTATION_ARC.cy-p.y)/ROTATION_ARC.halfAngle+1)*180};
  arc.addEventListener('pointerdown',event=>{
    if(mode!=='rotate'||event.button!==0||event.isPrimary===false)return;
    const p=arcPosition(event),scale=arcScale(),thumb=arcPoint(rotationValue),nearest=arcPoint(arcAngle(event));
    const onThumb=Math.hypot(p.x-thumb.x,p.y-thumb.y)<=Math.max(22,24/scale);
    if(!onThumb&&Math.hypot(p.x-nearest.x,p.y-nearest.y)*scale>22)return;
    event.preventDefault();event.stopImmediatePropagation();arc.focus({preventScroll:true});
    arcDrag={pointerId:event.pointerId,before:rotationValue,beforeAngle:degrees(active()),offset:onThumb?rotationValue-rawArcAngle(event):0};arc.setPointerCapture(event.pointerId);
    if(!onThumb)setAngle(rawArcAngle(event));
  });
  arc.addEventListener('pointermove',event=>{if(arcDrag?.pointerId!==event.pointerId)return;event.preventDefault();setAngle(rawArcAngle(event)+arcDrag.offset)});
  arc.addEventListener('pointerup',event=>{if(arcDrag?.pointerId===event.pointerId)finishArc()});
  arc.addEventListener('pointercancel',()=>finishArc(true));arc.addEventListener('lostpointercapture',()=>finishArc(true));
  arc.addEventListener('keydown',event=>{const steps={ArrowLeft:-1,ArrowDown:-1,ArrowRight:1,ArrowUp:1,PageDown:-1,PageUp:1};let value;if(event.key in steps)value=rotationValue+steps[event.key]*ROTATION_STEP;else if(event.key==='Home')value=0;else if(event.key==='End')value=360;else return;event.preventDefault();event.stopImmediatePropagation();setAngle(value)});

  // Unselected presses reach OrbitControls. A short release selects and enables
  // moving; dragging that selection or its ground arrows then moves the object.
  canvas.addEventListener('pointerdown',event=>{
    if(event.isPrimary===false){press=null;return}
    if(!enabled||event.button!==0||moving)return;
    setRay(event);wallHandles.update(active(),mode==='move');raycaster.far=Infinity;
    const resizeHit=wallHandles.pick(raycaster);
    if(resizeHit){
      const record=active(),resize=wallHandles.begin(resizeHit.object.userData.resizeEdge,raycaster,event);if(!resize)return;
      event.preventDefault();event.stopImmediatePropagation();press=null;onInteract();
      moving={id:selectedId,resize,before:record.root.position.clone(),beforeMount:record.mount?structuredClone(record.mount):null,beforeSurface:record.surface,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,moved:false,controlsEnabled:controls.enabled};
      controls.enabled=false;canvas.setPointerCapture(event.pointerId);return;
    }
    onInteract();const furnitureHit=pick(event),arrowHit=pickArrow(event,furnitureHit),hit=arrowHit||furnitureHit,id=arrowHit?selectedId:furnitureHit?.object.userData.furnitureId||null;
    if(mode==='move'&&id&&id===selectedId){
      event.preventDefault();event.stopImmediatePropagation();press=null;const record=active();
      setRay(event);const support=system.placement?.pick(raycaster,id)||hit.point;
      const mounted=record.kind==='mounted',plane=mounted?new THREE.Plane().setFromNormalAndCoplanarPoint(system.architecture.normal(system.get(record.mount?.wallId||record.mountWallId)),record.root.position):new THREE.Plane(new THREE.Vector3(0,1,0),-hit.point.y);
      const grab=mounted?raycaster.ray.intersectPlane(plane,new THREE.Vector3())||support:support;
      moving={id,mounted,beforeScatter:record.kind==='scatter'?system.scatter.serialize():null,beforeSurface:record.surface,beforeMount:record.mount?structuredClone(record.mount):null,axis:arrowHit?.object.userData.moveAxis||null,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,moved:false,before:record.root.position.clone(),controlsEnabled:controls.enabled,plane,offset:record.root.position.clone().sub(grab)};
      controls.enabled=false;canvas.setPointerCapture(event.pointerId);return;
    }
    const floorHit=!hit?pickFloor(event):null;
    press={pointerId:event.pointerId,id,floorId:floorHit?.object.userData.floorId||null,x:event.clientX,y:event.clientY,time:event.timeStamp,moved:false};
  },{capture:true});
  canvas.addEventListener('pointermove',event=>{
    if(moving){
      if(event.pointerId!==moving.pointerId)return;event.preventDefault();event.stopImmediatePropagation();
      if(!moving.moved&&Math.hypot(event.clientX-moving.startX,event.clientY-moving.startY)<4)return;
      moving.moved=true;canvas.classList.add('is-dragging');setRay(event);
      if(moving.resize){(system.get(moving.id)?.railing?system.resizeRailingPreview:system.resizeWallPreview)(moving.id,moving.resize.edge,wallHandles.delta(moving.resize,raycaster,event),moving.resize);return}
      if(moving.mounted){const p=raycaster.ray.intersectPlane(moving.plane,new THREE.Vector3());if(p){p.add(moving.offset);if(moving.axis==='z'){p.x=moving.before.x;p.z=moving.before.z}else if(moving.axis==='x')p.y=moving.before.y;system.movePreview(moving.id,p.x,p.z,p.y)}return}
      const point=system.placement?system.placement.pick(raycaster,moving.id):raycaster.ray.intersectPlane(moving.plane,new THREE.Vector3());
      if(point){const x=moving.axis==='z'?moving.before.x:point.x+moving.offset.x,z=moving.axis==='x'?moving.before.z:point.z+moving.offset.z,y=system.placement?.heightAt(x,z,point.y,moving.id);system.movePreview(moving.id,x,z,y,false,point.wallId)}return;
    }
    if(press?.pointerId===event.pointerId&&Math.hypot(event.clientX-press.x,event.clientY-press.y)>TAP_DISTANCE)press.moved=true;
    if(!enabled||event.buttons||event.pointerType==='touch'||performance.now()-lastHover<140)return;
    lastHover=performance.now();setRay(event);raycaster.far=Infinity;const resize=wallHandles.pick(raycaster);
    canvas.classList.toggle('can-resize-height',resize?.object.userData.resizeEdge==='top');canvas.classList.toggle('can-resize-width',!!resize&&resize.object.userData.resizeEdge!=='top');
    if(resize){canvas.classList.remove('can-move','can-select');return}
    const hit=pick(event),canMove=mode==='move'&&(hit?.object.userData.furnitureId===selectedId||!!pickArrow(event,hit));
    canvas.classList.toggle('can-move',canMove);canvas.classList.toggle('can-select',!canMove&&(!!hit||!!pickFloor(event)));
  },{capture:true});
  canvas.addEventListener('pointerup',event=>{
    if(event.buildingHandled){press=null;return}
    if(moving?.pointerId===event.pointerId){event.preventDefault();event.stopImmediatePropagation();finishMove();return}
    if(press?.pointerId!==event.pointerId)return;
    const candidate=press;press=null;
    if(candidate.moved||event.timeStamp-candidate.time>TAP_MS||Math.hypot(event.clientX-candidate.x,event.clientY-candidate.y)>TAP_DISTANCE)return;
    const id=pick(event)?.object.userData.furnitureId||null;
    if(id!==candidate.id)return;
    if(id)select(id);
    else{const floorHit=pickFloor(event),floorId=floorHit?.object.userData.floorId||null;if(floorId!==candidate.floorId)return;close();if(floorId)floorControls.select(floorId,floorHit.point)}
  },{capture:true});
  canvas.addEventListener('pointercancel',event=>{press=null;if(moving?.pointerId===event.pointerId){event.stopImmediatePropagation();finishMove(true)}},{capture:true});
  canvas.addEventListener('lostpointercapture',()=>{press=null;finishMove(true)});
  canvas.addEventListener('wheel',()=>{press=null},{capture:true});
  canvas.addEventListener('pointerleave',()=>canvas.classList.remove('can-select','can-move','can-resize-height','can-resize-width'));
  window.addEventListener('blur',()=>{press=null;finishMove(true);finishArc(true)});
  window.addEventListener('keydown',event=>{
    if(event.target?.closest('input,textarea,select,[contenteditable="true"]')||document.querySelector('dialog[open]'))return;
    const key=event.key.toLowerCase();
    if((event.ctrlKey||event.metaKey)&&(key==='z'||key==='y')){event.preventDefault();close(false);if(key==='y'||event.shiftKey)system.redo();else system.undo();return}
    if(key==='escape'){event.preventDefault();close(false);return}
    if(key==='enter'&&floorControls?.selectedId){event.preventDefault();close();return}
    if(!enabled||!active()||moving||arcDrag||event.ctrlKey||event.metaKey||event.altKey)return;
    if(key==='enter'&&isOperation()){event.preventDefault();close();return}
    if(key==='r'||key==='m'||key==='c'){event.preventDefault();beginMode({r:'rotate',m:'move',c:'color'}[key])}
    if(key==='delete'||key==='backspace'){event.preventDefault();const id=selectedId;close();onRemove(id)}
  });
  system.subscribe(()=>{if(selectedId&&!active()){selectedId=null;mode=null;onSelection(null,null)}render()});
  render();
  return{select,close,beginMode,pick,pickFloor,setEnabled,update,get selectedId(){return selectedId},get selectedFloorId(){return floorControls?.selectedId||null},get mode(){return mode||(floorControls?.selectedId?'floor':null)},get dragging(){return!!moving||!!arcDrag}};
}
