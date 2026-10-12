import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';

export function checkSelection({system,scene,camera,editor,canvas,controls,project,tap,test,initial}){
  const model=system.construction;
  function reset(){editor.builder.close(false);editor.close(false);system.load(initial);editor.setCategory('foundation')}
  function aim(position,target){camera.position.copy(position);controls.target.copy(target);controls.update();camera.updateMatrixWorld(true);scene.updateMatrixWorld(true)}
  test('yellow window in front of another building wins selection in construction mode',()=>{
    reset();const room=model.addRoom({x:6.25,z:-11});assert.ok(room);const wall=model.addWall(room,'back');assert.ok(wall);
    const window=system.get('window-lobby'),target=new THREE.Box3().setFromObject(window.root).getCenter(new THREE.Vector3());
    aim(target.clone().add(new THREE.Vector3(0,0,20)),target);const p=project(target);
    assert.equal(editor.pick(p)?.object.userData.furnitureId,window.id);
    tap(p);assert.equal(editor.selectedId,window.id);assert.equal(editor.builder.selectedId,null);assert.equal(controls._pointers.length,0);
    // A selected background wall must not steal the next click or start a drag.
    editor.close();editor.builder.select(wall);const before=system.serialize();
    const down=canvas.emit('pointerdown',{...p,timeStamp:2000});assert.equal(down.stopped,undefined);assert.equal(editor.dragging,false);
    canvas.emit('pointerup',{...p,timeStamp:2100});assert.equal(editor.selectedId,window.id);assert.equal(editor.builder.selectedId,null);assert.deepEqual(system.serialize(),before);
    reset();
  });
  test('top view selects furniture above a foundation, then the exposed foundation',()=>{
    reset();const room=model.addRoom({x:14,z:0}),chair=system.add('salon-chair-a');assert.ok(room&&chair);
    system.move(chair.id,14,0);assert.equal(chair.root.position.x,14);
    const target=new THREE.Box3().setFromObject(chair.root).getCenter(new THREE.Vector3());aim(target.clone().add(new THREE.Vector3(0,24,.01)),target);
    const p=project(target);tap(p);assert.equal(editor.selectedId,chair.id);assert.equal(editor.builder.selectedId,null);
    editor.close();system.remove(chair.id);tap(p);assert.equal(editor.builder.selectedId,room);assert.equal(editor.selectedId,null);reset();
  });
  test('front construction wall blocks furniture and floors behind it in every library tab',()=>{
    reset();const room=model.addRoom({x:14,z:0}),wall=model.addWall(room,'front'),chair=system.add('salon-chair-a');system.move(chair.id,14,0);assert.equal(chair.root.position.x,14);
    const target=new THREE.Vector3(14,1.8,0);aim(new THREE.Vector3(14,1.8,18),target);const p=project(target);
    assert.equal(editor.pick(p),null);assert.equal(editor.pickFloor(p),null);tap(p);assert.equal(editor.builder.selectedId,wall);assert.equal(editor.selectedId,null);
    editor.builder.close();editor.setCategory('lighting');tap(p);assert.equal(editor.builder.selectedId,wall);assert.equal(editor.selectedId,null);assert.equal(editor.selectedFloorId,null);editor.builder.close();
    // Hidden ancestors and hidden mesh materials must not intercept picking.
    const wallRoot=model.getModel(wall);wallRoot.visible=false;assert.equal(editor.pick(p)?.object.userData.furnitureId,chair.id);
    wallRoot.visible=true;wallRoot.traverse(o=>{if(o.isMesh)o.material.visible=false});assert.equal(editor.pick(p)?.object.userData.furnitureId,chair.id);
    reset();
  });
  editor.setCategory('all');
}
