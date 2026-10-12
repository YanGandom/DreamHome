import * as THREE from './vendor/three.module.js';

// Both catalog walls and constructed walls use the same support relationship.
export function createWallStacking({system,walls,bounds}){
  const supportId=r=>r?.dynamic?r.data.supportId:r?.mount?.type==='stack'?r.mount.wallId:null;
  const link=r=>r.dynamic?{local:r.data.supportLocal,rotation:r.data.supportRotation}:r.mount;
  function descendants(id){const result=[],seen=new Set([id]);for(const parent of seen)for(const r of walls())if(supportId(r)===parent&&!seen.has(r.id)){seen.add(r.id);result.push(r)}return result}
  function fits(r,base){
    if(!base||base.id===r.id||descendants(r.id).some(v=>v.id===base.id))return false;
    r.root.updateWorldMatrix(true,true);base.root.updateWorldMatrix(true,true);
    const a=r.lengthAxis||'x',b=base.lengthAxis||'x',tangent=new THREE.Vector3(a==='x'?1:0,0,a==='z'?1:0).applyQuaternion(r.root.quaternion),bt=new THREE.Vector3(b==='x'?1:0,0,b==='z'?1:0).applyQuaternion(base.root.quaternion);
    if(Math.abs(tangent.dot(bt))<.999)return false;
    const body=r.collisionBounds||r.localBounds,allowed=base.localBounds.clone();if(base.dynamic){const cross=b==='x'?'z':'x';allowed.min[cross]=-.18;allowed.max[cross]=.18}
    for(const x of [body.min.x,body.max.x])for(const z of [body.min.z,body.max.z]){const p=base.root.worldToLocal(r.root.localToWorld(new THREE.Vector3(x,body.min.y,z)));if(p.x<allowed.min.x-.04||p.x>allowed.max.x+.04||p.z<allowed.min.z-.04||p.z>allowed.max.z+.04)return false}
    return true;
  }
  function pose(r,base,point){
    base.root.updateWorldMatrix(true,true);const local=base.root.worldToLocal(point.clone()),axis=base.lengthAxis||'x',cross=axis==='x'?'z':'x',center=base.localBounds.getCenter(new THREE.Vector3());local[cross]=center[cross];local.y=0;
    r.root.rotation.y=base.root.rotation.y+(axis==='z'?Math.PI/2:0)-(r.lengthAxis==='z'?Math.PI/2:0);
    const bodyCenter=(r.collisionBounds||r.localBounds).getCenter(new THREE.Vector3()).multiply(r.root.scale);bodyCenter.y=0;bodyCenter.applyQuaternion(r.root.quaternion);
    r.root.position.copy(base.root.localToWorld(local)).sub(bodyCenter);r.root.position.y=bounds(base).max.y+.01-r.localBounds.min.y*r.root.scale.y;r.root.updateMatrixWorld(true);
    return fits(r,base);
  }
  function bind(r,base){
    const local=base.root.worldToLocal(r.root.position.clone()).toArray(),rotation=r.root.rotation.y-base.root.rotation.y;
    if(r.dynamic){Object.assign(r.data,{supportId:base.id,supportLocal:local,supportRotation:rotation})}
    else r.mount={wallId:base.id,type:'stack',local,rotation,topGap:.01};
  }
  function sync(){
    const done=new Set(),visiting=new Set();
    function update(r){if(done.has(r.id))return true;if(visiting.has(r.id))return false;visiting.add(r.id);const id=supportId(r);if(id){const base=system.get(id);if(!base?.root.visible||!update(base))return false;const data=link(r);if(!Array.isArray(data?.local))return false;
      r.root.position.copy(base.root.localToWorld(new THREE.Vector3(...data.local)));r.root.position.y=bounds(base).max.y+.01-r.localBounds.min.y*r.root.scale.y;r.root.rotation.y=base.root.rotation.y+data.rotation;r.root.updateMatrixWorld(true);
      if(r.dynamic)Object.assign(r.data,{x:r.root.position.x,z:r.root.position.z,angle:r.root.rotation.y});
    }visiting.delete(r.id);done.add(r.id);return true}
    for(const r of walls())if(!update(r))r.root.visible=false;
  }
  function minimumLength(base){
    const axis=base.lengthAxis||'x';let required=1;
    for(const r of walls().filter(r=>supportId(r)===base.id)){
      const offset=Math.abs(link(r).local[axis==='x'?0:2]*base.root.scale[axis]),length=r.localBounds.getSize(new THREE.Vector3())[r.lengthAxis||'x']*r.root.scale[r.lengthAxis||'x'];required=Math.max(required,offset*2+length);
    }return required;
  }
  function valid(r){const id=supportId(r);return !id||fits(r,system.get(id))}
  return{supportId,descendants,fits,pose,bind,sync,minimumLength,valid};
}
