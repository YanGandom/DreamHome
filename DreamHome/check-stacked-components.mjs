import './check-geometry.mjs';
import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';
const {furnitureSystem:s,catalogAudit}=window.__winterScene,b=s.construction,a=s.architecture,initial=s.serialize(),cases=[];
const near=(x,y)=>assert.ok(Math.abs(x-y)<1e-5,`${x} != ${y}`);
const test=(name,fn)=>{s.load(initial);fn();cases.push(name)};
test('every authored model is assigned to a catalog family and outdoor paving uses editable areas',()=>{
  assert.deepEqual(catalogAudit.unassigned,[]);for(const f of s.all())assert.ok(s.catalog().some(t=>t.catalogId===f.catalogId),f.id);
  assert.equal(s.all().filter(f=>f.category==='paving').length,0);assert.equal(b.state.pavings.length,3);
  for(const [id,category]of [['stair-entrance','stairs'],['stair-left','stairs'],['balcony-railing','stairs'],['emerald-arch-door','doors'],['wall-8','walls']])assert.equal(s.get(id).category,category);
  const id=b.state.pavings[0].id;b.remove(id);assert.equal(b.paving(id),undefined);const saved=s.serialize();s.loadSaved(saved);assert.deepEqual(s.serialize(),saved);
});
test('foundation maximum is 20m on either axis and wall segments never exceed 6m',()=>{
  const id=b.addRoom({x:30,z:0});assert.ok(b.updateRoom(id,{width:20,depth:20}));assert.equal(b.updateRoom(id,{width:20.25}),false);assert.equal(b.updateRoom(id,{depth:20.25}),false);
  for(const f of a.walls()){const size=f.localBounds.getSize(new THREE.Vector3());assert.ok(size.y*f.root.scale.y<=6+1e-6);s.resizeWallPreview(f.id,'top',20,{position:f.root.position.clone(),scale:f.root.scale.clone()});near(size.y*f.root.scale.y,6)}
  const w=b.addWall(id,'back');b.setHeight(30);near(b.getWall(w).localBounds.max.y,6);const saved=s.serialize();s.loadSaved(saved);assert.deepEqual(s.serialize(),saved);
});
test('upper floor components are thin bordered slabs, require support and retain independently rotated finishes',()=>{
  const lower=b.addRoom({x:24,z:0}),upper=b.addUpper({x:24,z:0});assert.ok(upper,b.lastError);const r=b.room(upper);assert.equal(r.level,2);assert.equal(r.depth,2);near(new THREE.Box3().setFromObject(b.getModel(upper)).getSize(new THREE.Vector3()).y,.2);assert.equal(b.addUpper({x:45,z:0}),false);
  assert.ok(b.setStyle(upper,'wood-long'));b.rotateFloor(upper);assert.equal(s.floorSystem.get(lower).styleId,'wood-planks');assert.ok(b.updateRoom(upper,{depth:3}));assert.ok(b.updateRoom(upper,{depth:1}));assert.equal(b.updateRoom(upper,{width:20.25}),false);
  const saved=s.serialize();s.loadSaved(saved);assert.deepEqual(s.serialize(),saved);near(s.floorSystem.get(upper).base.material.map.rotation,Math.PI/2);
});
test('catalog walls stack on constructed walls, follow edits, reject overhang and persist through save and deletion undo',()=>{
  const room=b.addRoom({x:24,z:0}),baseId=b.addWall(room,'back'),base=b.getWall(baseId),copy=s.beginPlacement('wall-2','catalog');
  assert.ok(s.movePreview(copy.id,base.root.position.x,base.root.position.z,a.bounds(base).max.y+.01,false,baseId));s.commitGesture();assert.equal(copy.mount.type,'stack');near(copy.root.position.y,a.bounds(base).max.y+.01);assert.equal(s.lengthPreview(copy.id,12),false);assert.equal(s.rotationPreview(copy.id,90),false);
  b.setHeight(5);near(copy.root.position.y,a.bounds(b.getWall(baseId)).max.y+.01);const x=copy.root.position.x;assert.ok(b.updateRoom(room,{x:26}));near(copy.root.position.x,x+2);assert.ok(b.updateWall(baseId,{width:4}));assert.equal(b.updateWall(baseId,{width:2}),false);
  const top=b.addStackedWall(copy.id);assert.ok(top,b.lastError);near(b.getWall(top).root.position.y,a.bounds(copy).max.y+.01);
  const saved=s.serialize();s.loadSaved(saved);assert.deepEqual(s.serialize(),saved);near(b.getWall(top).root.position.y,a.bounds(s.get(copy.id)).max.y+.01);
  s.beginGesture();b.remove(baseId);s.commitGesture();assert.equal(b.wall(top),undefined);assert.equal(s.get(copy.id).root.visible,false);s.undo();assert.deepEqual(s.serialize(),saved);
});
test('constructed wall stacks follow a catalog base and deleting that base removes every descendant and wall attachment',()=>{
  const base=s.get('wall-2'),id=b.addStackedWall(base.id);assert.ok(id,b.lastError);const third=b.addStackedWall(id);assert.ok(third);const w=b.getWall(id);near(w.root.position.y,a.bounds(base).max.y+.01);
  const size=base.localBounds.getSize(new THREE.Vector3());s.resizeWallPreview(base.id,'top',1,{position:base.root.position.clone(),scale:base.root.scale.clone()});assert.ok(size.y*base.root.scale.y<=6);near(b.getWall(id).root.position.y,a.bounds(base).max.y+.01);near(b.getWall(third).root.position.y,a.bounds(b.getWall(id)).max.y+.01);
  const saved=s.serialize();s.loadSaved(saved);assert.deepEqual(s.serialize(),saved);s.remove(base.id);assert.equal(b.wall(id),undefined);assert.equal(b.wall(third),undefined);s.undo();assert.deepEqual(s.serialize(),saved);
});
s.load(initial);console.log(JSON.stringify({passed:cases.length,cases},null,2));
