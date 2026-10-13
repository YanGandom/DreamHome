import {decorateLock} from './progression.js';
import {createLibraryCarry} from './library-carry.js';
import {createObjectControls} from './object-controls.js';
import * as THREE from './vendor/three.module.js';
import {createGroundSelection} from './ground-selection.js';
import {createModelThumbnails} from './model-thumbnails.js';
import {createBuildingControls} from './building-controls.js';
import {createScatterControls} from './scatter-controls.js';

const CATEGORIES={seating:'座椅',tables:'桌柜',lighting:'灯具',plants:'植物',rugs:'地毯',decor:'陈设',mounted:'墙饰',walls:'墙体',props:'道具',paving:'室外铺装',railings:'护栏',stairs:'楼梯',doors:'门洞'};
const BUILD_CATEGORIES={room:'foundation',upper:'floors',ground:'foundation',paving:'paving',garden:'paving',wall:'walls',door:'doors',flat:'roofs',gable:'roofs',chimney:'decor'};
const STORAGE_KEY='winter-grand-layout-v1';
export function createSceneEditor({scene,camera,renderer,controls,furnitureSystem:system,occluders=[],onInteract=()=>{},onResize=()=>{},onBuildingView=()=>{},toast=()=>{},thumbnailFactory=createModelThumbnails}){
  const $=id=>document.getElementById(id),ui={list:$('library-list'),status:$('save-status'),panel:$('editor-panel'),collapse:$('library-collapse-toggle')};
  let selectedId=null,selectedFloorId=null,editing=true,category='all',operation=null,libraryDrag=null,suppressClick=false,builder=null;
  let libraryCollapsed=false,scatterControls=null,storageKey=STORAGE_KEY;
  const thumbnails=thumbnailFactory(renderer),dragMarker=createGroundSelection(scene,'LibraryPlacement'),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const carry=createLibraryCarry();

  function save(){try{localStorage.setItem(storageKey,JSON.stringify(system.serialize()));ui.status.textContent='已自动保存 · 本机'}catch{ui.status.textContent='无法自动保存 · 请勿刷新'}}
  function renderInspector(){
    const r=system.get(selectedId),floor=system.floorSystem?.get(selectedFloorId);
    $('undo-edit').disabled=!system.canUndo;$('redo-edit').disabled=!system.canRedo;
    const summary=$('selection-summary');summary.textContent=r?`${CATEGORIES[r.category]||'物件'} · ${r.name}`:floor?`地板 · ${floor.name}`:'让喜欢的事物，找到自己的位置。';
    if(r?.kind==='wall'){const size=r.localBounds.getSize(new THREE.Vector3()).multiply(r.root.scale);summary.textContent=`墙壁 ${size[r.lengthAxis].toFixed(2)} × ${size.y.toFixed(2)} m`}
  }
  function setEditing(value){if(!value)scatterControls?.cancel();editing=value;interaction.setEnabled(value);builder?.setEnabled(value);$('scene-hint').textContent=value?'轻点布置 · 拖动环绕 · 双指拖动平移 · 双指缩放':'拖动环绕 · 双指拖动平移 · 双指缩放'}
  function select(id){if(id&&!editing)setEditing(true);return interaction.select(id)}
  function setLibraryCollapsed(value){
    if(interaction.dragging||builder?.dragging||scatterControls?.dragging)return false;
    finishLibraryDrag(false);libraryCollapsed=!!value;
    ui.panel.hidden=libraryCollapsed;document.body.classList.toggle('library-collapsed',libraryCollapsed);
    ui.collapse.setAttribute('aria-expanded',String(!libraryCollapsed));ui.collapse.setAttribute('aria-label',libraryCollapsed?'展开组件库':'收起组件库');ui.collapse.title=libraryCollapsed?'展开组件库':'收起组件库';
    // Resize immediately from the new CSS height; keep filters, scroll and the current edit.
    onResize();interaction.update();builder?.update();return true;
  }
  function setCategory(value){scatterControls?.cancel();finishLibraryDrag(false);builder?.close();interaction.close();category=value;builder?.setEnabled(editing);for(const button of document.querySelectorAll('[data-category]')){const active=button.dataset.category===category;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))}ui.list.scrollLeft=0;renderLibrary()}
  function remove(id){const r=system.get(id);if(!r)return;system.remove(id);if(r.kind==='scatter'){toast('已删除这片道具');return}setCategory(r.category);toast(r.name+'已放回组件库，可从原分类恢复')}
  function renderLibrary(){
    if(libraryDrag||builder?.dragging||scatterControls?.dragging)return;
    thumbnails.clearPending();
    // One entry per model family, including stored instances. Restoring an
    // instance reuses its identity, color and transform instead of making a copy.
    const stored=new Map();for(const r of system.all())if(!r.root.visible&&!(system.construction?.state.customGround&&r.id===r.sourceId)&&!stored.has(r.catalogId))stored.set(r.catalogId,r);
    const entries=[...system.catalog().map(template=>({key:template.id,thumbnail:template.kind==='wall'?template:null,record:stored.get(template.catalogId)||template,kind:stored.has(template.catalogId)?'removed':'catalog',category:template.category})),...(system.scatter?.catalog||[]).map(record=>({key:record.id,record,kind:'scatter',category:'props'})),...(builder?.catalog||[]).map(record=>({key:record.id,record,kind:'build',category:BUILD_CATEGORIES[record.tool]}))].filter(entry=>category==='all'||entry.category===category).sort((a,b)=>{const order=['foundation','walls','railings','stairs','floors','doors','roofs','seating','tables','lighting','plants','rugs','mounted','paving','props','decor'];return order.indexOf(a.category)-order.indexOf(b.category)});
    $('library-total').textContent=system.objectCount()+' / 200 件';ui.list.replaceChildren();
    if(!entries.length){const p=document.createElement('p');p.className='library-empty';p.textContent='这个分类暂时没有物件';ui.list.append(p);return}
    for(const {key,record:r,kind,thumbnail} of entries){
      const card=document.createElement('button');card.type='button';card.className='library-card';card.dataset.itemId=key;if(kind==='removed')card.dataset.restoreId=r.id;card.setAttribute('aria-label',(kind==='removed'?'恢复':'添加')+' '+r.name);
      const preview=document.createElement('img');preview.className='model-preview';preview.alt='';preview.draggable=false;preview.setAttribute('aria-hidden','true');card.append(preview);thumbnails.request(thumbnail||r,preview);
      if(decorateLock(card,system.progression,key)){
        let swipe=null,swiped=false;
        card.addEventListener('pointerdown',e=>{if(e.button!==0||e.isPrimary===false)return;swiped=false;swipe={id:e.pointerId,x:e.clientX,scroll:ui.list.scrollLeft||0};card.setPointerCapture(e.pointerId)});
        card.addEventListener('pointermove',e=>{if(swipe?.id!==e.pointerId)return;if(Math.abs(e.clientX-swipe.x)>7)swiped=true;if(swiped){e.preventDefault();ui.list.scrollLeft=swipe.scroll-(e.clientX-swipe.x)}});
        const end=e=>{if(swipe?.id!==e.pointerId)return;swipe=null;if(card.hasPointerCapture(e.pointerId))card.releasePointerCapture(e.pointerId)};
        card.addEventListener('pointerup',end);card.addEventListener('pointercancel',e=>{swiped=true;end(e)});card.addEventListener('lostpointercapture',()=>{swipe=null});
        card.addEventListener('click',()=>{if(!swiped)system.progression.check(key)});ui.list.append(card);continue;
      }
      if(r.scatterType){scatterControls.bindCard(card,r);ui.list.append(card);continue}
      if(kind==='build'){builder.bindCard(card,r);ui.list.append(card);continue}
      card.addEventListener('pointerdown',event=>{
        if(event.button!==0||event.isPrimary===false||libraryDrag)return;
        suppressClick=false;libraryDrag={source:r.id,kind,card,pointerId:event.pointerId,x:event.clientX,y:event.clientY,moved:false,scrolling:false,scrollLeft:ui.list.scrollLeft||0,record:null,valid:false,controlsEnabled:controls.enabled};
        // Keep the subsequent browser click targeted at this card, not the dock.
        card.setPointerCapture(event.pointerId);
      });
      card.addEventListener('dragstart',event=>event.preventDefault());
      card.addEventListener('click',event=>{
        if(suppressClick){suppressClick=false;return}
        builder?.close();interaction.close();
        finishLibraryDrag(false);
        if(!system.canAdd()){toast('场景最多摆放 200 件物件，请先删除一些物件');return}
        libraryDrag={source:r.id,kind,card,pointerId:null,armed:true,clickPickup:true,x:event.clientX||0,y:event.clientY||0,moved:true,scrolling:false,record:null,valid:false,controlsEnabled:controls.enabled};
        controls.enabled=false;onInteract();document.body.classList.add('library-dragging');carry.start(card,event);
      });ui.list.append(card);
    }
  }
  let interaction;
  builder=createBuildingControls({scene,camera,renderer,controls,system,occluders,toast,onInteract,onLooseSelect:id=>select(id),onSelect:()=>{if(!editing)setEditing(true);interaction?.close()},onView:(view,room)=>{interaction?.close();onBuildingView(view,room)}});
  if(system.scatter)scatterControls=createScatterControls({scene,camera,renderer,controls,system,list:ui.list,toast,onStart:()=>{interaction.close();builder?.close();if(!editing)setEditing(true);onInteract()},onFinish:()=>{renderLibrary();renderInspector()}});
  interaction=createObjectControls({scene,camera,renderer,controls,system,occluders,onInteract,onRemove:remove,onSelection:(id,mode,floorId)=>{if(id||floorId)builder?.dismiss();selectedId=id;selectedFloorId=floorId||null;operation=mode;renderInspector();renderLibrary()}});
  try{const saved=localStorage.getItem(STORAGE_KEY);if(saved){if(system.loadSaved(JSON.parse(saved)))ui.status.textContent='已恢复上次布局 · 本机';else ui.status.textContent='已使用初始布局'}}catch{ui.status.textContent='本次可编辑 · 本地保存不可用'}
  builder?.setEnabled(editing);
  system.placement?.setSurface('auto');
  function dragOver(event){
    const state=libraryDrag;if(!state||!state.armed&&event.pointerId!==state.pointerId)return;
    if(!state.moved&&Math.hypot(event.clientX-state.x,event.clientY-state.y)<7)return;
    event.preventDefault();event.stopImmediatePropagation();
    const stageRect=renderer.domElement.getBoundingClientRect(),inStage=event.clientY<stageRect.top+stageRect.height&&event.clientX<stageRect.left+stageRect.width;
    if(state.scrolling||!state.moved&&!inStage&&Math.abs(event.clientX-state.x)>Math.abs(event.clientY-state.y)*1.3){state.moved=true;state.scrolling=true;ui.list.scrollLeft=state.scrollLeft-(event.clientX-state.x);return}
    if(!state.moved){state.moved=true;builder?.close();interaction.close();if(!editing)setEditing(true);onInteract();controls.enabled=false;document.body.classList.add('library-dragging');carry.start(state.card,event)}
    const rect=renderer.domElement.getBoundingClientRect(),inside=event.clientX>=rect.left&&event.clientX<rect.left+rect.width&&event.clientY>=rect.top&&event.clientY<rect.top+rect.height;
    state.valid=false;state.inside=inside;
    carry.move(event,!inside);
    if(!inside){if(state.record)state.record.root.visible=false;dragMarker.update(null,false);return}
    if(!state.record){state.record=system.beginPlacement(state.source,state.kind);if(!state.record){toast('已达到 200 件物件上限');finishLibraryDrag(false);return}}
    state.record.root.visible=true;scene.updateMatrixWorld(true);camera.updateMatrixWorld();
    pointer.set((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);raycaster.setFromCamera(pointer,camera);
    const point=system.placement?system.placement.pick(raycaster,state.record.id):raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-state.record.root.position.y),new THREE.Vector3());
    if(point)state.valid=system.movePreview(state.record.id,point.x,point.z,point.y,true,point.wallId,point.faceSign);
    state.record.root.userData.placementInvalid=!state.valid;dragMarker.update(state.record,false);
    document.body.classList.toggle('library-drop-invalid',!state.valid);
  }
  function finishLibraryDrag(commit){
    const state=libraryDrag;if(!state)return;libraryDrag=null;
    carry.hide();
    if(state.pointerId!==null&&state.card?.hasPointerCapture(state.pointerId))state.card.releasePointerCapture(state.pointerId);
    if(state.pointerId!==null&&ui.list.hasPointerCapture(state.pointerId))ui.list.releasePointerCapture(state.pointerId);
    if(!state.moved)return;
    if(state.scrolling){suppressClick=true;return}
    suppressClick=!state.clickPickup;controls.enabled=state.controlsEnabled;document.body.classList.remove('library-dragging','library-drop-invalid');dragMarker.update(null,false);
    if(state.record){
      if(commit&&state.valid){state.record.root.userData.placementInvalid=false;state.record.root.visible=true;system.commitGesture();select(state.record.id)}
      else{system.cancelPlacement(state.record.id,state.kind==='catalog');if(commit&&state.inside)toast(state.record.kind==='mounted'?'请拖到房间内侧有足够空间的墙面':'墙体位置不能摆放，请拖到其它位置')}
    }
    renderLibrary();renderInspector();
  }
  window.addEventListener('pointermove',dragOver,{capture:true});
  window.addEventListener('pointerdown',event=>{if(!libraryDrag?.armed||event.button!==0||event.isPrimary===false)return;const rect=renderer.domElement.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>=rect.left+rect.width||event.clientY<rect.top||event.clientY>=rect.top+rect.height){finishLibraryDrag(false);return}libraryDrag.armed=false;libraryDrag.pointerId=event.pointerId;event.preventDefault();event.stopImmediatePropagation();ui.list.setPointerCapture(event.pointerId);dragOver(event)},{capture:true});
  window.addEventListener('pointerup',event=>{if(libraryDrag?.pointerId!==event.pointerId)return;if(libraryDrag.moved){dragOver(event);event.preventDefault();event.stopImmediatePropagation()}finishLibraryDrag(true)},{capture:true});
  window.addEventListener('pointercancel',event=>{if(event.pointerId===libraryDrag?.pointerId)finishLibraryDrag(false)},{capture:true});
  ui.list.addEventListener('lostpointercapture',()=>finishLibraryDrag(false));
  window.addEventListener('blur',()=>finishLibraryDrag(false));
  window.addEventListener('keydown',event=>{if(!libraryDrag)return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();finishLibraryDrag(false)}else if((event.ctrlKey||event.metaKey)&&['z','y'].includes(event.key.toLowerCase()))finishLibraryDrag(false)},{capture:true});
  $('undo-edit').addEventListener('click',()=>{scatterControls?.cancel();builder?.close(false);interaction.close(false);system.undo()});$('redo-edit').addEventListener('click',()=>{scatterControls?.cancel();builder?.close(false);interaction.close(false);system.redo()});

  ui.collapse.addEventListener('click',()=>setLibraryCollapsed(!libraryCollapsed));
  for(const button of document.querySelectorAll('[data-category]'))button.addEventListener('click',()=>setCategory(button.dataset.category));
  ui.list.addEventListener('wheel',event=>{if(Math.abs(event.deltaY)>Math.abs(event.deltaX)){ui.list.scrollLeft+=event.deltaY;event.preventDefault()}},{passive:false});
  system.subscribe(type=>{renderInspector();if(type!=='preview')renderLibrary();if(type==='commit')save()});
  renderInspector();renderLibrary();
  return{previewThumbnail:(record,img)=>thumbnails.request(record,img,true),refreshLibrary:renderLibrary,select,pick:interaction.pick,pickFloor:interaction.pickFloor,beginMode:interaction.beginMode,close:interaction.close,setEditing,setCategory,setLibraryCollapsed,builder,update:(now=performance.now())=>{interaction.update();builder?.update();scatterControls?.update(now);if(!libraryDrag&&!builder?.dragging&&!scatterControls?.dragging)thumbnails.update()},get libraryCollapsed(){return libraryCollapsed},get selectedId(){return selectedId},get selectedFloorId(){return interaction.selectedFloorId},get mode(){return interaction.mode},get editing(){return editing},get dragging(){return!!libraryDrag?.moved||interaction.dragging||!!builder?.dragging||!!scatterControls?.dragging},setStorageKey:key=>{storageKey=key},get storageKey(){return storageKey}};
}
