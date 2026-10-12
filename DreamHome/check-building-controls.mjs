import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';

export function checkBuildingControls({system,scene,camera,editor,canvas,controls,$,winEvents,project,tap,test,initial}){
  const model=system.construction,ui=editor.builder;
  function view(){camera.position.set(15,23,24);controls.target.set(8,1,0);controls.update();camera.updateMatrixWorld(true);scene.updateMatrixWorld(true)}
  function reset(){ui.close(false);editor.close(false);system.load(initial);editor.setCategory('foundation');view()}
  const at=(x=14,z=0,y=1.02)=>project(new THREE.Vector3(x,y,z));
  test('bottom library exposes ten real construction model thumbnails and removes obsolete controls',()=>{
    reset();editor.setCategory('all');assert.equal($('library-list').children.filter(c=>c.dataset.itemId.startsWith('tool-')).length,10);assert.ok($('library-list').children.every(c=>c.children[0].tagName==='IMG'));for(const id of ['library-search','placement-surface','toggle-library','reference','reference-dialog','reset','build-categories','removed-count'])assert.equal($(id),undefined);assert.equal(system.placement.activeSurface,'auto');assert.ok(ui.catalog.find(r=>r.tool==='wall').root.getObjectByName('WhiteWallCrown'));reset();
  });
  test('foundation category contains both the bordered foundation and the standalone ground model',()=>{
    const categories=document.querySelectorAll('[data-category]');categories.find(b=>b.dataset.category==='foundation').click();assert.deepEqual($('library-list').children.map(c=>c.dataset.itemId),['tool-room','tool-ground']);
  });
  test('single-level categories expose all construction tools, and a tool tap exits browse mode',()=>{
    for(const [category,ids]of [['foundation',['tool-room','tool-ground']],['walls',['wall-1','wall-2','wall-5','wall-8','tool-wall']],['doors',['emerald-arch-door','tool-door']],['roofs',['tool-flat','tool-gable']]]){editor.setCategory(category);assert.deepEqual($('library-list').children.map(c=>c.dataset.itemId),ids)}
    editor.setCategory('decor');assert.ok($('library-list').children.some(c=>c.dataset.itemId==='tool-chimney'));
    editor.setCategory('foundation');editor.setEditing(false);$('library-list').children.find(c=>c.dataset.itemId==='tool-room').click();assert.equal(editor.editing,true);tap(at());assert.ok(model.room(ui.selectedId));reset();
  });
  test('new foundation placement stays pending until check, and cancels or undoes as one operation',()=>{
    const before=system.serialize();ui.startTool('room');tap(at());assert.equal(model.all().length,4);assert.ok(ui.selectedId);assert.equal($('build-ui').hidden,false);assert.equal(editor.selectedFloorId,null);assert.equal(system.gesturing,true);assert.equal($('build-enter'),undefined);assert.equal($('build-cancel').hidden,true);winEvents.emit('keydown',{key:'Escape'});assert.deepEqual(system.serialize(),before);
    ui.startTool('room');tap(at());$('build-confirm').click();const saved=system.serialize();assert.equal(model.all().length,4);assert.equal(ui.selectedId,null);system.undo();assert.deepEqual(system.serialize(),before);system.redo();assert.deepEqual(system.serialize(),saved);reset();
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
  test('every category opens the same foundation actions, with material choices only on request',()=>{
    const id=model.addRoom({x:14,z:0});
    for(const category of ['all','foundation','rugs','lighting','props','mounted','walls']){
      editor.setCategory(category);tap(at());assert.equal(ui.selectedId,id);assert.equal(editor.selectedFloorId,null);assert.equal($('floor-ui').hidden,true);assert.equal($('build-options').hidden,true);
      for(const action of ['rotate','color','material','remove','confirm'])assert.equal($('build-'+action).hidden,false);
      $('build-material').click();assert.equal($('build-options').children.length,7);$('build-options').children[4].click();assert.equal(system.floorSystem.get(id).styleId,'tile-floral');$('build-confirm').click();
    }reset();
  });
  test('occupied foundation deletion requires confirmation; no and Escape close all UI without deleting',()=>{
    const id=model.addRoom({x:14,z:0}),chair=system.add('salon-chair-a');system.move(chair.id,14,0);ui.select(id);const before=system.serialize(),history=system.historyLength;
    for(const exit of ['no','escape']){
      ui.select(id);$('build-remove').click();assert.equal($('foundation-delete-dialog').open,true);assert.equal(controls.enabled,false);assert.equal($('build-ui').hidden,true);assert.deepEqual(system.serialize(),before);
      if(exit==='no')$('foundation-delete-no').click();else winEvents.emit('keydown',{key:'Escape'});
      assert.equal($('foundation-delete-dialog').hidden,true);assert.equal($('foundation-delete-dialog').open,false);assert.equal(ui.selectedId,null);assert.equal($('build-ui').hidden,true);assert.equal($('build-options').hidden,true);assert.equal(controls.enabled,true);assert.deepEqual(system.serialize(),before);assert.equal(system.historyLength,history);
    }reset();
  });
  test('empty foundations delete immediately, while confirmed deletion clears upper contents as one undo',()=>{
    let id=model.addRoom({x:14,z:0});ui.select(id);$('build-remove').click();assert.equal(model.room(id),undefined);assert.equal($('foundation-delete-dialog').open||false,false);
    id=model.addRoom({x:14,z:0});const wall=model.addWall(id,'back'),door=model.addDoor(wall),upper=model.addRoom({x:14,z:0},2);model.setRoof(upper,'gable');const chimney=model.addDecoration(upper);
    const chair=system.add('salon-chair-a'),upstairs=system.add('salon-lamp-a'),roofObject=system.add('garden-urn-1');system.move(chair.id,14,0,model.height(model.room(id)));system.move(upstairs.id,14,0,model.height(model.room(upper)));
    roofObject.mount=null;roofObject.root.position.set(14,model.roofY(model.room(upper),14,0)+.01,0);roofObject.root.updateMatrixWorld(true);
    const neighbor=model.addRoom({x:20,z:0}),neighborChair=system.add('salon-chair-a');system.move(neighborChair.id,20,0);const before=system.serialize(),history=system.historyLength;
    ui.select(id);$('build-remove').click();assert.equal($('foundation-delete-dialog').open,true);$('foundation-delete-yes').click();
    for(const removed of [id,upper,wall,door,chimney])assert.equal(model.find(removed),null);
    for(const item of [chair,upstairs,roofObject])assert.equal(item.root.visible,false,item.id+': '+item.root.position.toArray());
    assert.ok(model.room(neighbor));assert.equal(neighborChair.root.visible,true);assert.equal(ui.selectedId,null);assert.equal(controls.enabled,true);assert.equal(system.historyLength,Math.min(history+1,40));
    const deleted=system.serialize();system.undo();assert.deepEqual(system.serialize(),before);system.redo();assert.deepEqual(system.serialize(),deleted);system.loadSaved(deleted);assert.deepEqual(system.serialize(),deleted);reset();
  });
  test('clicking a foundation releases OrbitControls; hovering after release never rotates the camera',()=>{
    const id=model.addRoom({x:14,z:0}),p=at();tap(p);assert.equal(ui.selectedId,id);assert.equal(controls._pointers.length,0);assert.equal(canvas.hasPointerCapture(1),false);
    const cam=camera.position.clone(),target=controls.target.clone();for(let i=1;i<5;i++){canvas.emit('pointermove',{...p,buttons:0,clientX:p.clientX+i*45,clientY:p.clientY-i*20});controls.update()}assert.ok(camera.position.equals(cam));assert.ok(controls.target.equals(target));
    canvas.emit('pointerdown',p);canvas.emit('pointermove',{...p,clientX:p.clientX+24});canvas.emit('pointerup',{...p,clientX:p.clientX+24});assert.ok(camera.position.equals(cam));assert.equal(controls._pointers.length,0);reset();
  });
  test('upstairs deletion leaves downstairs furniture; shared walls and neighboring furniture survive',()=>{
    const lower=model.addRoom({x:14,z:0}),upper=model.addRoom({x:14,z:0},2),chair=system.add('salon-chair-a'),lamp=system.add('salon-lamp-a');system.move(chair.id,14,0,model.height(model.room(lower)));system.move(lamp.id,14,0,model.height(model.room(upper)));
    ui.select(upper);$('build-remove').click();assert.equal($('foundation-delete-dialog').open,true);$('foundation-delete-yes').click();assert.ok(model.room(lower));assert.equal(chair.root.visible,true);assert.equal(lamp.root.visible,false);
    const neighbor=model.addRoom({x:20,z:0}),shared=model.addWall(lower,'right');assert.equal(model.addWall(neighbor,'left'),shared);const neighborChair=system.add('salon-chair-a');system.move(neighborChair.id,20,0);
    ui.select(lower);$('build-remove').click();assert.equal($('foundation-delete-dialog').open,true);$('foundation-delete-yes').click();assert.deepEqual(model.wall(shared).rooms,[neighbor]);assert.equal(model.validWall(model.wall(shared)),true);assert.equal(neighborChair.root.visible,true);assert.equal(chair.root.visible,false);reset();
  });
  test('overhanging furniture is included, while stored items do not cause an empty-foundation prompt',()=>{
    const id=model.addRoom({x:14,z:0}),chair=system.add('salon-chair-a');chair.root.position.set(17.1,model.height(model.room(id))+.01,0);chair.root.updateMatrixWorld(true);
    assert.ok(model.removalContents(id).furnitureIds.includes(chair.id));ui.select(id);$('build-remove').click();assert.equal($('foundation-delete-dialog').open,true);$('foundation-delete-no').click();
    system.remove(chair.id);ui.select(id);$('build-remove').click();assert.equal(model.room(id),undefined);assert.equal($('foundation-delete-dialog').open,false);reset();
  });
  test('horizontal furniture-library swipes scroll without creating an object or moving the camera',()=>{
    editor.setCategory('all');const card=$('library-list').children[0],before=system.serialize(),cam=camera.position.clone();card.emit('pointerdown',{clientX:900,clientY:1180,pointerType:'touch'});winEvents.emit('pointermove',{clientX:780,clientY:1178,pointerType:'touch'});winEvents.emit('pointerup',{clientX:780,clientY:1178,pointerType:'touch'});assert.equal($('library-list').scrollLeft,120);assert.deepEqual(system.serialize(),before);assert.ok(camera.position.equals(cam));card.click();assert.deepEqual(system.serialize(),before);reset();
  });
  test('dragging a construction model from the dock places one foundation and cancellation removes it',()=>{
    const card=$('library-list').children[0],before=system.serialize(),target=at();card.emit('pointerdown',{clientX:800,clientY:1180,pointerType:'touch'});winEvents.emit('pointermove',{...target,pointerType:'touch'});winEvents.emit('pointerup',{...target,pointerType:'touch'});assert.equal(model.all().length,4);assert.ok(ui.selectedId);card.click();assert.equal(model.all().length,4);winEvents.emit('keydown',{key:'Escape'});assert.deepEqual(system.serialize(),before);reset();
  });
  test('roof and chimney visibility changes do not alter persistent construction data',()=>{
    const id=model.addRoom({x:14,z:0});model.setRoof(id,'gable');const chimney=model.addDecoration(id);const saved=system.serialize();ui.setView('1');assert.equal(model.getModel(id+'-roof').children[0].layers.mask&1,0);assert.equal(model.getModel(chimney).children[0].layers.mask&1,0);assert.deepEqual(system.serialize(),saved);ui.setView('outside');assert.equal(model.getModel(id+'-roof').children[0].layers.mask&1,1);reset();
  });
  test('ground model drags into the scene, can be picked after merging, and shares edit confirmation and undo',()=>{
    const card=$('library-list').children.find(c=>c.dataset.itemId==='tool-ground'),before=system.serialize(),target=at(14,0,.14);assert.ok(card);
    card.emit('pointerdown',{clientX:800,clientY:1180,pointerType:'touch'});winEvents.emit('pointermove',{...target,pointerType:'touch'});winEvents.emit('pointerup',{...target,pointerType:'touch'});const id=ui.selectedId;assert.ok(model.groundPlot(id));assert.equal($('build-enter'),undefined);assert.equal($('build-cancel').hidden,true);assert.equal($('build-material').hidden,true);assert.equal($('build-color').hidden,true);assert.equal(model.all().length,3);
    $('build-confirm').click();const saved=system.serialize();tap(target);assert.equal(ui.selectedId,id);assert.equal(controls._pointers.length,0);
    const cameraBefore=camera.position.clone();canvas.emit('pointermove',{...target,buttons:0,clientX:target.clientX+30});controls.update();assert.ok(camera.position.equals(cameraBefore));
    const bar=scene.getObjectByName('FoundationHandles').children.find(o=>o.userData.edge==='right'),start=project(bar.getWorldPosition(new THREE.Vector3())),end=project(bar.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(1,0,0)));
    canvas.emit('pointerdown',start);canvas.emit('pointermove',end);canvas.emit('pointerup',end);assert.equal(model.groundPlot(id).width,7);assert.ok(camera.position.equals(cameraBefore));winEvents.emit('keydown',{key:'Escape'});assert.deepEqual(system.serialize(),saved);
    system.undo();assert.deepEqual(system.serialize(),before);system.redo();assert.deepEqual(system.serialize(),saved);reset();
  });
  test('foundation swatches show real colors, include original stone, and save that color independently of floors',()=>{
    const id=model.addRoom({x:14,z:0}),before=system.serialize(),floorStyle=system.floorSystem.get(id).styleId;ui.select(id);$('build-color').click();const swatches=$('build-options').children;assert.equal(swatches.length,7);
    for(const b of swatches){assert.equal(b.style.backgroundImage,'none');assert.equal(b.style.backgroundColor,b.dataset.color)}
    const stone=swatches.find(b=>b.dataset.color==='#c3b29c');assert.ok(stone);assert.equal(stone.attributes['aria-label'],'原场景地基色');stone.click();assert.equal(stone.attributes['aria-pressed'],'true');assert.ok(stone.classList.contains('active'));
    assert.equal(model.getModel(id).getObjectByName('FoundationBody').material.color.getHexString(),system.architecture.groundLayers[0].mesh.material.color.getHexString());assert.equal(model.getModel(id).getObjectByName('FoundationBorder').material.color.getHexString(),'f4e6cd');assert.equal(system.floorSystem.get(id).styleId,floorStyle);
    $('build-confirm').click();const saved=system.serialize();system.undo();assert.deepEqual(system.serialize(),before);system.redo();assert.deepEqual(system.serialize(),saved);system.loadSaved(saved);assert.equal(model.room(id).color,'#c3b29c');reset();
  });
  test('foundation and ground strips highlight only the pressed edge, then clear on release, interruption and selection changes',()=>{
    for(const kind of ['room','ground']){
      const id=kind==='room'?model.addRoom({x:14,z:0}):model.addGround({x:14,z:0});ui.select(id);const root=scene.getObjectByName('FoundationHandles');
      for(const [i,edge]of ['left','right','back','front'].entries()){
        const bar=root.children.find(b=>b.userData.edge===edge),color=bar.material.color.getHexString(),opacity=bar.material.opacity,p=project(bar.getWorldPosition(new THREE.Vector3()));canvas.emit('pointerdown',p);
        assert.equal(bar.userData.resizeActive,true);assert.equal(bar.material.color.getHexString(),'dcff92');assert.equal(bar.material.opacity,1);assert.equal(root.children.filter(b=>b.userData.resizeActive).length,1);ui.update();assert.equal(bar.userData.resizeActive,true);
        if(i===0)canvas.emit('pointerup',p);else if(i===1)winEvents.emit('pointercancel',p);else if(i===2)canvas.emit('lostpointercapture',p);else winEvents.emit('blur');
        assert.equal(root.children.some(b=>b.userData.resizeActive),false);assert.equal(bar.material.color.getHexString(),color);assert.equal(bar.material.opacity,opacity);
      }
      const bar=root.children[0],p=project(bar.getWorldPosition(new THREE.Vector3()));canvas.emit('pointerdown',p);$('build-confirm').click();assert.equal(root.visible,false);assert.equal(root.children.some(b=>b.userData.resizeActive),false);reset();
    }
  });
  test('new wall handles retain highlight during geometry rebuild and clear it after resizing',()=>{
    const room=model.addRoom({x:14,z:0}),id=model.addWall(room,'back');ui.select(id);const root=scene.getObjectByName('BuildingWallHandles');assert.equal($('build-cancel').hidden,false);
    for(const edge of ['top','left','right']){
      const bar=scene.getObjectByName('BuildingResize-'+edge),p=project(bar.getWorldPosition(new THREE.Vector3()));canvas.emit('pointerdown',p);assert.equal(bar.userData.resizeActive,true);assert.equal(root.children.filter(b=>b.userData.resizeActive).length,1);
      const q={...p,clientY:p.clientY-15,clientX:p.clientX+(edge==='top'?0:15)};canvas.emit('pointermove',q);ui.update();assert.equal(bar.material.color.getHexString(),'dcff92');canvas.emit('pointerup',q);assert.equal(root.children.some(b=>b.userData.resizeActive),false);
    }reset();
  });
  test('upper-floor library drag places a thin editable slab with floor choices and confirms as one history entry',()=>{
    reset();const lower=model.addRoom({x:24,z:0});assert.ok(lower);camera.position.set(30,20,22);controls.target.set(24,3,0);controls.update();camera.updateMatrixWorld(true);editor.setCategory('floors');
    const before=system.serialize(),card=$('library-list').children.find(c=>c.dataset.itemId==='tool-upper'),target=at(24,0,4.22);assert.ok(card);
    card.emit('pointerdown',{clientX:800,clientY:1180,pointerType:'touch'});winEvents.emit('pointermove',{...target,pointerType:'touch'});winEvents.emit('pointerup',{...target,pointerType:'touch'});
    const id=ui.selectedId;assert.equal(model.room(id)?.level,2);assert.equal(model.room(id).depth,2);$('build-material').click();$('build-options').children.find(c=>c.dataset.style==='wood-long').click();$('build-floor-rotate').click();$('build-confirm').click();const saved=system.serialize();system.undo();assert.deepEqual(system.serialize(),before);system.redo();assert.deepEqual(system.serialize(),saved);reset();
  });
  test('wall tool selects an existing wall top and library walls snap onto the next top without moving the camera',()=>{
    reset();const lower=model.addRoom({x:24,z:0}),base=model.addWall(lower,'back');camera.position.set(28,18,16);controls.target.set(24,3,-2.9);controls.update();camera.updateMatrixWorld(true);scene.updateMatrixWorld(true);
    const cap=id=>{const box=new THREE.Box3().setFromObject(system.get(id).root);return project(new THREE.Vector3((box.min.x+box.max.x)/2,box.max.y,-2.9))};
    ui.startTool('wall');tap(cap(base));const top=ui.selectedId;assert.equal(model.wall(top)?.supportId,base);$('build-confirm').click();editor.setCategory('walls');
    const before=system.serialize(),cam=camera.position.clone(),card=$('library-list').children.find(c=>c.dataset.itemId==='wall-2'),target=cap(top);card.emit('pointerdown',{clientX:800,clientY:1180,pointerType:'touch'});winEvents.emit('pointermove',{...target,pointerType:'touch'});winEvents.emit('pointerup',{...target,pointerType:'touch'});
    const copy=system.get(editor.selectedId);assert.ok(copy);assert.equal(copy.mount?.type,'stack');assert.equal(copy.mount?.wallId,top);assert.ok(camera.position.equals(cam));editor.close();system.undo();assert.deepEqual(system.serialize(),before);reset();
  });
  test('paving and garden dock models expose four finishes, resize strips and one confirm flow',()=>{
    reset();model.addGround({x:24,z:0});camera.position.set(25,20,20);controls.target.set(24,0,0);controls.update();camera.updateMatrixWorld(true);editor.setCategory('paving');assert.deepEqual($('library-list').children.map(c=>c.dataset.itemId),['tool-paving','tool-garden']);
    for(const kind of ['paving','garden']){
      const before=system.serialize(),card=$('library-list').children.find(c=>c.dataset.itemId==='tool-'+kind),point=at(24,0,.15);card.emit('pointerdown',{clientX:800,clientY:1180,pointerType:'touch'});winEvents.emit('pointermove',{...point,pointerType:'touch'});winEvents.emit('pointerup',{...point,pointerType:'touch'});
      const id=ui.selectedId;assert.ok(model.paving(id),model.lastError);assert.equal($('build-color').hidden,true);assert.equal($('build-cancel').hidden,true);$('build-material').click();assert.equal($('build-options').children.length,4);$('build-options').children[1].click();assert.equal(model.paving(id).style,kind==='garden'?'daisies':'terracotta');
      const bar=scene.getObjectByName('FoundationHandles').children.find(o=>o.userData.edge==='right'),start=project(bar.getWorldPosition(new THREE.Vector3())),end=project(bar.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(.5,0,0)));canvas.emit('pointerdown',start);assert.equal(bar.userData.resizeActive,true);canvas.emit('pointermove',end);canvas.emit('pointerup',end);assert.equal(model.paving(id).width,4.5);$('build-confirm').click();const saved=system.serialize();system.undo();assert.deepEqual(system.serialize(),before);system.redo();assert.deepEqual(system.serialize(),saved);
      ui.select(id);$('build-remove').click();assert.equal(model.paving(id),undefined);assert.equal(ui.selectedId,null);
    }reset();
  });
  ui.close(false);editor.setCategory('all');system.load(initial);
}
