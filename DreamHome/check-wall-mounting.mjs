import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';

export function checkWallMounting({system,scene,test,reset}){
  const a=system.architecture,p=system.placement,art=system.get('wall-art-3');
  // Measure real mesh vertices in world space against the structural plane.
  function bodyGap(r,w,sign){
    scene.updateMatrixWorld(true);
    const d=w.lengthAxis==='z'?'x':'z',local=new THREE.Vector3();local[d]=sign;
    const n=local.applyQuaternion(w.root.quaternion),b=w.collisionBounds||w.localBounds,q=new THREE.Vector3();q[d]=b[sign>0?'max':'min'][d];w.root.localToWorld(q);
    let nearest=Infinity;const v=new THREE.Vector3();
    r.root.traverse(o=>{if(!o.isMesh)return;const positions=o.geometry.attributes.position;for(let i=0;i<positions.count;i++){v.fromBufferAttribute(positions,i).applyMatrix4(o.matrixWorld);nearest=Math.min(nearest,v.sub(q).dot(n))}});
    return nearest;
  }
  const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-5,`${actual} != ${expected}`);
  const place=(r,w,x=0,y=1.8,sign)=>{w.root.updateWorldMatrix(true,true);const along=w.lengthAxis||'x',point=new THREE.Vector3(0,y,0);point[along]=x;w.root.localToWorld(point);return system.movePreview(r.id,point.x,point.z,point.y,false,w.id,sign)};
  test('every authored wall decoration is assigned an interior face and clears the actual wall body',()=>{
    for(const r of system.all().filter(r=>r.kind==='mounted')){
      assert.equal(r.mount?.side,'interior',r.id);assert.equal(r.mount.faceSign,1,r.id);
      assert.ok(bodyGap(r,system.get(r.mount.wallId),1)>=.01-1e-5,r.id);
    }
    assert.deepEqual(a.faces(system.get('wall-4')).map(f=>[f.sign,f.side]),[[-1,'interior'],[1,'exterior']]);reset();
  });
  test('pictures and windows mount on the back, left and right interior surfaces with 0.01m clearance',()=>{
    for(const id of ['wall-art-3','wall-art-5','window-lobby'])for(const [wallId,sign]of [['wall-2',1],['wall-3',1],['wall-4',-1]]){
      const r=system.get(id),w=system.get(wallId);assert.ok(place(r,w,0,1.8),`${id} -> ${wallId}`);assert.equal(r.mount.faceSign,sign);assert.ok(bodyGap(r,w,sign)>=.01-1e-5,`${id} -> ${wallId}`);if(id!=='window-lobby')near(bodyGap(r,w,sign),.01);
      const sourceAngle=r.mountWallId==='wall-3'?Math.PI/2:0,front=new THREE.Vector3(Math.sin(r.root.rotation.y+sourceAngle),0,Math.cos(r.root.rotation.y+sourceAngle));assert.ok(front.dot(a.normal(w,sign))>.9999);
    }reset();
  });
  test('raycasting distinguishes both faces and rejects exterior drops without passing through a wall',()=>{
    const w=system.get('wall-4');scene.updateMatrixWorld(true);
    const inside=new THREE.Raycaster(new THREE.Vector3(6,3,-2.55),new THREE.Vector3(1,0,0)),outside=new THREE.Raycaster(new THREE.Vector3(10,3,-2.55),new THREE.Vector3(-1,0,0));
    const hit=p.pick(inside,art.id);assert.equal(hit.wallId,w.id);assert.equal(hit.faceSign,-1);assert.equal(p.pick(outside,art.id),null);
    const before=system.serialize();assert.equal(place(art,w,0,1.8,1),false);assert.deepEqual(system.serialize(),before);
    assert.ok(system.movePreview(art.id,hit.x,hit.z,hit.y,false,hit.wallId,hit.faceSign));near(bodyGap(art,w,-1),.01);reset();
  });
  test('raised wall panelling supports low wall decorations without using a distant cornice as the surface',()=>{
    const w=system.get('wall-2');assert.ok(place(art,w,1,.3));assert.ok(bodyGap(art,w,1)>.1);
    assert.ok(place(art,w,1,2));near(bodyGap(art,w,1),.01);reset();
  });
  test('interior attachments follow wall movement, rotation, length and height edits without scaling',()=>{
    const w=system.get('wall-4');assert.ok(place(art,w,0,1.8));const start=system.serialize();system.beginGesture();
    assert.ok(system.movePreview(w.id,4,0));assert.ok(system.rotationPreview(w.id,30));assert.ok(system.lengthPreview(w.id,3.8));
    const baseline={position:w.root.position.clone(),scale:w.root.scale.clone()};assert.ok(system.resizeWallPreview(w.id,'top',.4,baseline));near(bodyGap(art,w,-1),.01);assert.deepEqual(art.root.scale.toArray(),[1,1,1]);
    system.commitGesture();const end=system.serialize();system.undo();assert.deepEqual(system.serialize(),start);system.redo();assert.deepEqual(system.serialize(),end);
    for(let i=0;i<3;i++){system.loadSaved(end);assert.deepEqual(system.serialize(),end);near(bodyGap(art,w,-1),.01)}reset();
  });
  test('legacy center-based wall mounts migrate once and library copies keep the corrected face',()=>{
    const legacy=system.serialize(),item=legacy.items.find(v=>v.id===art.id);delete item.mount.side;delete item.mount.faceSign;item.mount.local[2]=0;item.position[2]=system.get(item.mount.wallId).root.position.z;
    system.loadSaved(legacy);assert.equal(art.mount.side,'interior');assert.ok(bodyGap(art,system.get(art.mount.wallId),1)>=.01-1e-5);
    const migrated=system.serialize();system.loadSaved(migrated);assert.deepEqual(system.serialize(),migrated);
    const copy=system.beginPlacement(art.sourceId,'catalog'),w=system.get('wall-4');assert.ok(place(copy,w,0,1.8));near(bodyGap(copy,w,-1),.01);system.cancelPlacement(copy.id,true);assert.deepEqual(system.serialize(),migrated);reset();
  });
  test('new rooms support all four inward wall faces and shared walls retain the chosen room side',()=>{
    const build=system.construction,room=build.addRoom({x:14,z:0});assert.ok(room);
    for(const [edge,sign]of [['back',1],['front',-1],['left',1],['right',-1]]){
      const id=build.addWall(room,edge),w=system.get(id);assert.ok(place(art,w,0,1.5));assert.equal(art.mount.faceSign,sign);assert.equal(art.mount.roomId,room);near(bodyGap(art,w,sign),.01);
    }
    const other=build.addRoom({x:20,z:0}),shared=build.addWall(other,'left'),w=system.get(shared);assert.deepEqual(a.faces(w).map(f=>f.side),['interior','interior']);
    for(const sign of [-1,1]){assert.ok(place(art,w,0,1.5,sign));near(bodyGap(art,w,sign),.01);assert.equal(art.mount.roomId,sign<0?room:other);const saved=system.serialize();system.loadSaved(saved);assert.deepEqual(system.serialize(),saved)}
    reset();
  });
  test('mounted items cannot be dropped across a door opening or extend beyond the structural wall',()=>{
    const build=system.construction,room=build.addRoom({x:14,z:0}),id=build.addWall(room,'back');assert.ok(build.addDoor(id));const w=system.get(id),before=system.serialize();
    assert.equal(place(art,w,0,.3),false);assert.deepEqual(system.serialize(),before);assert.ok(place(art,w,2,1));near(bodyGap(art,w,1),.01);
    assert.ok(place(art,w,20,20));const extent=new THREE.Box3().setFromObject(art.root),wallExtent=new THREE.Box3().setFromObject(w.root);assert.ok(extent.max.x<=wallExtent.max.x+1e-6);assert.ok(extent.max.y<=wallExtent.max.y+1e-6);reset();
  });
}
