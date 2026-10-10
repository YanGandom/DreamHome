import {createObjectControls} from './object-controls.js';
import * as THREE from './vendor/three.module.js';
import {createGroundSelection} from './ground-selection.js';
import {createModelThumbnails} from './model-thumbnails.js';
import {createBuildingControls} from './building-controls.js';

const CATEGORIES={seating:'座椅',tables:'桌柜',lighting:'灯具',plants:'植物',rugs:'地毯',decor:'陈设',mounted:'墙饰',walls:'墙体'};
const STORAGE_KEY='winter-grand-layout-v1';
export function createSceneEditor({scene,camera,renderer,controls,furnitureSystem:system,occluders=[],onInteract=()=>{},onResize=()=>{},onBuildingView=()=>{},toast=()=>{},thumbnailFactory=createModelThumbnails}){
  const $=id=>document.getElementById(id),ui={list:$('library-list'),status:$('save-status'),panel:$('editor-panel'),collapse:$('library-collapse-toggle')};
  let selectedId=null,selectedFloorId=null,editing=true,tab='catalog',category='all',buildCategory='all',operation=null,libraryDrag=null,suppressClick=false,builder=null;
  let libraryCollapsed=false;
  const thumbnails=thumbnailFactory(renderer),dragMarker=createGroundSelection(scene,'LibraryPlacement'),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  try{const saved=localStorage.getItem(STORAGE_KEY);if(saved){if(system.loadSaved(JSON.parse(saved)))ui.status.textContent='已恢复上次布局 · 本机';else ui.status.textContent='已使用初始布局'}}catch{ui.status.textContent='本次可编辑 · 本地保存不可用'}
  function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(system.serialize()));ui.status.textContent='已自动保存 · 本机'}catch{ui.status.textContent='无法自动保存 · 请勿刷新'}}
  function renderInspector(){
    const r=system.get(selectedId),floor=system.floorSystem?.get(selectedFloorId);
    $('undo-edit').disabled=!system.canUndo;$('redo-edit').disabled=!system.canRedo;
    const summary=$('selection-summary');summary.textContent=r?`${CATEGORIES[r.category]||'物件'} · ${r.name}`:floor?`地板 · ${floor.name}`:'让喜欢的事物，找到自己的位置。';
    if(r?.kind==='wall'){const size=r.localBounds.getSize(new THREE.Vector3()).multiply(r.root.scale);summary.textContent=`墙壁 ${size[r.lengthAxis].toFixed(2)} × ${size.y.toFixed(2)} m`}
  }
  function setEditing(value){editing=value;interaction.setEnabled(value);builder?.setEnabled(value&&tab==='build');const button=$('edit-mode');button.classList.toggle('active',value);button.setAttribute('aria-pressed',String(value));button.textContent=value?'编辑':'浏览';$('scene-hint').textContent=value?'轻点布置 · 拖动环绕 · 双指缩放':'拖动环绕 · 双指缩放'}
  function select(id){if(id&&!editing)setEditing(true);return interaction.select(id)}
  function setLibraryCollapsed(value){
    if(interaction.dragging||builder?.dragging)return false;
    finishLibraryDrag(false);libraryCollapsed=!!value;
    ui.panel.hidden=libraryCollapsed;document.body.classList.toggle('library-collapsed',libraryCollapsed);
    ui.collapse.setAttribute('aria-expanded',String(!libraryCollapsed));ui.collapse.setAttribute('aria-label',libraryCollapsed?'展开组件库':'收起组件库');ui.collapse.title=libraryCollapsed?'展开组件库':'收起组件库';
    // Resize immediately from the new CSS height; keep filters, scroll and the current edit.
    onResize();interaction.update();builder?.update();return true;
  }
  function setTab(value){finishLibraryDrag(false);builder?.close();interaction.close();tab=value;if(tab==='build'&&!editing)setEditing(true);builder?.setEnabled(editing&&tab==='build');for(const button of document.querySelectorAll('[data-library-tab]')){button.classList.toggle('active',button.dataset.libraryTab===tab);button.setAttribute('aria-selected',String(button.dataset.libraryTab===tab))}$('library-categories').hidden=tab==='build';$('build-categories').hidden=tab!=='build';ui.list.scrollLeft=0;renderLibrary()}
  function resetFilters(){category='all';for(const button of document.querySelectorAll('[data-category]'))button.classList.toggle('active',button.dataset.category==='all')}
  function remove(id){const r=system.get(id);if(!r||r.kind==='wall')return;system.remove(id);resetFilters();setTab('removed');toast(r.name+'已收纳，可在组件库恢复')}
  function renderLibrary(){
    if(libraryDrag||builder?.dragging)return;
    thumbnails.clearPending();
    const records=system.all();$('removed-count').textContent=String(records.filter(r=>!r.root.visible).length);
    const entries=tab==='build'?(builder?.catalog||[]).filter(r=>buildCategory==='all'||r.tool===buildCategory||buildCategory==='roof'&&['flat','gable'].includes(r.tool)):(tab==='catalog'?system.catalog():records.filter(r=>tab==='removed'?!r.root.visible:r.root.visible)).filter(r=>category==='all'||r.category===category);
    $('library-total').textContent=entries.length+(tab==='catalog'?' 款':' 件');ui.list.replaceChildren();
    if(!entries.length){const p=document.createElement('p');p.className='library-empty';p.textContent=category!=='all'?'这个分类暂时没有物件':tab==='removed'?'收纳的物件会出现在这里':'这里暂时没有物件';ui.list.append(p);return}
    for(const r of entries){
      const card=document.createElement('button');card.type='button';card.className='library-card';card.dataset.itemId=r.id;card.classList.toggle('selected',tab==='placed'&&r.id===selectedId);card.setAttribute('aria-label',(tab==='catalog'?'添加':tab==='removed'?'恢复':'选中')+' '+r.name);
      const preview=document.createElement('img');preview.className='model-preview';preview.alt='';preview.draggable=false;preview.setAttribute('aria-hidden','true');card.append(preview);thumbnails.request(r,preview);
      const kind=tab;
      if(kind==='build'){builder.bindCard(card,r);ui.list.append(card);continue}
      card.addEventListener('pointerdown',event=>{
        if(event.button!==0||event.isPrimary===false||libraryDrag)return;
        suppressClick=false;libraryDrag={source:r.id,kind,pointerId:event.pointerId,x:event.clientX,y:event.clientY,moved:false,scrolling:false,scrollLeft:ui.list.scrollLeft||0,record:null,valid:false,controlsEnabled:controls.enabled};
        ui.list.setPointerCapture(event.pointerId);
      });
      card.addEventListener('dragstart',event=>event.preventDefault());
      card.addEventListener('click',()=>{
        if(suppressClick){suppressClick=false;return}
        interaction.close();
        if(kind==='catalog'){const copy=system.add(r.sourceId);if(copy){select(copy.id);toast('已添加'+r.name+'，拖动摆放后点击绿色对勾')}else toast('已达到 120 件家具上限，可重置布局后继续')}
        else if(kind==='removed'){system.restore(r.id);select(r.id);toast(r.name+'已恢复到收纳前的位置')}
        else select(r.id);
      });ui.list.append(card);
    }
  }
  let interaction;
  builder=createBuildingControls({scene,camera,renderer,controls,system,toast,onInteract,onSelect:()=>interaction?.close(),onView:(view,room)=>{interaction?.close();onBuildingView(view,room)}});
  interaction=createObjectControls({scene,camera,renderer,controls,system,occluders,onInteract,onRemove:remove,onSelection:(id,mode,floorId)=>{if(id||floorId)builder?.dismiss();selectedId=id;selectedFloorId=floorId||null;operation=mode;renderInspector();renderLibrary()}});
  system.placement?.setSurface('auto');
  function dragOver(event){
    const state=libraryDrag;if(!state||event.pointerId!==state.pointerId)return;
    if(!state.moved&&Math.hypot(event.clientX-state.x,event.clientY-state.y)<7)return;
    event.preventDefault();event.stopImmediatePropagation();
    const stageRect=renderer.domElement.getBoundingClientRect(),inStage=event.clientY<stageRect.top+stageRect.height&&event.clientX<stageRect.left+stageRect.width;
    if(state.scrolling||!state.moved&&!inStage&&Math.abs(event.clientX-state.x)>Math.abs(event.clientY-state.y)*1.3){state.moved=true;state.scrolling=true;ui.list.scrollLeft=state.scrollLeft-(event.clientX-state.x);return}
    if(!state.moved){state.moved=true;interaction.close();if(!editing)setEditing(true);onInteract();controls.enabled=false;document.body.classList.add('library-dragging')}
    const rect=renderer.domElement.getBoundingClientRect(),inside=event.clientX>=rect.left&&event.clientX<rect.left+rect.width&&event.clientY>=rect.top&&event.clientY<rect.top+rect.height;
    state.valid=false;state.inside=inside;
    if(!inside){if(state.record)state.record.root.visible=false;dragMarker.update(null,false);return}
    if(!state.record){state.record=system.beginPlacement(state.source,state.kind);if(!state.record){toast('已达到 120 件家具上限');finishLibraryDrag(false);return}}
    state.record.root.visible=true;scene.updateMatrixWorld(true);camera.updateMatrixWorld();
    pointer.set((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);raycaster.setFromCamera(pointer,camera);
    const point=system.placement?system.placement.pick(raycaster,state.record.id):raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-state.record.root.position.y),new THREE.Vector3());
    if(point)state.valid=system.movePreview(state.record.id,point.x,point.z,point.y,true,point.wallId);
    state.record.root.userData.placementInvalid=!state.valid;dragMarker.update(state.record,false);
    document.body.classList.toggle('library-drop-invalid',!state.valid);
  }
  function finishLibraryDrag(commit){
    const state=libraryDrag;if(!state)return;libraryDrag=null;
    if(ui.list.hasPointerCapture(state.pointerId))ui.list.releasePointerCapture(state.pointerId);
    if(!state.moved)return;
    if(state.scrolling){suppressClick=true;return}
    suppressClick=true;controls.enabled=state.controlsEnabled;document.body.classList.remove('library-dragging','library-drop-invalid');dragMarker.update(null,false);
    if(state.record){
      if(commit&&state.valid){state.record.root.userData.placementInvalid=false;state.record.root.visible=true;system.commitGesture();select(state.record.id)}
      else{system.cancelPlacement(state.record.id,state.kind==='catalog');if(commit&&state.inside)toast('墙体位置不能摆放，请拖到其它位置')}
    }
    renderLibrary();renderInspector();
  }
  window.addEventListener('pointermove',dragOver,{capture:true});
  window.addEventListener('pointerup',event=>{if(libraryDrag?.pointerId!==event.pointerId)return;if(libraryDrag.moved){dragOver(event);event.preventDefault();event.stopImmediatePropagation()}finishLibraryDrag(true)},{capture:true});
  window.addEventListener('pointercancel',event=>{if(event.pointerId===libraryDrag?.pointerId)finishLibraryDrag(false)},{capture:true});
  ui.list.addEventListener('lostpointercapture',()=>finishLibraryDrag(false));
  window.addEventListener('blur',()=>finishLibraryDrag(false));
  window.addEventListener('keydown',event=>{if(!libraryDrag)return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();finishLibraryDrag(false)}else if((event.ctrlKey||event.metaKey)&&['z','y'].includes(event.key.toLowerCase()))finishLibraryDrag(false)},{capture:true});
  $('undo-edit').addEventListener('click',()=>{builder?.close(false);interaction.close(false);system.undo()});$('redo-edit').addEventListener('click',()=>{builder?.close(false);interaction.close(false);system.redo()});
  $('edit-mode').addEventListener('click',()=>setEditing(!editing));
  ui.collapse.addEventListener('click',()=>setLibraryCollapsed(!libraryCollapsed));
  for(const button of document.querySelectorAll('[data-library-tab]'))button.addEventListener('click',()=>setTab(button.dataset.libraryTab));
  for(const button of document.querySelectorAll('[data-category]'))button.addEventListener('click',()=>{category=button.dataset.category;for(const b of document.querySelectorAll('[data-category]'))b.classList.toggle('active',b===button);renderLibrary()});
  for(const button of document.querySelectorAll('[data-build-category]'))button.addEventListener('click',()=>{buildCategory=button.dataset.buildCategory;for(const b of document.querySelectorAll('[data-build-category]'))b.classList.toggle('active',b===button);ui.list.scrollLeft=0;renderLibrary()});
  ui.list.addEventListener('wheel',event=>{if(Math.abs(event.deltaY)>Math.abs(event.deltaX)){ui.list.scrollLeft+=event.deltaY;event.preventDefault()}},{passive:false});
  system.subscribe(type=>{renderInspector();if(type!=='preview')renderLibrary();if(type==='commit')save()});
  renderInspector();renderLibrary();
  return{select,pick:interaction.pick,pickFloor:interaction.pickFloor,beginMode:interaction.beginMode,close:interaction.close,setEditing,setTab,setLibraryCollapsed,builder,update:()=>{interaction.update();builder?.update();if(!libraryCollapsed&&!libraryDrag&&!builder?.dragging)thumbnails.update()},get libraryCollapsed(){return libraryCollapsed},get selectedId(){return selectedId},get selectedFloorId(){return interaction.selectedFloorId},get mode(){return interaction.mode},get editing(){return editing},get dragging(){return!!libraryDrag?.moved||interaction.dragging||!!builder?.dragging},storageKey:STORAGE_KEY};
}
