import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';

export function checkDefaultComponents({system,build,check,room,initial}){
  const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
  check('default foundations share component geometry and old floor identifiers resolve without duplicate slabs',()=>{
    for(const [alias,id]of [['salon','build-room-1001'],['lobby','build-room-1002'],['balcony','build-room-1003']]){
      const r=build.room(id),root=build.getModel(id),floor=system.floorSystem.get(alias);
      assert.ok(r);assert.equal(floor.id,id);assert.equal(floor.dynamic,true);assert.ok(root.getObjectByName('FoundationBorder'));assert.ok(root.getObjectByName('FoundationBody'));assert.equal(floor.root.parent,root);
    }
    assert.equal(system.floorSystem.all().length,3);
    for(const id of ['stair-left','stair-right','balcony-railing']){const f=system.get(id);assert.ok(f);assert.ok(system.catalog().some(c=>c.id===f.catalogId))}
  });
  check('wall catalog has one yellow, red and low-brick family; copies edit independently on new and upper foundations',()=>{
    const lower=room(24),upper=room(24,0,2),families=system.catalog().filter(c=>c.kind==='wall');assert.equal(families.length,4);
    for(const sourceId of ['wall-1','wall-2','wall-5']){
      const original=system.get(sourceId),originalColor=original.paint[0].color.getHexString(),f=system.beginPlacement(sourceId,'catalog');assert.ok(f);
      near(f.localBounds.getSize(new THREE.Vector3())[f.lengthAxis]*f.root.scale[f.lengthAxis],3);
      assert.ok(system.movePreview(f.id,24,0,build.height(build.room(lower))+f.initial.y-1.02));assert.ok(system.rotationPreview(f.id,90));assert.ok(system.lengthPreview(f.id,4));assert.equal(system.lengthPreview(f.id,12),false);
      system.colorPreview(f.id,'#a4bfca');assert.equal(original.paint[0].color.getHexString(),originalColor);
      assert.ok(system.movePreview(f.id,24,0,build.height(build.room(upper))+f.initial.y-1.02));assert.ok(system.architecture.validWall(f));system.commitGesture();
      const saved=system.serialize();system.loadSaved(saved);assert.deepEqual(system.serialize(),saved);system.remove(f.id);assert.equal(f.root.visible,false);system.restore(f.id);assert.equal(f.root.visible,true);
    }
  });
  check('default foundation moves carry their walls and furnishings; deleting a furnished original persists and undoes',()=>{
    const id='build-room-1002',wall=system.get('wall-2'),chair=system.get('lobby-chair-a'),wp=wall.root.position.clone(),cp=chair.root.position.clone();
    assert.equal(build.updateRoom(id,{x:14}),false,'a wall spanning both foundations must be adjusted first');system.remove('wall-6');assert.ok(build.updateRoom(id,{x:14}),build.lastError);near(wall.root.position.x,wp.x+10);near(chair.root.position.x,cp.x+10);assert.equal(build.updateRoom(id,{width:3}),false);
    const before=system.serialize();system.beginGesture();assert.ok(build.removeFoundation('build-room-1001'));system.commitGesture();
    for(const removed of ['build-room-1001','build-room-1003'])assert.equal(build.room(removed),undefined);
    for(const removed of ['wall-1','wall-3','stair-left','stair-right','balcony-railing','salon-sofa','wall-art-3'])assert.equal(system.get(removed).root.visible,false,removed);
    assert.equal(wall.root.visible,true);assert.equal(chair.root.visible,true);
    const deleted=system.serialize();assert.equal(deleted.building.componentDefaults,1);system.loadSaved(deleted);assert.deepEqual(system.serialize(),deleted);assert.equal(build.all().length,1);system.undo();assert.deepEqual(system.serialize(),before);system.redo();assert.deepEqual(system.serialize(),deleted);
  });
  check('fixed-elevation balcony remains aligned with furniture when new-room wall heights change',()=>{
    const id='build-room-1003',plant=system.get('plant-balcony-a'),rail=system.get('balcony-railing'),y=build.height(build.room(id)),py=plant.root.position.y,ry=rail.root.position.y;
    build.setHeight(4);near(build.height(build.room(id)),y);near(plant.root.position.y,py);near(rail.root.position.y,ry);
    const before=rail.root.position.clone();assert.ok(build.updateRoom(id,{z:-3.4}),build.lastError);near(rail.root.position.z,before.z+.43);
  });
  check('legacy floor choices survive default-component migration, later rebuilds, rotation and a second load',()=>{
    const legacy=structuredClone(initial);delete legacy.building;legacy.floors={salon:'tile-floral',lobby:'wood-herringbone',balcony:'wood-planks'};
    assert.ok(system.loadSaved(legacy));for(const [alias,style]of Object.entries(legacy.floors)){const f=system.floorSystem.get(alias);assert.equal(f.styleId,style);assert.equal(build.room(f.id).floorStyle,style)}
    build.color('build-room-1001','#a4bfca');assert.equal(system.floorSystem.get('salon').styleId,'tile-floral');build.rotateFloor('build-room-1001');build.setStyle('build-room-1001','wood-long');near(system.floorSystem.get('salon').base.material.map.rotation,Math.PI/2);
    const saved=system.serialize();system.loadSaved(saved);assert.deepEqual(system.serialize(),saved);near(system.floorSystem.get('salon').base.material.map.rotation,Math.PI/2);
  });
}
