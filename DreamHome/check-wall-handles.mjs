import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';

export function checkWallHandles({system,scene,camera,editor,canvas,controls,$,winEvents,project,test}){
  editor.close();system.resetLayout();const initial=system.serialize(),architecture=system.architecture;
  const root=scene.getObjectByName('WallResizeHandles');
  const reset=()=>{editor.close(false);system.load(initial);scene.updateMatrixWorld(true)};
  const size=r=>r.localBounds.getSize(new THREE.Vector3()).multiply(r.root.scale);
  function view(r){const center=new THREE.Box3().setFromObject(r.root).getCenter(new THREE.Vector3());camera.position.copy(center).addScaledVector(architecture.normal(r),15).add(new THREE.Vector3(0,4,0));controls.target.copy(center);controls.update();camera.updateMatrixWorld(true);scene.updateMatrixWorld(true);editor.select(r.id)}
  function edgePoint(r,edge){const p=r.localBounds.getCenter(new THREE.Vector3());p[r.lengthAxis]=r.localBounds[edge==='left'?'min':'max'][r.lengthAxis];return r.root.localToWorld(p)}
  function drag(r,edge,amount,end='pointerup'){
    const bar=scene.getObjectByName('WallResize-'+edge),anchor=bar.getWorldPosition(new THREE.Vector3()),axis=edge==='top'?new THREE.Vector3(0,1,0):new THREE.Vector3(r.lengthAxis==='x'?1:0,0,r.lengthAxis==='z'?1:0).applyQuaternion(r.root.quaternion),start=project(anchor),target=project(anchor.clone().addScaledVector(axis,amount));
    const cam=camera.position.clone(),down=canvas.emit('pointerdown',start);assert.equal(down.stopped,true);assert.equal(controls.enabled,false);assert.equal(bar.userData.resizeActive,true);assert.equal(bar.material.color.getHexString(),'dcff92');assert.equal(root.children.filter(b=>b.userData.resizeActive).length,1);
    canvas.emit('pointermove',target);assert.ok(camera.position.equals(cam));assert.equal(bar.userData.resizeActive,true);if(end){canvas.emit(end,target);assert.equal(root.children.some(b=>b.userData.resizeActive),false)}return{start,target};
  }
  test('top wall strip changes height in both directions while the base and foundation stay fixed',()=>{
    const r=system.get('wall-2');view(r);const before=system.serialize(),height=size(r).y,base=r.root.position.y,footprint={...architecture.footprint},history=system.historyLength;
    drag(r,'top',1.1);assert.ok(Math.abs(size(r).y-height-1.1)<1e-6);assert.equal(r.root.position.y,base);assert.deepEqual(architecture.footprint,footprint);
    drag(r,'top',-.45);assert.ok(Math.abs(size(r).y-height-.65)<1e-6);assert.equal(system.historyLength,history);assert.equal(controls.enabled,true);
    $('object-confirm').click();const saved=system.serialize();assert.equal(root.visible,false);system.undo();assert.deepEqual(system.serialize(),before);system.redo();assert.deepEqual(system.serialize(),saved);system.loadSaved(saved);assert.deepEqual(system.serialize(),saved);reset();
  });
  test('left and right strips keep the opposite edge anchored on rotated and perpendicular walls',()=>{
    for(const id of ['wall-1','wall-3'])for(const edge of ['left','right']){
      const r=system.get(id);system.lengthPreview(id,3);system.movePreview(id,-4,0);system.rotationPreview(id,33);view(r);const opposite=edge==='left'?'right':'left',fixed=edgePoint(r,opposite),width=size(r)[r.lengthAxis],height=size(r).y;
      drag(r,edge,edge==='left'?-1.2:1.2);assert.ok(Math.abs(size(r)[r.lengthAxis]-width-1.2)<1e-6);assert.ok(edgePoint(r,opposite).distanceTo(fixed)<1e-6);assert.equal(size(r).y,height);assert.ok(architecture.footprint.width>0);reset();
    }
  });
  test('cancelled resize restores geometry, attached objects and foundation, including capture loss and blur',()=>{
    for(const cancel of ['pointercancel','lostpointercapture','blur']){const r=system.get('wall-2');system.lengthPreview(r.id,5);view(r);const before=system.serialize(),f={...architecture.footprint};drag(r,'right',1,null);assert.notDeepEqual(system.serialize(),before);
      if(cancel==='blur')winEvents.emit('blur');else canvas.emit(cancel);assert.deepEqual(system.serialize(),before);assert.deepEqual(architecture.footprint,f);assert.equal(controls.enabled,true);assert.equal(root.children.some(b=>b.userData.resizeActive),false);reset();
    }
    const r=system.get('wall-1');view(r);const before=system.serialize();drag(r,'top',.5);winEvents.emit('keydown',{key:'Escape'});assert.deepEqual(system.serialize(),before);assert.equal(root.visible,false);reset();
  });
  test('height resize carries courtyard cap objects with constant clearance and respects mounted-object height',()=>{
    const wall=system.get('wall-6'),item=system.get('plant-salon');system.movePreview(item.id,4,4.78,architecture.bounds(wall).max.y);const gap=item.root.position.y-architecture.bounds(wall).max.y;view(wall);
    drag(wall,'top',1);assert.ok(Math.abs(item.root.position.y-architecture.bounds(wall).max.y-gap)<1e-6);assert.deepEqual(item.root.scale.toArray(),[1,1,1]);reset();
    const r=system.get('wall-1');view(r);system.resizeWallPreview(r.id,'top',-100,{position:r.root.position.clone(),scale:r.root.scale.clone()});assert.ok(size(r).y>=architecture.minimumHeight(r.id)-1e-6);
    for(const item of system.all().filter(v=>v.mount?.wallId===r.id)){const b=new THREE.Box3().setFromObject(item.root),wb=architecture.bounds(r);assert.ok(b.max.y<=wb.max.y+1e-6,item.id);assert.ok(b.min.y>=wb.min.y-1e-6,item.id)}reset();
  });
  test('resize strips hide for other edit modes and old saves default to the original wall height',()=>{
    const r=system.get('wall-1');view(r);editor.beginMode('rotate');assert.equal(root.visible,false);editor.beginMode('move');assert.equal(root.visible,true);editor.beginMode('color');assert.equal(root.visible,false);editor.close();
    const old=structuredClone(initial);for(const item of old.items)delete item.heightScale;system.resizeWallPreview(r.id,'top',1,{position:r.root.position.clone(),scale:r.root.scale.clone()});system.loadSaved(old);assert.ok(Math.abs(size(r).y-6)<1e-6);reset();
    const side=system.get('wall-3');system.resizeWallPreview(side.id,'right',100,{position:side.root.position.clone(),scale:side.root.scale.clone()});system.resizeWallPreview(side.id,'top',100,{position:side.root.position.clone(),scale:side.root.scale.clone()});const saved=system.serialize();system.loadSaved(saved);assert.ok(size(side)[side.lengthAxis]<11);assert.ok(architecture.validWall(side));assert.ok(Math.abs(size(side).y-6)<1e-6);assert.deepEqual(system.serialize(),saved);reset();
  });
}
