import './check-geometry.mjs';
import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';
import {SNOW_SIZES} from './scatter-system.js';
import {pickSceneSurface} from './scene-picking.js';
const {furnitureSystem:s,scene}=window.__winterScene,b=s.construction,scatter=s.scatter,initial=s.serialize(),cases=[];
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
const test=(name,fn)=>{s.load(initial);fn();cases.push(name)};
const prepare=()=>{b.addGround({x:24,z:0});scene.updateMatrixWorld(true);return new THREE.Vector3(24,.14,0)};
test('default tile fragments become three contiguous editable areas and legacy saves migrate once',()=>{
  assert.equal(s.all().some(f=>f.category==='paving'),false);assert.equal(b.state.pavings.length,3);
  const legacy=s.serialize();delete legacy.building.pavingDefaults;delete legacy.building.pavings;s.load(legacy);assert.equal(b.state.pavings.length,3);
  for(const p of [...b.state.pavings])b.remove(p.id);const empty=s.serialize();s.load(empty);assert.equal(b.state.pavings.length,0);
});
test('four outdoor tile styles preserve physical texture density through move, resize, rotation and reload',()=>{
  prepare();const id=b.addPaving({x:24,z:0});assert.ok(id,b.lastError);const styles=b.outdoorStyles.filter(s=>s.family==='tiles');assert.equal(styles.length,4);
  for(const style of styles){assert.ok(b.setStyle(id,style.id));assert.ok(b.updatePaving(id,{width:5,depth:2}));const finish=b.getModel(id).getObjectByName('OutdoorPlotFinish');near(finish.material.map.repeat.x/5,1/style.span);near(finish.material.map.repeat.y/2,1/style.span);assert.equal(finish.geometry.parameters.width,5);assert.ok(b.rotatePaving(id));assert.equal(b.paving(id).width,2);assert.equal(b.paving(id).depth,5)}
  assert.equal(b.updatePaving(id,{width:.5}),false);assert.equal(b.updatePaving(id,{width:21}),false);assert.equal(b.updatePaving(id,{x:40}),false);assert.equal(b.addPaving({x:0,z:0}),false);
  const saved=s.serialize();s.loadSaved(saved);assert.deepEqual(s.serialize(),saved);
});
test('four garden styles have full brick edging, distinct flowers and animated daisy butterflies',()=>{
  prepare();const id=b.addPaving({x:24,z:0},'garden');assert.ok(id,b.lastError);const styles=b.outdoorStyles.filter(s=>s.family==='garden');assert.equal(styles.length,4);
  for(const style of styles){assert.ok(b.setStyle(id,style.id));const root=b.getModel(id),border=root.getObjectByName('BrickEdging');assert.ok(border.isInstancedMesh);const bounds=new THREE.Box3().setFromObject(border);near(bounds.max.x-bounds.min.x,4);near(bounds.max.z-bounds.min.z,3);
    const flowers=root.getObjectByName('FlowerPetals');assert.equal(!!flowers,style.id!=='grass');assert.equal(!!root.getObjectByName('GardenButterfly'),style.id==='daisies');
    if(style.id==='daisies'){b.animate(1);const butterfly=root.getObjectByName('GardenButterfly'),before=butterfly.position.clone(),wing=butterfly.children[0].rotation.y,saved=s.serialize();b.animate(2);assert.ok(before.distanceTo(butterfly.position)>.1);assert.notEqual(wing,butterfly.children[0].rotation.y);assert.deepEqual(s.serialize(),saved)}
  }
  assert.equal(b.setStyle(id,'stone'),false);assert.ok(b.updatePaving(id,{width:1,depth:1}));assert.ok(b.getModel(id).getObjectByName('BrickEdging').count>0);
});
test('paving edits share undo and cancellation and dispose replaced map resources',()=>{
  prepare();const before=s.serialize();s.beginGesture();const id=b.addPaving({x:24,z:0},'garden');b.setStyle(id,'daisies');s.commitGesture();const saved=s.serialize();s.undo();assert.deepEqual(s.serialize(),before);s.redo();assert.deepEqual(s.serialize(),saved);
  const map=b.getModel(id).getObjectByName('OutdoorPlotFinish').material.map;let disposed=false;map.addEventListener('dispose',()=>disposed=true);s.beginGesture();b.updatePaving(id,{width:5});assert.equal(disposed,true);s.cancelGesture();assert.deepEqual(s.serialize(),saved);
});
test('spray patches are picked in front of paving and move, delete and undo independently',()=>{
  prepare();const paving=b.addPaving({x:24,z:0});assert.ok(paving);scene.updateMatrixWorld(true);scatter.refresh();
  scatter.beginStroke();scatter.paint('petals',new THREE.Vector3(23,.21,0),.1);scatter.flush();scatter.endStroke();scatter.beginStroke();scatter.paint('leaves',new THREE.Vector3(25,.21,0),.1);scatter.flush();scatter.endStroke();
  const data=scatter.serialize(),id=data.find(c=>c.type==='petals').patch,other=data.filter(c=>c.type==='leaves');assert.notEqual(id,other[0].patch);
  const batch=scatter.root.getObjectByName('Scatter-petals'),matrix=new THREE.Matrix4(),position=new THREE.Vector3();batch.getMatrixAt(0,matrix);position.setFromMatrixPosition(matrix);scene.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(position.x,20,position.z),new THREE.Vector3(0,-1,0));const hit=pickSceneSurface(ray,{system:s});assert.equal(hit.object.userData.furnitureId,id);assert.equal(s.get(id).kind,'scatter');
  const r=s.get(id),before=s.serialize();s.beginGesture();assert.ok(s.movePreview(id,r.root.position.x,r.root.position.z+1));s.commitGesture();const moved=s.serialize();assert.deepEqual(scatter.serialize().filter(c=>c.type==='leaves'),other);assert.equal(s.movePreview(id,0,0),false);assert.deepEqual(s.serialize(),moved);s.undo();assert.deepEqual(s.serialize(),before);s.redo();assert.deepEqual(s.serialize(),moved);
  s.remove(id);assert.equal(scatter.serialize().some(c=>c.patch===id),false);assert.deepEqual(scatter.serialize(),other);s.undo();assert.deepEqual(s.serialize(),moved);s.loadSaved(moved);assert.deepEqual(s.serialize(),moved);
});
test('snow maximum grows exactly four times, retains seven anchors and refuses oversized edge growth',()=>{
  const point=prepare();near(SNOW_SIZES[2].radius,.135*4);near(SNOW_SIZES[2].height,.085*4);
  scatter.paint('snow',point,.1);scatter.flush();const batch=scatter.root.getObjectByName('Scatter-snow'),count=batch.count;scatter.paint('snow',point,3);scatter.flush();assert.equal(batch.count,count);assert.equal(scatter.levelAt('snow',point),3);
  scatter.beginStroke();const edge=new THREE.Vector3(26.5,.14,0);scatter.paint('snow',edge,.1);scatter.flush();assert.equal(scatter.levelAt('snow',edge),1);scatter.paint('snow',edge,3);scatter.flush();assert.equal(scatter.levelAt('snow',edge),1);
  const id=scatter.serialize().find(c=>c.x===48&&c.z===0).patch,before=s.serialize();assert.equal(s.movePreview(id,26.5,0),false);assert.deepEqual(s.serialize(),before);
});
s.load(initial);console.log(JSON.stringify({passed:cases.length,cases,scope:'CPU real geometry, texture parameters, picking, animation, history and save'},null,2));
