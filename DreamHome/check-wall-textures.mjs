import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';

// Measure texture cycles per physical metre on each face, as the renderer sees
// them. Door headers and wall ends must have the same density as full panels.
function densities(wall){
  wall.root.updateWorldMatrix(true,true);const inverse=wall.root.matrixWorld.clone().invert(),results=[];
  wall.root.traverse(mesh=>{
    if(!mesh.isMesh||!wall.paint.includes(mesh.material)||!mesh.material.map)return;
    const matrix=new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld),normalMatrix=new THREE.Matrix3().getNormalMatrix(matrix),groups=new Map();
    const positions=mesh.geometry.attributes.position,normals=mesh.geometry.attributes.normal,uv=mesh.geometry.attributes.uv,map=mesh.material.map;map.updateMatrix();
    for(let i=0;i<positions.count;i++){
      const p=new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(matrix).multiply(wall.root.scale),n=new THREE.Vector3().fromBufferAttribute(normals,i).applyMatrix3(normalMatrix).normalize();
      const face=['x','y','z'].find(a=>Math.abs(n[a])>.999);if(!face)continue;
      const name=face+Math.sign(n[face]),axes=face==='x'?['z','y']:face==='y'?['x','z']:['x','y'],t=new THREE.Vector2().fromBufferAttribute(uv,i).applyMatrix3(map.matrix);
      if(!groups.has(name))groups.set(name,{p:new THREE.Box2(),uv:new THREE.Box2()});const group=groups.get(name);group.p.expandByPoint(new THREE.Vector2(p[axes[0]],p[axes[1]]));group.uv.expandByPoint(t);
    }
    for(const [face,g]of groups){const physical=g.p.getSize(new THREE.Vector2()),tiles=g.uv.getSize(new THREE.Vector2());if(physical.x>1e-5&&physical.y>1e-5)results.push({face,u:tiles.x/physical.x,v:tiles.y/physical.y})}
  });return results;
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<2e-5,`${a} should equal ${b}`);
const metric=wall=>{const values=densities(wall);assert.ok(values.length>=6);for(const d of values){near(d.u,1/1.8);near(d.v,1/1.8)}return values};

export function checkWallTextures({system,test,reset}){
  test('original wallpapers keep their physical density on both wall axes through resizing, save and undo',()=>{
    for(const id of ['wall-1','wall-3']){
      const wall=system.get(id),other=system.get(id==='wall-1'?'wall-3':'wall-1'),before=densities(wall),otherBefore=densities(other),map=wall.paint[0].map,repeat=map.repeat.clone();
      const template=system.templates.get(id).root.children.find(o=>o.material.map),templateUV=Array.from(template.geometry.attributes.uv.array);
      system.beginGesture();assert.ok(system.lengthPreview(id,wall.localBounds.getSize(new THREE.Vector3())[wall.lengthAxis]*.85));
      const baseline={position:wall.root.position.clone(),scale:wall.root.scale.clone()};assert.ok(system.resizeWallPreview(id,'top',1.2,baseline));
      const after=densities(wall);assert.equal(after.length,before.length);after.forEach((d,i)=>{near(d.u,before[i].u);near(d.v,before[i].v)});
      assert.deepEqual(densities(other),otherBefore);assert.deepEqual(map.repeat,repeat);assert.deepEqual(Array.from(template.geometry.attributes.uv.array),templateUV);
      system.commitGesture();const saved=system.serialize();system.undo();assert.deepEqual(densities(wall),before);system.redo();assert.deepEqual(densities(wall),after);system.loadSaved(saved);assert.deepEqual(densities(wall),after);reset();
    }
  });
  test('chosen wall materials tile at equal physical density on front, side and top faces',()=>{
    for(const id of ['wall-1','wall-3'])for(const style of ['brick','wood','wallpaper']){
      const wall=system.get(id);system.beginGesture();system.materialPreview(id,style);metric(wall);
      assert.ok(system.lengthPreview(id,wall.localBounds.getSize(new THREE.Vector3())[wall.lengthAxis]*.85));
      assert.ok(system.resizeWallPreview(id,'top',1,{position:wall.root.position.clone(),scale:wall.root.scale.clone()}));metric(wall);
      system.cancelGesture();reset();
    }
  });
  test('new walls preserve texture density and matching seams around door openings when rebuilt or rotated',()=>{
    const build=system.construction;system.beginGesture();const room=build.addRoom({x:14,z:0}),id=build.addWall(room,'back'),door=build.addDoor(id,.5);assert.ok(door);
    build.setStyle(id,'brick');metric(build.getWall(id));assert.ok(build.updateWall(id,{width:5}));assert.ok(build.setHeight(4.5));assert.ok(build.updateDoor(door,{width:1.4,height:2.5}));metric(build.getWall(id));
    const wall=build.getWall(id),seams=new Map();let matches=0;
    for(const mesh of wall.root.children.filter(o=>o.material===wall.paint[0])){
      mesh.updateMatrix();const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal,uv=mesh.geometry.attributes.uv;
      for(let i=0;i<p.count;i++){if(n.getZ(i)<.999)continue;const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrix),key=v.toArray().map(x=>x.toFixed(5)).join(':');const value=[uv.getX(i)*mesh.material.map.repeat.x,uv.getY(i)*mesh.material.map.repeat.y];
        if(seams.has(key)){const previous=seams.get(key);previous.forEach((x,j)=>near(x,value[j]));matches++}else seams.set(key,value);
      }
    }
    assert.ok(matches>0);assert.ok(build.rotateRoom(room));metric(build.getWall(id));system.commitGesture();const saved=system.serialize();system.loadSaved(saved);metric(build.getWall(id));reset();
  });
}
