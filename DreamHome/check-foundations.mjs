import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';
import {groundUnionGeometry} from './foundation-system.js';

export function checkFoundations({system,scene,build,check,room,initial}){
  const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
  const hit=(x,z)=>{scene.updateMatrixWorld(true);return system.placement.supportAt(x,z,100,'__foundation_check__')};
  const box=id=>new THREE.Box3().setFromObject(build.getModel(id));
  const shape=()=>build.ground.root.children.map(m=>Array.from(m.geometry.attributes.position.array));
  check('new rooms separate inset floor, raised cream border, foundation body and lower outdoor ground',()=>{
    const id=room(),root=build.getModel(id),floor=system.floorSystem.get(id),border=root.getObjectByName('FoundationBorder'),body=root.getObjectByName('FoundationBody');
    const b=box(id);near(b.max.x-b.min.x,6);near(b.min.y,.14);near(b.max.y,1.02);near(floor.width,5.6);near(floor.depth,5.6);
    assert.equal(hit(14,0).id,'floor-1');near(hit(14,0).point.y,1.02);assert.equal(hit(16.9,0).id,'foundation');near(hit(16.9,0).point.y,1.01);
    assert.equal(hit(17.5,0).id,'outdoor');assert.ok(hit(17.5,0).object);near(hit(17.5,0).point.y,.14);
    const borderMaterial=border.material,bodyMaterial=body.material;
    for(const style of system.floorSystem.styles){system.floorPreview(id,style.id);assert.equal(border.material,borderMaterial);assert.equal(body.material,bodyMaterial);assert.equal(border.material.map,null);assert.equal(body.material.map,null)}
    const r=system.get('plant-salon');assert.ok(system.movePreview(r.id,17.5,0,hit(17.5,0).point.y));near(r.root.position.y,.15);
  });
  check('adjacent foundations share one ground surface, without duplicate top faces or internal side walls',()=>{
    room(24);room(30);const cap=build.ground.root.children.at(-1),geometry=cap.geometry,positions=geometry.attributes.position,normals=geometry.attributes.normal;
    near(geometry.userData.area,18.5*15.4+14*8);
    const triangleKeys=new Set();
    for(let i=0;i<positions.count;i+=3){
      const vertices=[0,1,2].map(k=>[positions.getX(i+k),positions.getY(i+k),positions.getZ(i+k)]),key=vertices.map(v=>v.join(',')).sort().join(';');assert.ok(!triangleKeys.has(key),'duplicate face');triangleKeys.add(key);
      if(Math.abs(normals.getY(i))<.5){const center=vertices.reduce((v,p)=>v.add(new THREE.Vector3(...p)),new THREE.Vector3()).multiplyScalar(1/3);assert.ok(!(center.x>20.01&&center.x<33.99&&center.z>-3.99&&center.z<3.99),'internal vertical seam')}
    }
    near(hit(27,3.5).point.y,.14);assert.equal(hit(27,3.5).id,'outdoor');
    const ray=new THREE.Raycaster(new THREE.Vector3(26.8,2,3.4),new THREE.Vector3(0,-1,0));assert.equal(ray.intersectObject(cap).length,1);
  });
  check('ground union preserves L-shaped recesses, enclosed holes and separated islands',()=>{
    const rect=(minX,maxX,minZ,maxZ)=>({minX,maxX,minZ,maxZ});
    const cases=[
      {rects:[rect(0,6,0,6),rect(6,12,0,6),rect(0,6,6,12)],area:108,empty:[9,9],filled:[3,9]},
      {rects:[rect(0,12,0,3),rect(0,12,9,12),rect(0,3,3,9),rect(9,12,3,9)],area:108,empty:[6,6],filled:[10,6]},
      {rects:[rect(0,3,0,3),rect(9,12,0,3)],area:18,empty:[6,1],filled:[10,1]}
    ];
    for(const c of cases){const g=groundUnionGeometry(c.rects,-.7,.14),m=new THREE.Mesh(g,new THREE.MeshBasicMaterial());near(g.userData.area,c.area);m.updateMatrixWorld(true);const rayAt=([x,z])=>new THREE.Raycaster(new THREE.Vector3(x,5,z),new THREE.Vector3(0,-1,0)).intersectObject(m);assert.equal(rayAt(c.empty).length,0);assert.ok(rayAt(c.filled).length>0);g.dispose();m.material.dispose()}
  });
  check('new ground merges into the original platform and restores it when additions are removed',()=>{
    const original=system.architecture.groundLayers.map(v=>v.mesh),parents=original.map(m=>m.parent),baseline=shape(),id=room(11.2);
    assert.ok(original.every(m=>m.parent===null));assert.equal(build.ground.root.children.length,2);
    const cap=build.ground.root.children.at(-1),extension=build.room(id);near(cap.geometry.userData.area,18.5*15.4+8*8-(9.25-(extension.x-4))*8);near(hit(8.6,-3.5).point.y,.14);
    build.remove(id);assert.deepEqual(shape(),baseline);original.forEach((m,i)=>assert.equal(m.parent,parents[i]));
  });
  check('ground follows move, resize, rotation and removal; undo and saved layouts reconstruct it exactly',()=>{
    const first=room(24),second=room(30);system.beginGesture();build.updateRoom(second,{x:40});build.updateRoom(second,{width:4,depth:8});build.rotateRoom(second);system.commitGesture();
    const saved=system.serialize(),ground=shape();assert.equal(hit(29,3.5).object,undefined);assert.ok(hit(40,2.5).object);
    system.undo();assert.equal(build.room(second).x,30);assert.ok(hit(29,3.5).object);system.redo();assert.deepEqual(system.serialize(),saved);assert.deepEqual(shape(),ground);
    for(let i=0;i<3;i++){system.loadSaved(saved);assert.deepEqual(system.serialize(),saved);assert.deepEqual(shape(),ground)}
    const before=system.serialize();system.beginGesture();build.remove(first);system.cancelGesture();assert.deepEqual(system.serialize(),before);assert.deepEqual(shape(),ground);
  });
  check('upper floors keep their bordered slab without adding a second ground platform',()=>{
    const first=room(24),before=shape(),upper=room(24,0,2);assert.deepEqual(shape(),before);const b=box(upper);near(b.max.y-build.height(build.room(upper)),0);near(b.max.y-b.min.y,.2);assert.equal(hit(24,0).id,'floor-2');assert.equal(build.remove(first),false);
  });
  check('snow props recognize expanded real ground and disappear when their supporting extension is removed',()=>{
    const id=room(24),scatter=system.scatter,point=new THREE.Vector3(24,.14,3.5);assert.ok(scatter.paint('snow',point,1));scatter.flush();assert.ok(scatter.root.getObjectByName('Scatter-snow').count>0);
    system.transaction(()=>build.remove(id));assert.equal(scatter.root.getObjectByName('Scatter-snow').count,0);system.undo();assert.ok(scatter.root.getObjectByName('Scatter-snow').count>0);system.load(initial);
  });
}
