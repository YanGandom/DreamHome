import './check-geometry.mjs';
import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';
import {checkFoundations} from './check-foundations.mjs';
import {checkDefaultComponents} from './check-default-components.mjs';
const {furnitureSystem:system,scene,camera}=window.__winterScene,build=system.construction;
const initial=system.serialize(),cases=[];
const check=(name,fn)=>{system.load(initial);fn();cases.push(name)};
const room=(x=14,z=0,level=1)=>{const id=build.addRoom({x,z},level);assert.ok(id,build.lastError);return id};
const dimensions=id=>build.getModel(id).getWorldPosition(new THREE.Vector3());
check('new room creates a bordered 6m foundation with its own ground; size, overlap and snapping limits hold',()=>{
  const id=room(),r=build.room(id);assert.equal(r.width,6);assert.equal(r.depth,6);assert.equal(build.state.walls.length,0);assert.ok(build.getModel(id).getObjectByName('FoundationBorder'));assert.ok(build.ground.root.children.length);assert.equal(build.addRoom({x:0,z:0}),false);
  assert.equal(build.updateRoom(id,{width:2.75}),false);assert.equal(build.updateRoom(id,{width:20.25}),false);assert.equal(build.updateRoom(id,{width:3,depth:20}),true);
  assert.equal(build.addRoom({x:14,z:0}),false);const near=build.snapRoom({id:'draft',x:20.1,z:.1,width:6,depth:6,level:1});assert.equal(near.z,0);
});
check('walls stay inside the assigned foundation and never grow its footprint',()=>{
  const id=room(),w=build.addWall(id,'back'),before=structuredClone(build.room(id));assert.equal(build.getWall(w).localBounds.getSize(new THREE.Vector3()).z,.2);
  assert.equal(build.updateWall(w,{width:7}),false);assert.equal(build.updateWall(w,{x:30}),false);assert.equal(build.updateWall(w,{angle:.2}),false);assert.deepEqual(build.room(id),before);
  assert.equal(build.updateRoom(id,{width:3}),false);assert.equal(build.updateRoom(id,{width:8}),true);assert.equal(build.wall(w).width,6);
});
check('wall-top resizing uses shared 2.4–6m height and leaves foundations unchanged',()=>{
  const id=room(),wall=build.addWall(id,'back'),before=build.room(id).width;assert.equal(build.setHeight(4),true);assert.equal(build.getWall(wall).localBounds.max.y,4);build.setHeight(99);assert.equal(build.state.height,6);build.setHeight(-99);assert.equal(build.state.height,2.4);assert.equal(build.room(id).width,before);
});
check('doors cut real openings, reject overlap and preserve minimum wall piers',()=>{
  const id=room(),w=build.addWall(id,'back'),d=build.addDoor(w,0);assert.ok(d);assert.equal(build.door(d).width,.9);assert.equal(build.addDoor(w,0),false);assert.equal(build.addDoor(w,2.9),false);assert.equal(build.updateDoor(d,{height:9}),false);
  const rec=build.getWall(w),p=rec.root.localToWorld(new THREE.Vector3(0,1,2)),ray=new THREE.Raycaster(p,new THREE.Vector3(0,0,-1));assert.equal(ray.intersectObject(rec.root,true).length,0);
  assert.equal(build.updateDoor(d,{offset:1}),true);assert.ok(ray.intersectObject(build.getWall(w).root,true).length>0);build.remove(d);assert.equal(build.state.doors.length,0);
  const furniture=system.get('plant-salon'),pos=build.getWall(w).root.localToWorld(new THREE.Vector3(1,.05,0));assert.equal(system.placement.valid(furniture,...pos.toArray()),false);
});
check('walls cannot shrink through door openings',()=>{const id=room(),w=build.addWall(id,'back');build.addDoor(w,2);assert.equal(build.updateWall(w,{width:3}),false)});
check('adjacent equal rooms reuse a single shared wall and cannot move it apart',()=>{
  const first=room(),w=build.addWall(first,'right'),second=room(20);assert.equal(build.addWall(second,'left'),w);assert.equal(build.state.walls.length,1);assert.equal(build.wall(w).rooms.length,2);assert.equal(build.updateRoom(first,{x:13}),false);assert.equal(build.rotateRoom(first),false);build.remove(first);assert.ok(build.wall(w));assert.deepEqual(build.wall(w).rooms,[second]);assert.ok(build.validWall(build.wall(w)));const save=system.serialize();system.loadSaved(save);assert.deepEqual(system.serialize(),save);
});
check('room movement and rotation carry furniture without scaling; shrinking checks its complete bounds',()=>{
  const id=room(),w=build.addWall(id,'back'),chair=system.get('salon-chair-a');system.movePreview(chair.id,14,1,1.02);const before=chair.root.position.clone();assert.ok(build.updateRoom(id,{x:16}));assert.ok(chair.root.position.distanceTo(before.clone().add(new THREE.Vector3(2,0,0)))<1e-6);assert.equal(build.wall(w).x,16);assert.ok(build.rotateRoom(id));assert.ok(Math.abs(chair.root.rotation.y-Math.PI/2)<1e-6);assert.deepEqual(chair.root.scale.toArray(),[1,1,1]);
  system.movePreview(chair.id,18,0,1.02);assert.equal(build.updateRoom(id,{width:3}),false);
});
check('upper rooms require full lower support; deleting and shrinking supporting foundations is blocked',()=>{
  assert.equal(build.addRoom({x:30,z:0},2),false);const first=room(),second=room(14,0,2);assert.ok(second);assert.equal(build.remove(first),false);assert.equal(build.updateRoom(first,{width:3}),false);const y=dimensions(second).y;build.setHeight(4);assert.ok(Math.abs(dimensions(second).y-y-1)<1e-6);assert.equal(build.setRoof(first,'gable'),false);
});
check('roof parts and chimney follow room position, roof changes and floor visibility without changing saves',()=>{
  const id=room();assert.ok(build.setRoof(id,'gable'));const chimney=build.addDecoration(id,.4,.4),p=dimensions(chimney);assert.ok(build.updateRoom(id,{x:16}));assert.ok(Math.abs(dimensions(chimney).x-p.x-2)<1e-6);build.setRoof(id,'flat');assert.ok(dimensions(chimney).y<p.y);
  const before=system.serialize();build.setView('1');build.applyView(camera);assert.equal(build.getModel(id+'-roof').children[0].layers.mask&1,0);assert.equal(build.getModel(chimney).children[0].layers.mask&1,0);assert.deepEqual(system.serialize(),before);build.setView('outside');build.applyView(camera);assert.equal(build.getModel(chimney).children[0].layers.mask&1,1);
});
check('new floors accept all seven materials, remain independent and keep surface clearance',()=>{
  const id=room(),other=room(24);for(const style of system.floorSystem.styles){assert.ok(system.floorPreview(id,style.id));assert.equal(system.floorSystem.get(id).styleId,style.id)}assert.equal(system.floorSystem.get(other).styleId,'wood-planks');
  const r=system.get('salon-rug');assert.ok(system.movePreview(r.id,14,0,1.02));assert.ok(Math.abs(r.root.position.y-1.03)<1e-6);const texture=system.floorSystem.get(id).materials.get('tile-terrazzo').map;build.setRoof(id,'gable');assert.equal(system.floorSystem.get(id).styleId,'tile-terrazzo');assert.equal(system.floorSystem.get(id).materials.get('tile-terrazzo').map,texture,'reuse texture while changing geometry');
});
check('construction, colors, door parameters and floor finishes share one undo and survive reload',()=>{
  system.beginGesture();const id=room(),w=build.addWall(id,'back');build.addDoor(w,1);build.setStyle(id,'tile-floral');build.setRoof(id,'gable');build.addDecoration(id);build.color(w,'#a8bca1');system.commitGesture();const after=system.serialize();system.undo();assert.deepEqual(system.serialize(),initial);system.redo();assert.deepEqual(system.serialize(),after);system.loadSaved(after);assert.deepEqual(system.serialize(),after);
});
check('deleting a room stores its furniture and undo restores the whole room',()=>{
  const id=room(),chair=system.get('salon-chair-a');system.movePreview(chair.id,14,0,1.02);const before=system.serialize();system.beginGesture();build.remove(id);system.commitGesture();assert.equal(chair.root.visible,false);assert.equal(build.room(id),undefined);system.undo();assert.deepEqual(system.serialize(),before);
});
check('cancelling construction restores geometry, floor records and furniture without orphaned nodes',()=>{
  const children=scene.getObjectByName('NewConstruction').children.length;system.beginGesture();const id=room();build.addWall(id,'left');build.setRoof(id,'flat');system.cancelGesture();assert.deepEqual(system.serialize(),initial);assert.equal(scene.getObjectByName('NewConstruction').children.length,children);assert.equal(system.floorSystem.all().length,3);
});
check('legacy layouts without construction remain loadable',()=>{const state=structuredClone(initial);delete state.building;room();system.loadSaved(state);assert.equal(build.all().length,3);assert.equal(system.floorSystem.all().length,3)});
checkFoundations({system,scene,build,check,room,initial});
check('standalone ground plots merge without a room and persist through edits, history and old layouts',()=>{
  system.beginGesture();const first=build.addGround({x:24,z:0}),second=build.addGround({x:30,z:0});assert.ok(first&&second);assert.equal(build.all().length,3);assert.equal(build.state.walls.length,0);assert.equal(system.floorSystem.all().length,3);
  const cap=()=>build.ground.root.children.at(-1);assert.ok(Math.abs(cap().geometry.userData.area-(18.5*15.4+12*6))<1e-5);assert.ok(build.updateGround(second,{depth:8}));assert.ok(build.rotateGround(second));assert.equal(build.groundPlot(second).width,8);
  assert.equal(build.updateGround(second,{width:2}),false);assert.equal(build.addGround({x:Infinity,z:0}),false);assert.ok(build.updateGround(second,{x:34}));system.commitGesture();const saved=system.serialize(),vertices=Array.from(cap().geometry.attributes.position.array);
  system.undo();assert.equal(build.state.grounds.length,0);system.redo();assert.deepEqual(system.serialize(),saved);system.loadSaved(saved);assert.deepEqual(system.serialize(),saved);assert.deepEqual(Array.from(cap().geometry.attributes.position.array),vertices);
  const r=system.get('plant-salon'),hit=system.placement.supportAt(24,0,100,'__ground_test__');assert.equal(hit.id,'outdoor');assert.ok(hit.object);assert.ok(system.movePreview(r.id,24,0,hit.point.y));assert.ok(Math.abs(r.root.position.y-.15)<1e-5);
  const foundation=room(24);build.remove(foundation);assert.equal(build.state.grounds.length,2,'room removal preserves independently placed ground');assert.ok(build.groundAt(24,0));
  const legacy=structuredClone(saved);delete legacy.building.grounds;system.loadSaved(legacy);assert.equal(build.state.grounds.length,0);
});
check('new geometric and terrazzo floors retain density through resizing and save independently from their borders',()=>{
  const id=room(24),other=room(34);for(const style of ['tile-geometric','tile-terrazzo']){
    assert.ok(build.setStyle(id,style));assert.ok(build.updateRoom(id,{width:8,depth:7}));const floor=system.floorSystem.get(id),map=floor.base.material.map;assert.ok(Math.abs(map.repeat.x/floor.width-1/2.4)<1e-8);assert.ok(Math.abs(map.repeat.y/floor.depth-1/2.4)<1e-8);
    assert.equal(build.getModel(id).getObjectByName('FoundationBorder').material.map,null);assert.equal(system.floorSystem.get(other).styleId,'wood-planks');const saved=system.serialize();system.loadSaved(saved);assert.equal(system.floorSystem.get(id).styleId,style);assert.deepEqual(system.serialize(),saved);
  }
});
check('white wall crowns follow wall length and height, and remain white when the wall is recolored or retextured',()=>{
  const id=room(24),w=build.addWall(id,'back');
  const verify=()=>{const wall=build.getWall(w),crown=wall.root.getObjectByName('WhiteWallCrown'),b=new THREE.Box3().setFromObject(crown);assert.ok(crown);assert.ok(Math.abs(b.max.y-(build.height(build.room(id))+build.state.height))<1e-5);assert.ok(Math.abs(b.max.x-b.min.x-build.wall(w).width)<1e-5);assert.ok(b.max.z-b.min.z>.3);crown.traverse(o=>{if(o.isMesh){assert.equal(o.material.color.getHexString(),'fff9ef');assert.equal(o.material.map,null);assert.ok(!wall.paint.includes(o.material))}})};
  verify();build.setStyle(w,'brick');build.color(w,'#a4bfca');build.updateWall(w,{width:4});build.setHeight(4.5);verify();const saved=system.serialize();system.loadSaved(saved);verify();assert.deepEqual(system.serialize(),saved);
});
checkDefaultComponents({system,build,check,room,initial});
system.load(initial);console.log(JSON.stringify({passed:cases.length,cases,scope:'CPU parametric geometry and full scene integration'},null,2));
