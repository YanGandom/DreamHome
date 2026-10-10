// Real scene geometry, raycasting, and OrbitControls; only the DOM/GPU are mocked.
import {cases} from './check-model.mjs';
import {OrbitControls} from './check-geometry.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from './vendor/three.module.js';
import {createSceneEditor} from './editor.js';
import {arcPoint,angleFromArcPoint,ROTATION_ARC,compactButtonArc} from './object-controls.js';
import {checkThumbnails} from './check-thumbnails.mjs';
import {checkArchitecture} from './check-architecture.mjs';
import {checkWallHandles} from './check-wall-handles.mjs';
import {checkBuildingControls} from './check-building-controls.mjs';
const {scene,camera,renderer,furnitureSystem:system}=window.__winterScene;
const sofa=system.get('salon-sofa'),initial=system.serialize();
const test=(name,fn)=>{fn();cases.push(name)};
const snapshot=()=>JSON.stringify(system.serialize());
checkThumbnails(system.all(),test);

class Element{
  constructor(tag='div'){
    this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.style={};this.attributes={};this.listeners=new Map();this.value='';this.textContent='';this.hidden=false;this.disabled=false;this.clientWidth=1600;this.clientHeight=1100;
    this.classes=new Set();this.classList={add:(...s)=>s.forEach(v=>this.classes.add(v)),remove:(...s)=>s.forEach(v=>this.classes.delete(v)),contains:s=>this.classes.has(s),toggle:(s,on)=>{const v=on??!this.classes.has(s);if(v)this.classes.add(s);else this.classes.delete(s);return v}};
  }
  addEventListener(type,fn,options={}){if(!this.listeners.has(type))this.listeners.set(type,[]);if(!this.listeners.get(type).some(v=>v.fn===fn))this.listeners.get(type).push({fn,capture:options===true||!!options.capture})}
  removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(v=>v.fn!==fn))}
  emit(type,props={}){
    const e={target:this,button:0,buttons:type==='pointermove'?1:0,pointerType:'mouse',isPrimary:true,pointerId:1,timeStamp:performance.now(),ctrlKey:false,shiftKey:false,metaKey:false,altKey:false,preventDefault(){this.defaultPrevented=true},stopImmediatePropagation(){this.stopped=true},...props};e.pageX=e.clientX;e.pageY=e.clientY;
    // Capture listeners run before OrbitControls' listeners, regardless of install order.
    for(const {fn}of [...this.listeners.get(type)||[]].sort((a,b)=>Number(b.capture)-Number(a.capture))){fn(e);if(e.stopped)break}return e;
  }
  click(){if(!this.disabled)this.emit('click')}
  append(...children){this.children.push(...children)}
  replaceChildren(...children){this.children=children}
  setAttribute(key,value){this.attributes[key]=String(value)}
  getBoundingClientRect(){return this.rect||{left:0,top:0,width:1600,height:1100}}
  setPointerCapture(id){this.capture=id}
  hasPointerCapture(id){return this.capture===id}
  releasePointerCapture(){this.capture=null;this.emit('lostpointercapture')}
  closest(){return ['INPUT','TEXTAREA','SELECT'].includes(this.tagName)?this:null}
  getRootNode(){return document}
  focus(){}
}
const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8'),elements=new Map();
for(const match of html.matchAll(/<([a-z][a-z0-9]*)\b[^>]*\bid="([^"]+)"[^>]*>/g))elements.set(match[2],new Element(match[1]));
const libraryTabs=[...html.matchAll(/data-library-tab="([^"]+)"/g)].map(m=>{const el=new Element('button');el.dataset.libraryTab=m[1];return el});
const categories=[...html.matchAll(/data-category="([^"]+)"/g)].map(m=>{const el=new Element('button');el.dataset.category=m[1];return el});
const body=new Element('body');body.classList.add('editor-open');
const docEvents=new Element();
globalThis.document={body,getElementById:id=>{assert.ok(elements.has(id),'HTML element exists: '+id);return elements.get(id)},createElement:tag=>new Element(tag),querySelector:()=>null,querySelectorAll:s=>s==='[data-library-tab]'?libraryTabs:s==='[data-category]'?categories:[],addEventListener:(...args)=>docEvents.addEventListener(...args),removeEventListener:(...args)=>docEvents.removeEventListener(...args)};
const winEvents=new Element();window.addEventListener=(...args)=>winEvents.addEventListener(...args);window.matchMedia=()=>({matches:false});
const storage=new Map();globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
const canvas=new Element('canvas');renderer.domElement=canvas;
const controls=new OrbitControls(camera,canvas);controls.enableDamping=false;
const world=scene.getObjectByName('Architecture');assert.ok(world);
const thumbnailFactory=()=>({request:(record,image)=>{image.src='mock-model:'+record.sourceId+':'+record.color},update:()=>{},clearPending:()=>{}});
const editor=createSceneEditor({scene,camera,renderer,controls,furnitureSystem:system,occluders:world.children,thumbnailFactory});
const $=id=>elements.get(id),tabButton=tab=>libraryTabs.find(b=>b.dataset.libraryTab===tab);
$('rotation-arc').rect={left:100,top:100,width:ROTATION_ARC.width,height:ROTATION_ARC.height};
function overhead(){camera.position.set(.1,27,2.4);controls.target.set(0,0,1);controls.update();camera.updateMatrixWorld(true);scene.updateMatrixWorld(true)}
function project(position){const p=position.clone().project(camera);return{clientX:(p.x+1)*800,clientY:(1-p.y)*550}}
function findHit(id=sofa.id){const r=system.get(id),box=new THREE.Box3().setFromObject(r.root),center=box.getCenter(new THREE.Vector3());for(const x of [-.5,0,.5])for(const z of [-.2,0,.2]){const p=project(center.clone().add(new THREE.Vector3(x,0,z)));if(editor.pick(p)?.object.userData.furnitureId===id)return p}throw new Error('No visible intersection for '+id)}
const blank={clientX:12,clientY:12};
function tap(point,duration=100){canvas.emit('pointerdown',{...point,timeStamp:1000});canvas.emit('pointerup',{...point,timeStamp:1000+duration})}
function arcEvent(degrees){const p=arcPoint(degrees);return{clientX:p.x+100,clientY:p.y+100}}
function arcSlide(from,to){const arc=$('rotation-arc');arc.emit('pointerdown',arcEvent(from));arc.emit('pointermove',arcEvent(to));arc.emit('pointerup',arcEvent(to))}
overhead();

