import * as THREE from './vendor/three.module.js';
import {SURFACE_GAP} from './placement.js';

// Face signs belong to wall-local coordinates, so they follow wall rotation.
export function createWallMounting(system){
  const patches=new WeakMap();
  const axis=w=>w.lengthAxis||'x';
  const depth=w=>axis(w)==='x'?'z':'x';
  const body=w=>w.collisionBounds||w.localBounds;
  function faces(w){
    w.root.updateWorldMatrix(true,false);
    const owners=(w.data?.rooms||[]).map(id=>system.construction?.room(id)).filter(Boolean);
    const inside=owners.length?owners.map(r=>({sign:Math.sign(w.root.worldToLocal(new THREE.Vector3(r.x,w.root.position.y,r.z))[depth(w)])||1,roomId:r.id})):[{sign:w.interiorSign||1}];
    return [-1,1].map(sign=>({sign,side:inside.some(f=>f.sign===sign)?'interior':'exterior',roomId:inside.find(f=>f.sign===sign)?.roomId}));
  }
  function face(w,sign){const list=faces(w);return list.find(f=>f.side==='interior'&&f.sign===sign)||list.find(f=>f.side==='interior')}
  function angle(w,sign){return w.root.rotation.y+(axis(w)==='z'?Math.PI/2:0)+(face(w,sign).sign<0?Math.PI:0)}
  function normal(w,sign){const a=angle(w,sign);return new THREE.Vector3(Math.sin(a),0,Math.cos(a))}
  function classify(w,n){
    if(!w)return null;
    const positive=new THREE.Vector3();positive[depth(w)]=1;positive.applyQuaternion(w.root.quaternion);
    const dot=n.dot(positive);if(Math.abs(dot)<.8)return null;
    return faces(w).find(f=>f.sign===(dot>0?1:-1));
  }
  function sourceAngle(r){const source=system.templates.get(r.mountWallId);return (source?.lengthAxis==='z'?Math.PI/2:0)+(source?.interiorSign===-1?Math.PI:0)}
  function offsets(r,w,rotation=r.root.rotation.y-w.root.rotation.y){
    const transform=new THREE.Matrix4().makeScale(1/w.root.scale.x,1/w.root.scale.y,1/w.root.scale.z);
    transform.multiply(new THREE.Matrix4().makeRotationY(rotation)).multiply(new THREE.Matrix4().makeScale(...r.root.scale.toArray()));
    return r.localBounds.clone().applyMatrix4(transform);
  }
  function wallPatches(w){
    let cached=patches.get(w.root);if(cached)return cached;
    cached=[];w.root.updateWorldMatrix(true,true);const inverse=w.root.matrixWorld.clone().invert(),d=depth(w),along=axis(w);
    w.root.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const transform=new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld),positions=mesh.geometry.attributes.position,index=mesh.geometry.index;
      const count=index?index.count:positions.count,a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),n=new THREE.Vector3(),edge=new THREE.Vector3();
      for(let i=0;i<count;i+=3){
        a.fromBufferAttribute(positions,index?index.getX(i):i).applyMatrix4(transform);b.fromBufferAttribute(positions,index?index.getX(i+1):i+1).applyMatrix4(transform);c.fromBufferAttribute(positions,index?index.getX(i+2):i+2).applyMatrix4(transform);
        n.subVectors(b,a).cross(edge.subVectors(c,a)).normalize();if(Math.abs(n[d])<.8)continue;
        cached.push({sign:Math.sign(n[d]),lo:Math.min(a[along],b[along],c[along]),hi:Math.max(a[along],b[along],c[along]),bottom:Math.min(a.y,b.y,c.y),top:Math.max(a.y,b.y,c.y),near:Math.min(a[d],b[d],c[d]),far:Math.max(a[d],b[d],c[d])});
      }
    });patches.set(w.root,cached);return cached;
  }
  // Use the finish under the object's footprint, not the bounding box of a
  // remote cornice/pillar. Raised panelling is a real supporting surface too.
  function surface(w,sign,p,extent){
    const along=axis(w),d=depth(w);let value=body(w)[sign>0?'max':'min'][d];
    for(const patch of wallPatches(w))if(patch.sign===sign&&patch.hi>p[along]+extent.min[along]+1e-6&&patch.lo<p[along]+extent.max[along]-1e-6&&patch.top>p.y+extent.min.y+1e-6&&patch.bottom<p.y+extent.max.y-1e-6)value=sign>0?Math.max(value,patch.far):Math.min(value,patch.near);
    return value;
  }
  function fitsSolid(w,p,extent){
    if(!w.dynamic)return true;
    return !(system.construction?.state.doors||[]).some(d=>d.wallId===w.id&&p.x+extent.max.x>d.offset-d.width/2+1e-6&&p.x+extent.min.x<d.offset+d.width/2-1e-6&&p.y+extent.min.y<d.height-1e-6);
  }
  function place(r,w,p,sign,rotation){
    const f=face(w,sign),b=body(w),along=axis(w),d=depth(w),extent=offsets(r,w,rotation);
    const min=b.min[along]-extent.min[along],max=b.max[along]-extent.max[along],bottom=b.min.y-extent.min.y,top=b.max.y-extent.max.y;
    if(max<min-1e-6||top<bottom-1e-6)return false;
    p[along]=THREE.MathUtils.clamp(p[along],min,max);p.y=THREE.MathUtils.clamp(p.y,bottom,top);
    if(!fitsSolid(w,p,extent))return false;
    p[d]=surface(w,f.sign,p,extent)+f.sign*SURFACE_GAP/w.root.scale[d]-extent[f.sign>0?'min':'max'][d];
    const position=w.root.localToWorld(p.clone());
    // Keep stable serialized floats when loading a layout repeatedly.
    for(const component of ['x','y','z'])if(Math.abs(position[component]-r.root.position[component])>1e-9)r.root.position[component]=position[component];
    r.root.rotation.y=w.root.rotation.y+rotation;r.root.updateMatrixWorld(true);
    r.mount={wallId:w.id,type:'face',side:'interior',faceSign:f.sign,...(f.roomId?{roomId:f.roomId}:{}),local:p.toArray(),rotation};
    return true;
  }
  function move(r,point,wallId=r.mount?.wallId||r.mountWallId,sign){
    const w=system.get(wallId);if(w?.kind!=='wall'||!w.root.visible)return false;
    const p=w.root.worldToLocal(point.clone()),requested=sign??(r.mount?.wallId===wallId?r.mount.faceSign:undefined),f=face(w,requested);
    if(sign!==undefined&&(sign!==f.sign||![-1,1].includes(sign)))return false;
    const same=r.mount?.wallId===wallId&&r.mount.side==='interior'&&r.mount.faceSign===f.sign;
    const rotation=same?r.root.rotation.y-w.root.rotation.y:angle(w,f.sign)-w.root.rotation.y-sourceAngle(r);
    return place(r,w,p,f.sign,rotation);
  }
  function sync(r,w){
    const f=face(w,r.mount?.faceSign),modern=r.mount?.side==='interior'&&f.sign===r.mount.faceSign;
    return place(r,w,new THREE.Vector3(...r.mount.local),f.sign,modern?r.mount.rotation:angle(w,f.sign)-w.root.rotation.y-sourceAngle(r));
  }
  return{faces,face,angle,normal,classify,offsets,surface,move,sync,sourceAngle};
}
