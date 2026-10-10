import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';

export function checkBuildingControls({system,scene,camera,editor,canvas,controls,$,winEvents,project,tap,test,initial}){
  const model=system.construction,ui=editor.builder;
  function view(){camera.position.set(15,23,24);controls.target.set(8,1,0);controls.update();camera.updateMatrixWorld(true);scene.updateMatrixWorld(true)}
  function reset(){ui.close(false);editor.close(false);system.load(initial);editor.setTab('build');view()}
  const at=(x=14,z=0,y=1.02)=>project(new THREE.Vector3(x,y,z));
  test('bottom library exposes six real construction model thumbnails and removes obsolete controls',()=>{
    reset();assert.equal($('library-list').children.length,6);assert.ok($('library-list').children.every(c=>c.children[0].tagName==='IMG'));for(const id of ['library-search','placement-surface','toggle-library','reference','reference-dialog','reset'])assert.equal($(id),undefined);assert.equal(system.placement.activeSurface,'auto');
  });
  test('new foundation placement stays pending until check, and cancels or undoes as one operation',()=>{
    const before=system.serialize();ui.startTool('room');tap(at());assert.equal(model.all().length,1);assert.ok(ui.selectedId);assert.equal($('build-ui').hidden,false);assert.equal(editor.selectedFloorId,null);assert.equal(system.gesturing,true);$('build-cancel').click();assert.deepEqual(system.serialize(),before);
    ui.startTool('room');tap(at());$('build-confirm').click();const saved=system.serialize();assert.equal(model.all().length,1);assert.equal(ui.selectedId,null);system.undo();assert.deepEqual(system.serialize(),before);system.redo();assert.deepEqual(system.serialize(),saved);reset();
  });
  test('selected foundation edge drag changes one edge while holding the opposite edge fixed',()=>{
    ui.startTool('room');tap(at());const id=ui.selectedId,r=model.room(id),oldLeft=r.x-r.width/2,oldWidth=r.width;ui.update();
    const bar=scene.getObjectByName('FoundationHandles').children.find(o=>o.userData.edge==='right'),start=project(bar.getWorldPosition(new THREE.Vector3())),end=project(bar.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(1,0,0))),cam=camera.position.clone();
    canvas.emit('pointerdown',start);assert.equal(controls.enabled,false);canvas.emit('pointermove',end);canvas.emit('pointerup',end);assert.equal(model.room(id).width,oldWidth+1);assert.equal(model.room(id).x-model.room(id).width/2,oldLeft);assert.ok(camera.position.equals(cam));assert.equal(controls.enabled,true);ui.close(false);reset();
  });
  test('construction taps add walls, doors, roofs and decorations to the clicked owners',()=>{
    ui.startTool('room');tap(at());const id=ui.selectedId;$('build-confirm').click();const r=model.room(id);ui.startTool('wall');tap(at(r.x,r.z-r.depth/2+.3));const w=model.wall(ui.selectedId);assert.ok(w);$('build-confirm').click();
    const center=model.getModel(w.id).localToWorld(new THREE.Vector3(0,1.1,.101));ui.startTool('door');tap(project(center));assert.equal(model.door(ui.selectedId)?.wallId,w.id);$('build-confirm').click();
    ui.startTool('gable');tap(at(r.x,r.z));assert.equal(r.roof.style,'gable');$('build-confirm').click();ui.startTool('chimney');tap(at(r.x,r.z,model.roofY(r,r.x,r.z)+.02));assert.equal(model.find(ui.selectedId)?.type,'chimney');$('build-confirm').click();reset();
  });
  test('construction selection wins over room floor material controls, then normal floor editing resumes',()=>{
    const id=model.addRoom({x:14,z:0});tap(at());assert.equal(ui.selectedId,id);assert.equal(editor.selectedFloorId,null);ui.close();editor.setTab('catalog');tap(at());assert.equal(editor.selectedFloorId,id);assert.equal($('floor-ui').hidden,false);editor.close();reset();
  });
  test('horizontal furniture-library swipes scroll without creating an object or moving the camera',()=>{
    editor.setTab('catalog');const card=$('library-list').children[0],before=system.serialize(),cam=camera.position.clone();card.emit('pointerdown',{clientX:900,clientY:1180,pointerType:'touch'});winEvents.emit('pointermove',{clientX:780,clientY:1178,pointerType:'touch'});winEvents.emit('pointerup',{clientX:780,clientY:1178,pointerType:'touch'});assert.equal($('library-list').scrollLeft,120);assert.deepEqual(system.serialize(),before);assert.ok(camera.position.equals(cam));card.click();assert.deepEqual(system.serialize(),before);reset();
  });
  test('dragging a construction model from the dock places one foundation and cancellation removes it',()=>{
    const card=$('library-list').children[0],before=system.serialize(),target=at();card.emit('pointerdown',{clientX:800,clientY:1180,pointerType:'touch'});winEvents.emit('pointermove',{...target,pointerType:'touch'});winEvents.emit('pointerup',{...target,pointerType:'touch'});assert.equal(model.all().length,1);assert.ok(ui.selectedId);card.click();assert.equal(model.all().length,1);winEvents.emit('keydown',{key:'Escape'});assert.deepEqual(system.serialize(),before);reset();
  });
  test('roof and chimney visibility changes do not alter persistent construction data',()=>{
    const id=model.addRoom({x:14,z:0});model.setRoof(id,'gable');const chimney=model.addDecoration(id);const saved=system.serialize();ui.setView('1');assert.equal(model.getModel(id+'-roof').children[0].layers.mask&1,0);assert.equal(model.getModel(chimney).children[0].layers.mask&1,0);assert.deepEqual(system.serialize(),saved);ui.setView('outside');assert.equal(model.getModel(id+'-roof').children[0].layers.mask&1,1);reset();
  });
  ui.close(false);editor.setTab('catalog');system.load(initial);
}
