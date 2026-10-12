import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';
import {SCATTER_TYPES,scatterLevel} from './scatter-system.js';

export function checkScatter({system,scene,camera,editor,controls,canvas,tap,$,winEvents,categories,project,test,initial,storage}){
  const saved=system.serialize(),scatter=system.scatter,ground=new THREE.Vector3(3.5,.19,7.5),library={clientX:1730,clientY:400};
  editor.close(false);system.load(initial);camera.position.set(.1,27,2.4);controls.target.set(0,0,1);controls.update();camera.updateMatrixWorld(true);scene.updateMatrixWorld(true);
  function prepare(type='snow'){
    editor.setCategory('all');categories.find(b=>b.dataset.category==='props').click();
    const card=$('library-list').children.find(c=>c.dataset.itemId==='scatter-'+type);assert.ok(card);return card;
  }
  function start(type='snow',point=ground){const card=prepare(type);card.emit('pointerdown',{...library,pointerType:'touch'});winEvents.emit('pointermove',{...project(point),pointerType:'touch'});return card}
  function hold(seconds){const now=performance.now();for(let t=100;t<=seconds*1000;t+=100)editor.update(now+t)}
  test('original exterior snow is removed, and the props category shows four distinct real model previews',()=>{
    assert.equal(window.__winterScene.snow.visible,true);
    scene.traverse(o=>{if(o.isMesh)assert.notEqual(o.material?.color?.getHexString(),'f5fbff','no original snow mesh: '+o.name)});
    prepare();assert.equal($('library-list').children.length,4);assert.deepEqual(scatter.catalog.map(c=>c.name),['雪','花瓣','树叶','彩带']);
    for(const card of $('library-list').children){assert.equal(card.textContent,'');assert.ok(card.children[0].src.startsWith('mock-model:scatter-'))}
    assert.equal(new Set(scatter.catalog.map(c=>c.root.children[0].geometry)).size,4);
  });
  test('snow grows the same units across three sizes while the other props add layers, with a fixed surface gap',()=>{
    const before=system.serialize();system.beginGesture();system.construction.addGround({x:24,z:0});const ground=new THREE.Vector3(24,.14,0);scene.updateMatrixWorld(true);
    for(const type of SCATTER_TYPES){
      let firstCount,previous,previousLevel=0;
      for(const [amount,level]of [[.08,1],[1.02,2],[1.02,3],[20,3]]){
        scatter.paint(type.id,ground,amount);scatter.flush();assert.equal(scatter.levelAt(type.id,ground),level);
        const batch=scatter.root.getObjectByName('Scatter-'+type.id);assert.ok(batch.isInstancedMesh);assert.ok(batch.count>0);assert.ok(new THREE.Box3().setFromObject(batch).min.y>=.149);
        firstCount??=batch.count;assert.equal(batch.count,type.id==='snow'?firstCount:firstCount*level);
        const units=Array.from({length:batch.count},(_,i)=>{const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();batch.getMatrixAt(i,matrix);matrix.decompose(position,rotation,scale);return{position,rotation,scale}});
        if(previous&&type.id==='snow')for(let i=0;i<units.length;i++){
          const now=units[i],old=previous[i];assert.equal(now.position.x,old.position.x);assert.equal(now.position.z,old.position.z);assert.ok(now.rotation.angleTo(old.rotation)<1e-6);assert.ok(Math.abs((now.position.y-now.scale.y)-(old.position.y-old.scale.y))<1e-6);
          if(level>previousLevel){assert.ok(now.scale.x>old.scale.x);assert.ok(now.scale.y>old.scale.y);assert.ok(now.scale.z>old.scale.z)}else assert.deepEqual(now,old);
          assert.ok(Math.abs(now.position.x-Math.round(now.position.x/.5)*.5)+now.scale.x<.729);assert.ok(Math.abs(now.position.z-Math.round(now.position.z/.5)*.5)+now.scale.z<.729);
        }
        if(previous&&type.id!=='snow')assert.deepEqual(units[0],previous[0]);
        previous=units;previousLevel=level;
      }
      assert.ok(scatter.serialize().filter(c=>c.type===type.id).every(c=>scatterLevel(c.amount)===3));
    }
    const full=scatter.serialize(),counts=scatter.root.children.map(o=>o.count);scatter.paint('snow',ground,120);scatter.flush();assert.deepEqual(scatter.serialize(),full);assert.deepEqual(scatter.root.children.map(o=>o.count),counts);
    system.cancelGesture();assert.deepEqual(system.serialize(),before);assert.ok(scatter.root.children.every(o=>!o.visible));
  });
  test('scatter rejects indoor floors, furniture, wall tops and the space beyond real outdoor ground',()=>{
    scene.updateMatrixWorld(true);const ray=new THREE.Raycaster();
    for(const point of [new THREE.Vector3(0,0,0),new THREE.Vector3(6.75,0,6.6),new THREE.Vector3(2,0,-4.7),new THREE.Vector3(30,0,30)]){
      ray.set(new THREE.Vector3(point.x,30,point.z),new THREE.Vector3(0,-1,0));assert.equal(scatter.pick(ray),null);
    }
    system.beginGesture();scatter.paint('snow',new THREE.Vector3(0,0,0),1);scatter.paint('snow',new THREE.Vector3(30,0,30),1);assert.equal(scatter.size,0);system.cancelGesture();
    ray.set(new THREE.Vector3(ground.x,30,ground.z),new THREE.Vector3(0,-1,0));assert.ok(scatter.pick(ray));
  });
  test('dragging a prop and holding it thickens without pointer movement, saves as one undo and restores camera control',()=>{
    const before=system.serialize(),history=system.historyLength,cam=camera.position.clone();start();
    assert.equal(editor.dragging,true);assert.equal(controls.enabled,false);assert.equal(editor.setLibraryCollapsed(true),false);assert.equal($('scatter-meter').hidden,false);assert.equal($('scatter-meter').dataset.level,'1');
    hold(3);assert.equal(scatter.levelAt('snow',ground),3);assert.equal($('scatter-meter').dataset.level,'3');assert.equal(system.historyLength,history);assert.ok(camera.position.equals(cam));
    winEvents.emit('pointerup',project(ground));assert.equal(editor.dragging,false);assert.equal(controls.enabled,true);assert.equal($('scatter-meter').hidden,true);assert.equal(system.historyLength,Math.min(40,history+1));
    const after=system.serialize();assert.deepEqual(JSON.parse(storage.get(editor.storageKey)),after);system.undo();assert.deepEqual(system.serialize(),before);system.redo();assert.deepEqual(system.serialize(),after);
    system.loadSaved(after);assert.deepEqual(system.serialize(),after);system.undo();
  });
  test('dragging leaves a continuous outdoor trail and stops depositing over UI or indoors',()=>{
    const before=system.serialize();start('petals');const now=performance.now();
    for(let i=1;i<=8;i++){winEvents.emit('pointermove',project(new THREE.Vector3(3.5+i*.3,.19,7.5)));editor.update(now+i*100)}
    assert.ok(scatter.serialize().some(c=>c.type==='petals'&&c.x* .5>5));const size=scatter.size;
    winEvents.emit('pointermove',project(new THREE.Vector3(0,1,0)));editor.update(now+1000);assert.equal(scatter.size,size);assert.equal($('scatter-meter').hidden,true);
    winEvents.emit('pointermove',library);editor.update(now+1300);assert.equal(scatter.size,size);
    winEvents.emit('keydown',{key:'Escape'});assert.deepEqual(system.serialize(),before);assert.equal(controls.enabled,true);
  });
  test('all cancellation paths roll back a whole scatter stroke and horizontal mobile browsing leaves no props',()=>{
    for(const exit of ['cancel','capture','blur','escape','category','tab']){
      const before=system.serialize();start('leaves');hold(.4);assert.ok(scatter.size>before.scatter.length);
      if(exit==='cancel')winEvents.emit('pointercancel',project(ground));else if(exit==='capture')$('library-list').releasePointerCapture(1);else if(exit==='blur')winEvents.emit('blur');else if(exit==='escape')winEvents.emit('keydown',{key:'Escape'});else if(exit==='category')categories.find(b=>b.dataset.category==='all').click();else editor.setCategory('foundation');
      assert.deepEqual(system.serialize(),before,exit);assert.equal(editor.dragging,false);assert.equal(controls.enabled,true);assert.equal($('scatter-meter').hidden,true);
    }
    const before=system.serialize(),card=prepare('ribbons');card.emit('pointerdown',{clientX:1750,clientY:1200,pointerType:'touch'});winEvents.emit('pointermove',{clientX:1650,clientY:1200,pointerType:'touch'});winEvents.emit('pointerup',{clientX:1650,clientY:1200,pointerType:'touch'});assert.deepEqual(system.serialize(),before);assert.equal(controls.enabled,true);
  });
  test('old saves without props stay clean and malformed saved scatter is discarded',()=>{
    const old=system.serialize();delete old.scatter;system.loadSaved(old);assert.equal(scatter.size,0);
    system.loadSaved({...old,scatter:[{type:'snow',x:7,z:15,amount:80},{type:'unknown',x:7,z:15,amount:1},{type:'petals',x:Infinity,z:0,amount:1},{type:'leaves',x:0,z:0,amount:-2}]});assert.equal(scatter.size,1);assert.equal(scatter.levelAt('snow',ground),3);
  });
  test('sprayed patches open only delete and confirm, drag without orbit, cancel cleanly and delete with undo',()=>{
    editor.close();system.load(initial);system.construction.addGround({x:24,z:0});scene.updateMatrixWorld(true);scatter.refresh();scatter.beginStroke();scatter.paint('petals',new THREE.Vector3(24,.14,0),.1);scatter.flush();scatter.endStroke();
    camera.position.set(24,20,2);controls.target.set(24,0,0);controls.update();camera.updateMatrixWorld(true);scene.updateMatrixWorld(true);
    const batch=scatter.root.getObjectByName('Scatter-petals'),matrix=new THREE.Matrix4(),p=new THREE.Vector3();batch.getMatrixAt(0,matrix);p.setFromMatrixPosition(matrix);const id=scatter.serialize()[0].patch,point=project(p);
    tap(point);assert.equal(editor.selectedId,id);assert.equal(editor.builder.selectedId,null);assert.equal($('object-rotate').hidden,true);assert.equal($('object-color').hidden,true);assert.equal($('object-delete').hidden,false);assert.equal($('object-ui').hidden,false);
    editor.beginMode('rotate');assert.equal(editor.mode,'move');const before=system.serialize(),cam=camera.position.clone(),end=project(p.clone().add(new THREE.Vector3(.6,0,.6)));
    canvas.emit('pointerdown',point);canvas.emit('pointermove',end);assert.equal(controls.enabled,false);assert.notDeepEqual(system.serialize(),before);canvas.emit('pointercancel',end);assert.deepEqual(system.serialize(),before);assert.equal(controls.enabled,true);assert.ok(camera.position.equals(cam));
    canvas.emit('pointerdown',point);canvas.emit('pointermove',end);canvas.emit('pointerup',end);$('object-confirm').click();const moved=system.serialize();assert.notDeepEqual(moved,before);system.undo();assert.deepEqual(system.serialize(),before);system.redo();assert.deepEqual(system.serialize(),moved);
    editor.select(id);$('object-delete').click();assert.equal(scatter.size,0);assert.equal($('object-ui').hidden,true);system.undo();assert.deepEqual(system.serialize(),moved);system.loadSaved(moved);assert.deepEqual(system.serialize(),moved);
  });
  editor.setCategory('all');categories.find(b=>b.dataset.category==='all').click();system.load(saved);
}
