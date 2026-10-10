import * as THREE from './vendor/three.module.js';
import {SURFACE_GAP} from './placement.js';

// Editable objects own their materials and are batched only within that object.
// Geometry can be shared by copies; changing color never changes another item.
export function createFurnitureSystem({scene,specs,mergeGeometries,floorSystem=null}){
  const records=new Map(),templates=new Map(),listeners=new Set();
  const undoStack=[],redoStack=[];let serial=0,gesture=null,placement=null,architecture=null,construction=null;
  const emit=type=>listeners.forEach(fn=>fn(type));
  const cloneMaterials=root=>{const clones=new Map();root.traverse(o=>{if(o.isMesh){if(!clones.has(o.material))clones.set(o.material,o.material.clone());o.material=clones.get(o.material)}})};

  for(const spec of specs){
    const bounds=new THREE.Box3();
    for(const mesh of spec.meshes){mesh.updateWorldMatrix(true,false);bounds.expandByObject(mesh)}
    const anchor=new THREE.Vector3((bounds.min.x+bounds.max.x)/2,bounds.min.y,(bounds.min.z+bounds.max.z)/2);
    const collisionBounds=spec.kind==='wall'&&!spec.wallTop?new THREE.Box3().setFromObject(spec.meshes[0]).translate(anchor.clone().negate()):null;
    const root=new THREE.Group();root.name=spec.name;root.position.copy(anchor);root.userData.furnitureId=spec.id;
    const buckets=new Map();
    for(const mesh of spec.meshes){
      const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld).translate(-anchor.x,-anchor.y,-anchor.z);
      const g=geometry.index?geometry.toNonIndexed():geometry;
      if(g!==geometry)geometry.dispose();
      for(const key of Object.keys(g.attributes))if(!['position','normal','uv'].includes(key))g.deleteAttribute(key);
      if(!g.attributes.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
      g.clearGroups();
      if(!buckets.has(mesh.material))buckets.set(mesh.material,[]);
      buckets.get(mesh.material).push(g);mesh.removeFromParent();
    }
    const paint=[];
    let primary=spec.paintMaterials?.length?spec.paintMaterials:[buckets.keys().next().value];
    for(const [source,geometries]of buckets){
      const material=source.clone();
      material.userData={...material.userData,sourceMaterialId:source.uuid,editablePaint:primary.includes(source),baseColor:'#'+source.color.getHexString()};
      if(material.userData.editablePaint)paint.push(material);
      const geometry=mergeGeometries(geometries,false);if(!geometry)throw new Error('无法组合家具：'+spec.name);
      const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.furnitureId=spec.id;root.add(mesh);geometries.forEach(g=>g.dispose());
    }
    for(const attachment of spec.attachments||[]){
      attachment.updateWorldMatrix(true,false);const position=attachment.getWorldPosition(new THREE.Vector3());
      root.add(attachment);attachment.position.copy(position).sub(anchor);attachment.userData.furnitureId=spec.id;
    }
    scene.add(root);
    const surface=anchor.y>3?'floor-2':anchor.y<.7?'outdoor':'floor-1';
    const localBounds=bounds.clone().translate(anchor.clone().negate());
    const record={id:spec.id,sourceId:spec.id,name:spec.name,category:spec.category,catalogId:spec.catalogId||spec.id,catalogName:spec.catalogName||spec.name,root,paint,surface,localBounds,color:null,exists:true,initial:anchor.clone(),initialRotation:0,kind:spec.kind||'furniture',lengthAxis:spec.lengthAxis,wallTop:spec.wallTop,mountWallId:spec.mountWallId,mount:null,wallMaterial:null};
    records.set(record.id,record);
    record.collisionBounds=collisionBounds;
    const templateRoot=root.clone(true);cloneMaterials(templateRoot);
    templates.set(record.id,{...record,root:templateRoot,paint:null});
  }
  let initialState=serialize();
  const catalogGroups=new Map();
  for(const template of templates.values()){
    if(template.kind==='wall')continue;
    if(!catalogGroups.has(template.catalogId)){
      const representative=templates.get(template.catalogId)||template;
      catalogGroups.set(template.catalogId,{...representative,name:representative.catalogName,searchNames:[representative.catalogName]});
    }
    catalogGroups.get(template.catalogId).searchNames.push(template.name);
  }
  const catalog=()=>[...catalogGroups.values()];

  function all(){return [...records.values()].filter(r=>r.exists)}
  function get(id){const r=records.get(id);return r?.exists?r:construction?.getWall(id)||null}
  function serialize(){return {version:1,surfaceGap:SURFACE_GAP,items:all().map(r=>({id:r.id,sourceId:r.sourceId,position:r.root.position.toArray(),rotation:r.root.rotation.y,color:r.color,visible:r.root.visible,surface:r.surface,...(r.kind==='wall'?{lengthScale:r.root.scale[r.lengthAxis],heightScale:r.root.scale.y,wallMaterial:r.wallMaterial}:{}),...(r.mount?{mount:structuredClone(r.mount)}:{})})),...(floorSystem?{floors:floorSystem.serialize()}:{}),...(construction?{building:construction.serialize()}:{})}}
  function createCopy(sourceId,id){
    const template=templates.get(sourceId);if(!template)return null;
    const root=template.root.clone(true);cloneMaterials(root);root.userData.furnitureId=id;
    const paint=[];root.traverse(o=>{if(o.isLight)o.userData.furnitureId=id;if(o.isMesh){o.userData.furnitureId=id;if(o.material.userData.editablePaint)paint.push(o.material)}});
    const record={...template,id,root,paint:[...new Set(paint)],initial:template.initial.clone(),mount:template.mount?structuredClone(template.mount):null,color:null,exists:true};scene.add(root);records.set(id,record);return record;
  }
  function applyColor(record,color){record.color=color;for(const material of record.paint)material.color.set(color||material.userData.baseColor)}
  function colorPreview(id,color){const r=get(id);if(!r||(color!==null&&!/^#[0-9a-f]{6}$/i.test(color)))return;applyColor(r,color);emit('preview')}
  function ensureClearance(){for(const r of all().sort((a,b)=>Number(b.category==='rugs')-Number(a.category==='rugs')))placement?.ensureClearance(r)}
  function floorPreview(id,styleId){if(!floorSystem?.set(id,styleId))return false;const r=construction?.room(id);if(r)r.floorStyle=styleId;ensureClearance();emit('preview');return true}
  function restoreState(state){
    if(state?.version!==1||!Array.isArray(state.items)||state.items.length>150)return false;
    const valid=state.items.filter(v=>v&&typeof v.id==='string'&&/^[a-z0-9-]+$/.test(v.id)&&templates.has(v.sourceId)&&Array.isArray(v.position)&&v.position.length===3&&v.position.every(Number.isFinite)&&Number.isFinite(v.rotation)&&(v.color===null||/^#[0-9a-f]{6}$/i.test(v.color)));
    if(!valid.length)return false;
    for(const record of records.values()){record.exists=false;record.root.visible=false}
    for(const item of valid){
      const r=records.get(item.id)||createCopy(item.sourceId,item.id);if(!r)continue;
      r.exists=true;r.root.visible=item.visible!==false;r.root.position.fromArray(item.position);r.root.rotation.y=item.rotation;r.root.userData.placementInvalid=false;applyColor(r,item.color);
      if(r.kind==='wall'){const size=r.localBounds.getSize(new THREE.Vector3());r.root.scale[r.lengthAxis]=Number.isFinite(item.lengthScale)?THREE.MathUtils.clamp(item.lengthScale,1/size[r.lengthAxis],24/size[r.lengthAxis]):1;r.root.scale.y=Number.isFinite(item.heightScale)?THREE.MathUtils.clamp(item.heightScale,.6/size.y,12/size.y):1;architecture?.setMaterial(r,item.wallMaterial||null)}
      r.mount=item.mount&&typeof item.mount.wallId==='string'&&Array.isArray(item.mount.local)&&item.mount.local.length===3&&item.mount.local.every(Number.isFinite)&&Number.isFinite(item.mount.rotation)?structuredClone(item.mount):null;
      r.surface=['outdoor','foundation','floor-1','floor-2','wall-top','other'].includes(item.surface)?item.surface:(r.root.position.y>3?'floor-2':r.root.position.y<.7?'outdoor':'floor-1');
    }
    construction?.load(state.building);floorSystem?.load(state.floors);scene.updateMatrixWorld(true);architecture?.sync();if(state.surfaceGap!==SURFACE_GAP)ensureClearance();emit('restore');return true;
  }
  // Original objects are always serialized, including stored ones. A missing
  // original in a saved layout therefore belongs to a newly editable catalog.
  function loadSaved(state){
    if(state?.version!==1||!Array.isArray(state.items)||state.items.length>150)return false;
    const ids=new Set(state.items.map(item=>item?.id)),additions=initialState.items.filter(item=>!ids.has(item.id));
    return restoreState({...state,items:[...state.items,...additions]});
  }
  function saveHistory(before){if(JSON.stringify(before)===JSON.stringify(serialize()))return false;undoStack.push(before);if(undoStack.length>40)undoStack.shift();redoStack.length=0;emit('commit');return true}
  function transaction(change){if(gesture)commitGesture();const before=serialize();const result=change();saveHistory(before);return result}
  function constrain(record,x,z){return placement&&!placement.valid(record,x,record.root.position.y,z)?[record.root.position.x,record.root.position.z]:[x,z]}
  function movePreview(id,x,z,y,allowInvalid=false,wallId){
    const r=get(id);if(!r||!Number.isFinite(x)||!Number.isFinite(z))return false;
    if(r.kind==='wall'){const before=r.root.position.clone();r.root.position.set(x,r.initial.y,z);r.root.updateMatrixWorld(true);if(!architecture?.validWall(r)){r.root.position.copy(before);r.root.updateMatrixWorld(true);return false}architecture?.sync();emit('preview');return true}
    if(r.kind==='mounted'){const ok=architecture?.moveMounted(r,new THREE.Vector3(x,Number.isFinite(y)?y:r.root.position.y,z),wallId);emit('preview');return!!ok}
    y=Number.isFinite(y)?y:(placement?placement.heightAt(x,z,Infinity,id):r.root.position.y);
    if(placement)y=placement.restingHeight(r,x,z,y);
    const blockedWall=wallId&&get(wallId)?.kind==='wall'&&!get(wallId).wallTop;
    const valid=!blockedWall&&(!placement||placement.valid(r,x,y,z));r.root.userData.placementInvalid=!valid;
    if(valid||allowInvalid){r.root.position.set(x,y,z);r.root.updateMatrixWorld(true);if(valid){r.surface=placement?.supportAt(x,z,r.root.position.y,id)?.id||r.surface;architecture?.bindSupport(r)}}emit('preview');return valid;
  }
  function rotationPreview(id,degrees){
    const r=get(id);if(!r||!Number.isFinite(degrees))return false;const before=r.root.rotation.y;
    r.root.rotation.y=THREE.MathUtils.degToRad(((degrees%360)+360)%360);
    if(r.kind==='wall'&&architecture&&!architecture.validWall(r)){r.root.rotation.y=before;r.root.updateMatrixWorld(true);return false}
    if(r.kind!=='wall'&&r.kind!=='mounted'&&placement&&!placement.valid(r,...r.root.position.toArray())){r.root.rotation.y=before;emit('preview');return false}
    r.root.updateMatrixWorld(true);if(r.kind==='wall')architecture?.sync();else if(r.mount)architecture?.bind(r,r.mount.wallId,r.mount.type);emit('preview');return true;
  }
  function lengthPreview(id,length){const r=get(id);if(r?.kind!=='wall'||!Number.isFinite(length))return false;const before=r.root.scale.clone();r.root.scale[r.lengthAxis]=THREE.MathUtils.clamp(length,architecture?.minimumLength(id)||1,24)/r.localBounds.getSize(new THREE.Vector3())[r.lengthAxis];r.root.updateMatrixWorld(true);if(architecture&&!architecture.validWall(r)){r.root.scale.copy(before);r.root.updateMatrixWorld(true);return false}architecture?.sync();emit('preview');return true}
  function resizeWallPreview(id,edge,delta,baseline){
    const r=get(id);if(r?.kind!=='wall'||!['top','left','right'].includes(edge)||!Number.isFinite(delta)||!baseline)return false;
    const size=r.localBounds.getSize(new THREE.Vector3()),along=r.lengthAxis;r.root.position.copy(baseline.position);r.root.scale.copy(baseline.scale);
    if(edge==='top')r.root.scale.y=THREE.MathUtils.clamp(size.y*baseline.scale.y+delta,architecture?.minimumHeight(id)||.6,12)/size.y;
    else{const length=THREE.MathUtils.clamp(size[along]*baseline.scale[along]+(edge==='left'?-delta:delta),architecture?.minimumLength(id)||1,24),scale=length/size[along],fixed=r.localBounds[edge==='left'?'max':'min'][along];
      const offset=new THREE.Vector3();offset[along]=fixed*(baseline.scale[along]-scale);r.root.position.add(offset.applyQuaternion(r.root.quaternion));r.root.scale[along]=scale;
    }
    r.root.updateMatrixWorld(true);
    if(edge!=='top'&&architecture&&!architecture.validWall(r)){
      const targetPosition=r.root.position.clone(),targetScale=r.root.scale.clone();let low=0,high=1;
      for(let i=0;i<22;i++){const t=(low+high)/2;r.root.position.lerpVectors(baseline.position,targetPosition,t);r.root.scale.lerpVectors(baseline.scale,targetScale,t);r.root.updateMatrixWorld(true);if(architecture.validWall(r))low=t;else high=t}
      r.root.position.lerpVectors(baseline.position,targetPosition,low);r.root.scale.lerpVectors(baseline.scale,targetScale,low);r.root.updateMatrixWorld(true);
    }
    architecture?.sync();emit('preview');return true;
  }
  function materialPreview(id,style){const r=get(id);if(r?.kind!=='wall'||!architecture?.setMaterial(r,style))return false;emit('preview');return true}
  function beginGesture(){if(gesture)commitGesture();gesture=serialize()}
  function commitGesture(){if(!gesture)return;const before=gesture;gesture=null;saveHistory(before)}
  function cancelGesture(){if(!gesture)return;const before=gesture;gesture=null;restoreState(before);emit('cancel')}
  function setColor(id,color){const r=get(id);if(!r||(color!==null&&!/^#[0-9a-f]{6}$/i.test(color)))return;transaction(()=>applyColor(r,color))}
  function rotate(id,degrees){const r=get(id);if(r)transaction(()=>rotationPreview(id,THREE.MathUtils.radToDeg(r.root.rotation.y)+degrees))}
  function move(id,x,z,y){transaction(()=>movePreview(id,x,z,y))}
  function remove(id){const r=get(id);if(r&&r.kind!=='wall')transaction(()=>{r.root.visible=false;architecture?.sync()})}
  function restore(id){const r=get(id);if(r)transaction(()=>{r.root.visible=true;architecture?.sync()})}
  function newCopy(sourceId){if(all().length>=120)return null;let id;do{id='copy-'+(++serial)}while(records.has(id));return createCopy(sourceId,id)}
  function add(sourceId,near){return transaction(()=>{const r=newCopy(sourceId);if(!r)return null;if(near)movePreview(r.id,near.x,near.z,near.y);else movePreview(r.id,r.initial.x+.40,r.initial.z+.35);return r})}
  function beginPlacement(id,kind){
    beginGesture();const r=kind==='catalog'?newCopy(id):get(id);
    if(!r){cancelGesture();return null}r.root.visible=true;emit('preview');return r;
  }
  function cancelPlacement(id,created){
    cancelGesture();if(created){const r=records.get(id);if(r){r.root.removeFromParent();const materials=new Set();r.root.traverse(o=>{if(o.isMesh)materials.add(o.material)});materials.forEach(m=>m.dispose());records.delete(id)}}
  }
  function resetItem(id){const r=get(id);if(r)transaction(()=>{r.root.position.copy(r.initial);r.root.rotation.y=0;r.root.scale.set(1,1,1);r.surface=templates.get(r.sourceId).surface;r.mount=templates.get(r.sourceId).mount?structuredClone(templates.get(r.sourceId).mount):null;if(r.kind==='wall')architecture?.setMaterial(r,null);applyColor(r,null);r.root.updateMatrixWorld(true);architecture?.sync()})}
  function resetLayout(){transaction(()=>restoreState(initialState))}
  function undo(){if(gesture)cancelGesture();if(!undoStack.length)return;redoStack.push(serialize());restoreState(undoStack.pop());emit('commit')}
  function redo(){if(!redoStack.length)return;undoStack.push(serialize());restoreState(redoStack.pop());emit('commit')}
  return {all,get,templates,catalog,floorSystem,floorPreview,lengthPreview,resizeWallPreview,materialPreview,serialize,load:restoreState,loadSaved,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},setColor,colorPreview,rotate,move,movePreview,rotationPreview,remove,restore,add,resetItem,resetLayout,undo,redo,beginGesture,commitGesture,cancelGesture,constrain,beginPlacement,cancelPlacement,setPlacement:value=>{placement=value;ensureClearance();for(const r of all()){r.initial.copy(r.root.position);const t=templates.get(r.id);if(t){t.root.position.copy(r.root.position);t.mount=r.mount?structuredClone(r.mount):null}}initialState=serialize()},get placement(){return placement},setArchitecture:value=>{architecture=value;initialState=serialize()},get architecture(){return architecture},
    setConstruction:value=>{construction=value;initialState=serialize()},get construction(){return construction},transaction,notify:()=>emit('preview'),
    get canUndo(){return undoStack.length>0},get canRedo(){return redoStack.length>0},get gesturing(){return!!gesture},get historyLength(){return undoStack.length}};
}