test('short click enters move mode on release without a move button',()=>{
  const p=findHit();assert.equal($('object-ui').hidden,true);const down=canvas.emit('pointerdown',{...p,timeStamp:100});assert.equal(down.stopped,undefined);assert.equal(editor.selectedId,null);assert.equal(controls.enabled,true);
  canvas.emit('pointerup',{...p,timeStamp:210});assert.equal(editor.selectedId,sofa.id);assert.equal(editor.mode,'move');assert.equal(elements.has('object-move'),false);assert.equal($('object-ui').hidden,false);assert.equal($('object-actions').hidden,false);assert.equal($('object-finish').hidden,false);assert.equal($('object-palette').children.length,6);
});
test('selection uses a flat square and four outward ground arrows, with no box helper',()=>{
  const ground=scene.getObjectByName('GroundSelection'),footprint=scene.getObjectByName('SelectionFootprint'),arrows=scene.getObjectByName('MoveArrows');
  assert.equal(ground.visible,true);assert.equal(arrows.visible,true);assert.equal(arrows.children.length,4);assert.equal(footprint.scale.x,footprint.scale.z);assert.equal(footprint.material.depthTest,true);assert.ok(footprint.material.opacity>0&&footprint.material.opacity<1);
  const box=new THREE.Box3().setFromObject(footprint);assert.ok(box.max.y-box.min.y<1e-6);assert.ok(Math.abs(box.min.y-(sofa.root.position.y+.02))<1e-6);
  const center=new THREE.Box3().setFromObject(sofa.root).getCenter(new THREE.Vector3());assert.ok(Math.abs(ground.position.x-center.x)<1e-6);assert.ok(Math.abs(ground.position.z-center.z)<1e-6);
  for(const arrow of arrows.children){const [x,z]=arrow.userData.direction;assert.ok(arrow.position.x*x+arrow.position.z*z>footprint.scale.x/2);const forward=new THREE.Vector3(0,0,-1).applyQuaternion(arrow.quaternion);assert.ok(forward.dot(new THREE.Vector3(x,0,z))>.99);const bounds=new THREE.Box3().setFromObject(arrow);assert.ok(bounds.max.y-bounds.min.y<1e-6)}
  let boxHelpers=0;scene.traverse(o=>{if(o.isBox3Helper)boxHelpers++});assert.equal(boxHelpers,0);
});
test('press and drag on furniture rotates the real camera without moving the furniture',()=>{
  editor.close();const p=findHit(),before=sofa.root.position.clone(),cameraBefore=camera.position.clone();
  canvas.emit('pointerdown',{...p,timeStamp:100});canvas.emit('pointermove',{...p,clientX:p.clientX+45,timeStamp:160});canvas.emit('pointerup',{...p,clientX:p.clientX+45,timeStamp:200});
  assert.ok(camera.position.distanceTo(cameraBefore)>.1);assert.ok(sofa.root.position.equals(before));assert.equal(editor.selectedId,null);assert.equal(controls._pointers.length,0);overhead();
});
test('long presses and drags that return to their start do not open the menu',()=>{
  tap(findHit(),600);assert.equal(editor.selectedId,null);const p=findHit();canvas.emit('pointerdown',{...p,timeStamp:100});canvas.emit('pointermove',{...p,clientX:p.clientX+20,timeStamp:120});canvas.emit('pointermove',{...p,timeStamp:140});canvas.emit('pointerup',{...p,timeStamp:160});assert.equal(editor.selectedId,null);overhead();
});
test('empty clicks dismiss the menu; right drags preserve camera pan',()=>{
  tap(findHit());assert.ok(editor.selectedId);assert.equal(editor.pick(blank),null);tap(blank);assert.equal(editor.selectedId,null);assert.equal($('object-ui').hidden,true);
  const before=controls.target.clone();canvas.emit('pointerdown',{...blank,button:2});canvas.emit('pointermove',{...blank,clientX:42,button:2});canvas.emit('pointerup',{...blank,button:2});assert.ok(controls.target.distanceTo(before)>0);overhead();
});
test('arc maps all 0–360 degree values continuously, including both endpoints',()=>{
  for(let d=0;d<=360;d++){const p=arcPoint(d);assert.equal(angleFromArcPoint(p.x,p.y),d)}assert.equal(angleFromArcPoint(0,130),0);assert.equal(angleFromArcPoint(ROTATION_ARC.width,130),360);
});
test('arc rotation previews stay pending until the green check, with one undo step',()=>{
  editor.select(sofa.id);$('object-rotate').click();assert.equal(editor.mode,'rotate');assert.equal($('object-rotation').hidden,false);assert.equal($('object-finish').hidden,false);assert.equal($('object-color').hidden,true);assert.equal($('object-delete').hidden,true);
  const before=system.historyLength,arc=$('rotation-arc');arc.emit('pointerdown',arcEvent(0));const popupPosition=[$('object-ui').style.left,$('object-ui').style.top];arc.emit('pointermove',arcEvent(180));assert.deepEqual([$('object-ui').style.left,$('object-ui').style.top],popupPosition);arc.emit('pointerup',arcEvent(180));
  assert.ok(Math.abs(sofa.root.rotation.y-Math.PI)<1e-9);assert.equal(system.historyLength,before);assert.equal($('arc-value').textContent,'180°');$('object-confirm').click();assert.equal(editor.mode,null);assert.equal($('object-ui').hidden,true);assert.equal(system.historyLength,before+1);system.undo();assert.equal(sofa.root.rotation.y,0);system.redo();assert.equal(sofa.root.rotation.y,Math.PI);
});
test('360 endpoint remains labelled 360, and keyboard arc changes are accessible',()=>{
  editor.select(sofa.id);assert.equal($('object-color').hidden,false);assert.equal($('object-delete').hidden,false);$('object-rotate').click();arcSlide(180,360);assert.equal($('arc-value').textContent,'360°');assert.equal(sofa.root.rotation.y,0);assert.equal($('rotation-arc').attributes['aria-valuenow'],'360');$('rotation-arc').emit('keydown',{key:'Home'});assert.equal($('arc-value').textContent,'0°');$('rotation-arc').emit('keydown',{key:'ArrowRight',shiftKey:true});assert.equal($('arc-value').textContent,'15°');editor.close(false);
});
test('clicking the arc label does not jump the rotation, and pointer cancel rolls back the slider',()=>{
  editor.select(sofa.id);$('object-rotate').click();const before=sofa.root.rotation.y,arc=$('rotation-arc');arc.emit('pointerdown',{clientX:280,clientY:188});assert.equal(editor.dragging,false);assert.equal(sofa.root.rotation.y,before);
  arc.emit('pointerdown',arcEvent(0));arc.emit('pointermove',arcEvent(60));arc.emit('pointercancel',arcEvent(60));assert.equal(sofa.root.rotation.y,before);editor.close(false);
});
test('six colors preview immediately, affect one object, and confirm as one edit',()=>{
  editor.select(sofa.id);$('object-color').click();assert.equal($('object-palette-panel').hidden,false);const other=system.get('salon-chair-a'),otherColor=other.paint[0].color.getHexString(),before=system.historyLength;
  for(const button of $('object-palette').children)button.click();assert.equal(sofa.color,'#c58b91');assert.equal(other.paint[0].color.getHexString(),otherColor);assert.equal(system.historyLength,before);$('object-confirm').click();assert.equal(system.historyLength,before+1);assert.equal(editor.selectedId,null);assert.deepEqual(JSON.parse(storage.get(editor.storageKey)),system.serialize());
});
test('empty click keeps chosen color, while Escape cancels unconfirmed changes',()=>{
  editor.select(sofa.id);$('object-color').click();$('object-palette').children[3].click();tap(blank);assert.equal(sofa.color,'#963d43');assert.equal(editor.selectedId,null);
  editor.select(sofa.id);$('object-color').click();$('object-palette').children[0].click();winEvents.emit('keydown',{key:'Escape'});assert.equal(sofa.color,'#963d43');assert.equal(editor.selectedId,null);
});
test('a selected object can be dragged immediately and waits for confirmation',()=>{
  system.resetItem(sofa.id);overhead();editor.select(sofa.id);const p=findHit(),before=sofa.root.position.clone(),cameraBefore=camera.position.clone(),history=system.historyLength;
  assert.equal(canvas.emit('pointerdown',p).stopped,true);assert.equal(controls.enabled,false);canvas.emit('pointermove',{...p,clientX:p.clientX+28,clientY:p.clientY+15});assert.ok(sofa.root.position.distanceTo(before)>.1);assert.ok(camera.position.equals(cameraBefore));canvas.emit('pointerup',p);assert.equal(editor.mode,'move');assert.equal(controls.enabled,true);assert.equal(controls._pointers.length,0);assert.equal(system.historyLength,history);
  const marker=scene.getObjectByName('GroundSelection'),bounds=new THREE.Box3().setFromObject(sofa.root);assert.ok(Math.abs(marker.position.x-(bounds.min.x+bounds.max.x)/2)<1e-6);
  $('object-confirm').click();assert.equal(marker.visible,false);assert.equal(editor.selectedId,null);assert.equal(system.historyLength,history+1);system.undo();assert.ok(sofa.root.position.equals(before));system.redo();
});
test('ground arrow drag constrains movement to its axis and cancels cleanly',()=>{
  system.move(sofa.id,0,0);editor.select(sofa.id);const arrow=scene.getObjectByName('MoveArrow-right'),point=project(arrow.getWorldPosition(new THREE.Vector3())),before=sofa.root.position.clone(),cameraBefore=camera.position.clone();
  const down=canvas.emit('pointerdown',point);assert.equal(down.stopped,true);assert.equal(controls.enabled,false);canvas.emit('pointermove',{...point,clientX:point.clientX+32,clientY:point.clientY+20});canvas.emit('pointerup',point);
  assert.ok(Math.abs(sofa.root.position.x-before.x)>.1);assert.equal(sofa.root.position.z,before.z);assert.ok(camera.position.equals(cameraBefore));assert.equal(editor.mode,'move');assert.equal(controls.enabled,true);editor.close(false);assert.ok(sofa.root.position.equals(before));assert.equal(scene.getObjectByName('GroundSelection').visible,false);
});
test('selection follows balcony and courtyard floor heights and mode changes',()=>{
  for(const id of ['plant-balcony-a','garden-bench']){editor.select(id);const ground=scene.getObjectByName('GroundSelection');assert.equal(ground.position.y,system.get(id).root.position.y+.02);assert.equal(scene.getObjectByName('MoveArrows').visible,true);editor.beginMode('rotate');assert.equal(ground.visible,true);assert.equal(scene.getObjectByName('MoveArrows').visible,false);editor.close();assert.equal(ground.visible,false)}
});
test('cancelled move pointer restores that drag, and Escape restores the whole operation',()=>{
  editor.select(sofa.id);const before=snapshot(),p=findHit();canvas.emit('pointerdown',p);canvas.emit('pointermove',{...p,clientX:p.clientX+24});canvas.emit('pointercancel',p);assert.equal(snapshot(),before);assert.equal(controls.enabled,true);assert.equal(editor.mode,'move');
  canvas.emit('pointerdown',p);canvas.emit('pointermove',{...p,clientX:p.clientX+24});canvas.emit('pointerup',p);winEvents.emit('keydown',{key:'Escape'});assert.equal(snapshot(),before);assert.equal(editor.selectedId,null);
});
test('delete and library restore retain color and location and close object UI',()=>{
  editor.select(sofa.id);const before=snapshot();$('object-delete').click();assert.equal(sofa.root.visible,false);assert.equal(editor.selectedId,null);assert.equal($('removed-count').textContent,'1');const card=$('library-list').children.find(c=>c.dataset.itemId===sofa.id);card.click();assert.equal(sofa.root.visible,true);assert.equal(snapshot(),before);assert.equal(editor.mode,'move');
});
test('catalog addition enters move mode and supports confirm and autosave',()=>{
  tabButton('catalog').click();assert.equal($('library-search'),undefined);const count=system.all().length;$('library-list').children.find(c=>c.dataset.itemId==='salon-sofa').click();assert.equal(system.all().length,count+1);assert.ok(editor.selectedId.startsWith('copy-'));assert.equal(editor.mode,'move');$('object-confirm').click();assert.deepEqual(JSON.parse(storage.get(editor.storageKey)),system.serialize());
});
test('browsing mode allows camera orbit and suppresses the object menu',()=>{
  editor.setEditing(false);tap(findHit());assert.equal(editor.selectedId,null);assert.equal($('object-ui').hidden,true);editor.setEditing(true);
});
test('undo/redo shortcuts and keyboard typing remain separate',()=>{
  editor.select(sofa.id);winEvents.emit('keydown',{key:'r',target:new Element('input')});assert.equal(editor.mode,'move');winEvents.emit('keydown',{key:'r'});assert.equal(editor.mode,'rotate');arcSlide(0,45);$('object-confirm').click();winEvents.emit('keydown',{key:'z',ctrlKey:true});assert.equal(sofa.root.rotation.y,0);winEvents.emit('keydown',{key:'z',ctrlKey:true,shiftKey:true});assert.equal(sofa.root.rotation.y,Math.PI/4);
});
test('button edge gaps are halved without overlap at desktop and narrow widths',()=>{
  for(const width of [320,360])for(const sizes of [[44,44,44,44],[38,38,38,38,38,38,44],[44,44]]){
    const points=compactButtonArc(width,sizes),r=(width-60)/2*1.8,oldDistance=2*r*Math.sin(Math.asin(1/1.8)/(sizes.length-1));
    for(let i=1;i<points.length;i++){const edge=(sizes[i-1]+sizes[i])/2,gap=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y)-edge;assert.ok(gap>=0);assert.ok(Math.abs(gap-Math.max(0,oldDistance-edge)/2)<1e-8)}
  }
});
function libraryCard(id,tab='catalog'){
  editor.close();editor.setTab(tab);
  const card=$('library-list').children.find(c=>c.dataset.itemId===id);assert.ok(card,id);return card;
}
const libraryPoint={clientX:1730,clientY:400};
function startLibraryDrag(id,point,tab){const card=libraryCard(id,tab);card.emit('pointerdown',libraryPoint);winEvents.emit('pointermove',point);return card}
test('component library uses model previews with accessible names and no visible name text',()=>{
  const card=libraryCard('salon-chair-a');assert.equal(card.tagName,'BUTTON');assert.equal(card.textContent,'');assert.equal(card.children.length,1);assert.equal(card.children[0].tagName,'IMG');assert.ok(card.children[0].src.startsWith('mock-model:'));assert.ok(card.attributes['aria-label'].includes('扶手椅'));
});
test('dragging a catalog model places one copy, keeps the camera still, saves and undoes in one step',()=>{
  overhead();const before=snapshot(),count=system.all().length,h=system.historyLength,cam=camera.position.clone(),point=project(new THREE.Vector3(9,.14,7.5));
  const card=startLibraryDrag('salon-chair-a',point);assert.equal(editor.dragging,true);assert.equal(controls.enabled,false);assert.equal(system.all().length,count+1);assert.equal($('library-list').children.includes(card),true);assert.equal(system.historyLength,h);
  const marker=scene.getObjectByName('LibraryPlacement');assert.equal(marker.visible,true);
  winEvents.emit('pointerup',point);assert.equal(editor.dragging,false);assert.equal(controls.enabled,true);assert.ok(camera.position.equals(cam));assert.equal(system.historyLength,h+1);assert.equal(marker.visible,false);assert.equal(editor.mode,'move');
  const r=system.get(editor.selectedId);assert.ok(r.root.position.x>8);assert.ok(r.root.position.y<.7);assert.deepEqual(JSON.parse(storage.get(editor.storageKey)),system.serialize());card.click();assert.equal(system.all().length,count+1);
  editor.close();const placed=snapshot();system.undo();assert.equal(snapshot(),before);system.redo();assert.equal(snapshot(),placed);
});
test('wall drops, return-to-library drops, Escape, pointer cancellation and blur leave no copies',()=>{
  for(const exit of ['wall','outside','escape','cancel','blur']){
    editor.close();const before=snapshot(),children=scene.children.length,h=system.historyLength;
    const point=exit==='wall'?project(new THREE.Vector3(2,4.3,-4.70)):project(new THREE.Vector3(9,.14,7.5));startLibraryDrag('salon-chair-a',point);
    if(exit==='wall'){assert.equal(body.classList.contains('library-drop-invalid'),true);assert.equal(scene.getObjectByName('LibraryPlacement-SelectionFootprint').material.color.getHexString(),'e65b4f');winEvents.emit('pointerup',point)}
    else if(exit==='outside')winEvents.emit('pointerup',libraryPoint);
    else if(exit==='escape')winEvents.emit('keydown',{key:'Escape'});
    else if(exit==='cancel')winEvents.emit('pointercancel',point);
    else winEvents.emit('blur');
    assert.equal(snapshot(),before,exit);assert.equal(scene.children.length,children,exit);assert.equal(system.historyLength,h);assert.equal(system.gesturing,false);assert.equal(controls.enabled,true);assert.equal(editor.dragging,false);assert.equal(scene.getObjectByName('LibraryPlacement').visible,false);
  }
});
test('stored models drag back with their existing identity/color, and undo returns them to storage',()=>{
  editor.close();const id='plant-balcony-a';system.setColor(id,'#638b9c');system.remove(id);const before=snapshot(),r=system.get(id),count=system.all().length;
  const point=project(new THREE.Vector3(8.2,.3,6));startLibraryDrag(id,point,'removed');assert.equal(r.root.visible,true);winEvents.emit('pointerup',point);assert.equal(editor.selectedId,id);assert.equal(r.color,'#638b9c');assert.ok(r.root.position.y<.7);assert.equal(system.all().length,count);editor.close();system.undo();assert.equal(snapshot(),before);assert.equal(r.root.visible,false);
});
test('dragging from placed tab moves the existing item; cancelling restores its transform',()=>{
  const id='salon-chair-b',point=project(new THREE.Vector3(9,.14,7.5)),before=snapshot(),count=system.all().length;
  startLibraryDrag(id,point,'placed');winEvents.emit('pointercancel',point);assert.equal(snapshot(),before);
  startLibraryDrag(id,point,'placed');winEvents.emit('pointerup',point);assert.equal(editor.selectedId,id);assert.equal(system.all().length,count);assert.ok(system.get(id).root.position.x>8);editor.close();system.undo();assert.equal(snapshot(),before);
});
const floors=system.floorSystem;
function findFloor(id){
  scene.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(floors.get(id).base);
  for(const fx of [.2,.4,.6,.8])for(const fz of [.2,.4,.6,.8]){
    const point=project(new THREE.Vector3(THREE.MathUtils.lerp(box.min.x,box.max.x,fx),box.max.y,THREE.MathUtils.lerp(box.min.z,box.max.z,fz)));
    if(!editor.pick(point)&&editor.pickFloor(point)?.object.userData.floorId===id)return point;
  }
  throw new Error('No exposed floor found for '+id);
}
test('floor clicks open four texture choices; drags orbit and occluded floors cannot be selected',()=>{
  editor.close();overhead();assert.equal(floors.styles.length,4);assert.equal(floors.styles.filter(s=>s.kind==='wood').length,2);assert.equal(floors.styles.filter(s=>s.kind==='tile').length,2);
  for(const id of ['salon','lobby','balcony']){const p=findFloor(id);tap(p);assert.equal(editor.selectedFloorId,id);assert.equal(editor.mode,'floor');assert.equal($('floor-ui').hidden,false);assert.equal($('floor-options').children.length,4);assert.equal($('object-ui').hidden,true);$('floor-confirm').click();assert.equal($('floor-ui').hidden,true)}
  const p=findFloor('lobby'),cameraBefore=camera.position.clone();canvas.emit('pointerdown',{...p,timeStamp:100});canvas.emit('pointermove',{...p,clientX:p.clientX+45,timeStamp:160});canvas.emit('pointerup',{...p,clientX:p.clientX+45,timeStamp:210});assert.ok(camera.position.distanceTo(cameraBefore)>.1);assert.equal(editor.selectedFloorId,null);overhead();
  assert.equal(editor.pickFloor(findHit(sofa.id)),null);assert.equal(editor.pickFloor(project(new THREE.Vector3(9,.14,7.5))),null);
});
test('floor materials change only one room, remove old tiles, and commit/undo as one edit',()=>{
  const before=snapshot(),history=system.historyLength,other=floors.get('lobby').base.material,room=floors.get('salon'),furnitureBefore=system.serialize().items;
  tap(findFloor('salon'));for(const button of $('floor-options').children)button.click();
  assert.equal(room.styleId,'tile-floral');assert.equal(room.details.parent,null);assert.equal(floors.get('lobby').base.material,other);assert.deepEqual(system.serialize().items,furnitureBefore);assert.equal(system.historyLength,history);
  $('floor-confirm').click();assert.equal(system.historyLength,Math.min(40,history+1));const after=snapshot();assert.deepEqual(JSON.parse(storage.get(editor.storageKey)),system.serialize());
  system.undo();assert.equal(snapshot(),before);assert.equal(room.details.parent,room.root);system.redo();assert.equal(snapshot(),after);assert.equal(room.details.parent,null);
});
test('floor switching, furniture selection, blank clicks and Escape settle previews correctly',()=>{
  tap(findFloor('salon'));$('floor-options').children[0].click();tap(findFloor('lobby'));assert.equal(floors.get('salon').styleId,'wood-planks');assert.equal(editor.selectedFloorId,'lobby');
  $('floor-options').children[1].click();tap(blank);assert.equal(floors.get('lobby').styleId,'wood-herringbone');assert.equal(editor.selectedFloorId,null);assert.equal($('floor-ui').hidden,true);
  tap(findFloor('lobby'));$('floor-options').children[2].click();winEvents.emit('keydown',{key:'Escape'});assert.equal(floors.get('lobby').styleId,'wood-herringbone');assert.equal(editor.selectedFloorId,null);
  tap(findFloor('balcony'));$('floor-options').children[2].click();editor.select(sofa.id);assert.equal($('floor-ui').hidden,true);assert.equal(floors.get('balcony').styleId,'tile-checker');assert.equal(editor.mode,'move');editor.close();
  tap(findFloor('lobby'));winEvents.emit('keydown',{key:'Enter'});assert.equal(editor.selectedFloorId,null);assert.equal($('floor-ui').hidden,true);
  assert.notEqual(floors.get('salon').materials.get('wood-planks').map,floors.get('lobby').materials.get('wood-planks').map);
});
test('floor styles survive saved layouts and legacy layouts retain their original floor finishes',()=>{
  const saved=system.serialize();system.load(initial);assert.ok(floors.all().every(r=>r.styleId===null));system.loadSaved(saved);assert.deepEqual(system.serialize(),saved);
  const legacy=structuredClone(saved);delete legacy.floors;system.loadSaved(legacy);assert.ok(floors.all().every(r=>r.styleId===null));assert.deepEqual(system.serialize().items,saved.items);system.loadSaved(saved);
});
checkArchitecture({system,scene,camera,editor,canvas,controls,$,winEvents,project,tap,findHit,startLibraryDrag,test});
checkWallHandles({system,scene,camera,editor,canvas,controls,$,winEvents,project,test});
checkBuildingControls({system,scene,camera,editor,canvas,controls,$,winEvents,project,tap,test,initial});
test('saved layout restores into a fresh editor without opening object controls',()=>{
  const saved=JSON.parse(storage.get(editor.storageKey));system.load(initial);renderer.domElement=new Element('canvas');const fresh=createSceneEditor({scene,camera,renderer,controls,furnitureSystem:system,thumbnailFactory});assert.deepEqual(system.serialize(),saved);assert.equal(fresh.selectedId,null);assert.equal($('object-ui').hidden,true);
});
console.log(JSON.stringify({passed:cases.length,cases,scope:'CPU: full geometry, real OrbitControls, raycasting, capture/bubble DOM events; no browser/WebGL verification'},null,2));
