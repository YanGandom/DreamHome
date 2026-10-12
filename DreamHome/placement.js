import * as THREE from './vendor/three.module.js';

export const SURFACE_GAP=.01;

export function createPlacement({surfaces,walls=[],getFurniture=()=>[],architecture=null,floorSystem=null,groundY=.14}){
  const down=new THREE.Raycaster(),normal=new THREE.Vector3(),matrix=new THREE.Matrix3();let activeSurface='auto';
  const records=()=>getFurniture(),record=id=>records().find(r=>r.id===id)||architecture?.walls().find(r=>r.id===id),wallRecords=()=>architecture?.walls()||[];
  function describe(hit){
    let node=hit.object,id;while(node&&!id){id=node.userData.surfaceId;node=node.parent}
    const r=record(hit.object.userData.furnitureId);
    if(r?.kind==='wall')id=r.wallTop?'wall-top':'wall-face';else if(r?.kind==='mounted')id='wall-face';else if(r)id=r.mount?.type==='top'?'wall-top':r.surface;
    return{id:id||'other',wallId:r?.kind==='wall'?r.id:r?.mount?.wallId,point:hit.point.clone(),object:hit.object,record:r};
  }
  const targets=id=>[...(typeof surfaces==='function'?surfaces():surfaces),...records().filter(r=>r.id!==id&&r.root.visible&&r.mount?.wallId!==id).map(r=>r.root)];
  function supportHit(raycaster,id){
    const moved=record(id);
    if(moved?.kind==='mounted'){
      for(const hit of raycaster.intersectObjects(wallRecords().map(w=>w.root),true)){
        normal.copy(hit.face.normal).applyMatrix3(matrix.getNormalMatrix(hit.object.matrixWorld)).normalize();
        const w=record(hit.object.userData.furnitureId),face=architecture.classifyFace(w,normal);
        // A visible outside/end/top face blocks the drop; never raycast
        // through it to a different wall deeper inside the house.
        if(!face||face.side!=='interior')return null;
        return{...describe(hit),id:'wall-face',side:face.side,faceSign:face.sign,roomId:face.roomId};
      }return null;
    }
    for(const hit of raycaster.intersectObjects(targets(id),true)){
      const surface=describe(hit);if(surface.record?.kind==='mounted')continue;
      normal.copy(hit.face.normal).applyMatrix3(matrix.getNormalMatrix(hit.object.matrixWorld)).normalize();
      if(activeSurface!=='auto'&&surface.id!==activeSurface)continue;
      if(surface.id==='wall-face'){if(activeSurface==='auto')return surface;continue}
      if(normal.y>.45)return surface;
      if(surface.record?.kind==='wall'&&activeSurface==='auto')return surface;
    }return null;
  }
  function pickSurface(raycaster,id){
    const r=record(id);
    if(r?.kind==='wall'){
      const excluded=new Set([id,...architecture.stacking.descendants(id).map(w=>w.id)]);
      const first=raycaster.intersectObjects([...(typeof surfaces==='function'?surfaces():surfaces),...wallRecords().filter(w=>!excluded.has(w.id)).map(w=>w.root)],true).find(h=>!excluded.has(h.object.userData.furnitureId));
      const base=first&&record(first.object.userData.furnitureId);
      if(base?.kind==='wall'){normal.copy(first.face.normal).applyMatrix3(matrix.getNormalMatrix(first.object.matrixWorld));if(normal.y>.45){const point=first.point.clone();point.y=architecture.bounds(base).max.y+.01-r.localBounds.min.y*r.root.scale.y;return{id:'wall-top',point,wallId:base.id}}}
      const hit=raycaster.intersectObjects(typeof surfaces==='function'?surfaces():surfaces,true).find(h=>h.object.userData.buildType==='room'&&h.face.normal.y>.5);
      if(hit){const point=hit.point.clone();point.y+=r.initial.y-1.02;return{id:'foundation',point}}
      const point=raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-r.root.position.y),new THREE.Vector3());return point?{id:'foundation',point}:null;
    }
    const hit=supportHit(raycaster,id);if(hit)return hit;
    if(r?.kind==='mounted'||!['auto','outdoor'].includes(activeSurface))return null;
    const point=raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-groundY),new THREE.Vector3());return point?{id:'outdoor',point}:null;
  }
  function pick(raycaster,id){const s=pickSurface(raycaster,id);if(!s)return null;s.point.surfaceId=s.id;s.point.wallId=s.wallId;s.point.faceSign=s.faceSign;return s.point}
  function supportAt(x,z,hint=Infinity,id){down.set(new THREE.Vector3(x,Number.isFinite(hint)?hint+.10:100,z),new THREE.Vector3(0,-1,0));return pickSurface(down,id)}
  function heightAt(x,z,hint=Infinity,id){return supportAt(x,z,hint,id)?.point.y??groundY}
  // Raised floor patterns must clear the whole footprint, including a rug whose
  // center happens to fall in a grout gap. Never jump to the floor above it.
  function floorHeight(r,x,z,hint){
    const transform=new THREE.Matrix4().compose(new THREE.Vector3(x,0,z),r.root.quaternion,r.root.scale),footprint=r.localBounds.clone().applyMatrix4(transform);let height=-Infinity;
    for(const floor of floorSystem?.all()||[]){if(!(floor.base.layers.mask&1))continue;floor.root.updateWorldMatrix(true,true);const b=new THREE.Box3().setFromObject(floor.root);if(b.max.y>hint+.1)continue;
      if(footprint.min.x<b.max.x&&footprint.max.x>b.min.x&&footprint.min.z<b.max.z&&footprint.max.z>b.min.z)height=Math.max(height,b.max.y);
    }return height;
  }
  function restingHeight(r,x,z,surfaceY){return Math.max(surfaceY,floorHeight(r,x,z,surfaceY))+SURFACE_GAP-r.localBounds.min.y}
  function ensureClearance(r){
    if(r.kind!=='furniture')return;
    const {x,y,z}=r.root.position,bottom=y+r.localBounds.min.y;
    // Normalizing saves uses architecture and already-normalized rugs only.
    // Excluding peer furniture avoids lifting stacked/coplanar models each load.
    const bases=[...(typeof surfaces==='function'?surfaces():surfaces),...wallRecords().filter(w=>w.wallTop).map(w=>w.root)];
    if(r.category!=='rugs')bases.push(...records().filter(other=>other.category==='rugs'&&other.root.visible).map(other=>other.root));
    down.set(new THREE.Vector3(x,bottom+.25,z),new THREE.Vector3(0,-1,0));
    let height=groundY;
    for(const hit of down.intersectObjects(bases,true)){normal.copy(hit.face.normal).applyMatrix3(matrix.getNormalMatrix(hit.object.matrixWorld)).normalize();if(normal.y>.45){height=hit.point.y;break}}
    const mountedWall=r.mount?.type==='top'?record(r.mount.wallId):null;
    if(mountedWall)height=Math.max(height,architecture.bounds(mountedWall).max.y);
    const wanted=Math.max(height,floorHeight(r,x,z,bottom))+SURFACE_GAP-r.localBounds.min.y;
    if(wanted>y+1e-7){r.root.position.y=wanted;r.root.updateMatrixWorld(true);architecture?.bindSupport(r)}
  }
  function wallAt(x,z){return wallRecords().some(w=>{const p=w.root.worldToLocal(new THREE.Vector3(x,w.root.position.y,z)),b=w.localBounds;return p.x>b.min.x&&p.x<b.max.x&&p.z>b.min.z&&p.z<b.max.z})}
  function valid(r,x,y,z){
    if(![x,y,z].every(Number.isFinite))return false;if(r.kind==='wall'||r.kind==='mounted')return true;
    const b=r.localBounds,size=b.getSize(new THREE.Vector3()),center=b.getCenter(new THREE.Vector3()),a=r.root.rotation.y,c=Math.cos(a),s=Math.sin(a);
    const position=new THREE.Vector3(x+c*center.x+s*center.z,y+center.y,z-s*center.x+c*center.z),axes=[new THREE.Vector2(c,-s),new THREE.Vector2(s,c)],halves=[size.x/2,size.z/2];
    const columns=architecture?wallRecords().flatMap(w=>{if(w.dynamic){const boxes=[];w.root.traverse(o=>{if(o.isMesh){const b=new THREE.Box3().setFromObject(o);boxes.push({p:b.getCenter(new THREE.Vector3()),size:b.getSize(new THREE.Vector3()),angle:0})}});return boxes}const wb=w.collisionBounds||w.localBounds,sz=wb.getSize(new THREE.Vector3()).multiply(w.root.scale),p=w.root.localToWorld(wb.getCenter(new THREE.Vector3()));return{p,size:sz,angle:w.root.rotation.y}}):walls.map(w=>({p:w.getCenter(new THREE.Vector3()),size:w.getSize(new THREE.Vector3()),angle:0}));
    return !columns.some(w=>{
      if(y+b.min.y>=w.p.y+w.size.y/2-.035||y+b.max.y<=w.p.y-w.size.y/2+.01)return false;
      const wc=Math.cos(w.angle),ws=Math.sin(w.angle),wa=[new THREE.Vector2(wc,-ws),new THREE.Vector2(ws,wc)],wh=[w.size.x/2,w.size.z/2],delta=new THREE.Vector2(position.x-w.p.x,position.z-w.p.z);
      return [...axes,...wa].every(axis=>Math.abs(delta.dot(axis))<halves.reduce((n,h,i)=>n+h*Math.abs(axes[i].dot(axis)),0)+wh.reduce((n,h,i)=>n+h*Math.abs(wa[i].dot(axis)),0)-.005);
    });
  }
  return{pick,pickSurface,supportAt,heightAt,restingHeight,ensureClearance,valid,wallAt,describe,setSurface:id=>{activeSurface=id},get activeSurface(){return activeSurface}};
}
