import {limitLayout} from './game-rules.js';
import {createOutdoorStyles,createOutdoorPlot,animateOutdoorPlots} from './outdoor-plots.js';
import * as THREE from './vendor/three.module.js';
import {createRoomFoundation,createFoundationGround,GROUND_TOP,ORIGINAL_FOUNDATION_COLOR} from './foundation-system.js';

export const BUILD_LIMITS=Object.freeze({defaultSize:6,minSize:3,maxSize:20,step:.25,wallThickness:.2,wallHeight:3,minHeight:2.4,maxHeight:6,maxRooms:16});
export const snap=v=>Math.round(v/BUILD_LIMITS.step)*BUILD_LIMITS.step;
const clone=v=>structuredClone(v),boxOf=r=>({minX:r.x-r.width/2,maxX:r.x+r.width/2,minZ:r.z-r.depth/2,maxZ:r.z+r.depth/2});
const inside=(a,b,eps=.001)=>a.minX>=b.minX-eps&&a.maxX<=b.maxX+eps&&a.minZ>=b.minZ-eps&&a.maxZ<=b.maxZ+eps;
const overlap=(a,b)=>Math.min(a.maxX,b.maxX)-Math.max(a.minX,b.minX)>.002&&Math.min(a.maxZ,b.maxZ)-Math.max(a.minZ,b.minZ)>.002;
const colors=['#eee1cb','#a8bca1','#a4bfca','#d3a393','#ceb575','#b2a5c5'];
const foundationColors=[ORIGINAL_FOUNDATION_COLOR,...colors];

export function addWallCrown(parent,width,height,material){
  const root=new THREE.Group();root.name='WhiteWallCrown';parent.add(root);
  const white=material('#fff9ef');
  for(const [h,d,y]of [[.12,.28,height-.18],[.12,.36,height-.06]]){const mesh=new THREE.Mesh(new THREE.BoxGeometry(width+(d===.28?.02:.04),h,d),white);mesh.position.y=y;mesh.castShadow=mesh.receiveShadow=true;root.add(mesh)}
  return root;
}

// Parametric additions are stored alongside the existing furniture snapshot.
// Default and added rooms use the same editable foundation components.
export function createBuildingSystem({scene,parent,system,floorSystem,defaultRooms=[],defaultPavings=[]}){
  const root=new THREE.Group();root.name='NewConstruction';parent.add(root);
  const ground=createFoundationGround({parent,layers:system.architecture.groundLayers});
  let state={version:1,height:3,rooms:[],grounds:[],pavings:[],walls:[],doors:[],decorations:[]},sequence=0,lastError='',view='outside';
  const models=new Map(),wallRecords=new Map(),ownedMaterials=new Set(),dynamicFloors=new Set();
  const legacy={id:'original',x:0,z:0,width:16.3,depth:10.3,level:1,y:1.02};
  const fixedAreas=defaultRooms.length?[]:[legacy];
  const defaults=clone(defaultRooms),outdoorStyles=createOutdoorStyles();
  if(defaults.length)floorSystem.replaceAuthored(Object.fromEntries(defaults.map(r=>[r.legacyFloor,r.id])));
  const room=id=>state.rooms.find(r=>r.id===id),wall=id=>state.walls.find(w=>w.id===id),door=id=>state.doors.find(d=>d.id===id);
  const groundPlot=id=>state.grounds.find(r=>r.id===id);
  const next=kind=>{let id;do{id='build-'+kind+'-'+(++sequence)}while(find(id));return id};
  const paving=id=>state.pavings.find(r=>r.id===id);
  function find(id){return room(id)||groundPlot(id)||paving(id)||wall(id)||door(id)||state.decorations.find(d=>d.id===id)||null}
  const height=r=>['ground','paving'].includes(r.type)?GROUND_TOP+(r.type==='paving'?.01:0):r.elevation??(1.02+(r.level-1)*(state.height+.2));
  const componentWalls=()=>system.all().filter(f=>f.kind==='wall'&&f.root.visible);
  function wallOwners(f,seen=new Set()){
    if(seen.has(f.id))return[];seen.add(f.id);const support=system.architecture.stacking.supportId(f);if(support){const base=system.get(support);return base?.dynamic?base.data.rooms.map(room).filter(Boolean):base?wallOwners(base,seen):[]}
    f.root.updateWorldMatrix(true,true);const b=(f.collisionBounds||f.localBounds).clone().applyMatrix4(f.root.matrixWorld);
    return state.rooms.filter(r=>{const area=boxOf(r);return Math.abs(height(r)-(f.root.position.y-f.initial.y+1.02))<.2&&Math.min(area.maxX,b.max.x)-Math.max(area.minX,b.min.x)>.04&&Math.min(area.maxZ,b.max.z)-Math.max(area.minZ,b.min.z)>.04});
  }
  function roomWalls(id){return componentWalls().filter(f=>wallOwners(f).some(r=>r.id===id))}
  const fail=message=>{lastError=message;return false};
  function material(color,options={}){const m=new THREE.MeshStandardMaterial({color,roughness:.78,...options});ownedMaterials.add(m);return m}
  function box(group,w,h,d,x,y,z,mat,data){if(w<.0001||h<.0001||d<.0001)return null;const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;Object.assign(mesh.userData,data);group.add(mesh);return mesh}
  function tag(group,id,type){group.userData.buildId=id;group.userData.buildType=type;group.traverse(o=>{o.userData.buildId=id;o.userData.buildType=type});models.set(id,group);return group}
  function group(id,type){const g=new THREE.Group();root.add(g);tag(g,id,type);return g}
  function wallBounds(w){const halfX=Math.abs(Math.cos(w.angle))*w.width/2+Math.abs(Math.sin(w.angle))*.1,halfZ=Math.abs(Math.sin(w.angle))*w.width/2+Math.abs(Math.cos(w.angle))*.1;return{minX:w.x-halfX,maxX:w.x+halfX,minZ:w.z-halfZ,maxZ:w.z+halfZ}}
  function wallProxy(w){const root=new THREE.Group();root.position.set(w.x,0,w.z);root.rotation.y=w.angle;return{id:w.id,root,lengthAxis:'x',localBounds:new THREE.Box3(new THREE.Vector3(-w.width/2,0,-.1),new THREE.Vector3(w.width/2,state.height,.1))}}
  function validWall(w,replacement=null){if(w.supportId)return system.architecture.stacking.fits(wallProxy(w),system.get(w.supportId));if(!w.rooms.length)return [w.x,w.z,w.width,w.angle].every(Number.isFinite)&&Math.abs(w.x)<=65&&Math.abs(w.z)<=65;const b=wallBounds(w),owners=w.rooms.map(id=>id===replacement?.id?replacement:room(id)).filter(Boolean);return owners.some(r=>inside(b,boxOf(r)))||corners(b).every(([x,z])=>owners.some(r=>pointInside(x,z,r)))}
  function corners(b){return[[b.minX,b.minZ],[b.maxX,b.minZ],[b.minX,b.maxZ],[b.maxX,b.maxZ]]}
  function pointInside(x,z,r){const b=boxOf(r);return x>=b.minX-.001&&x<=b.maxX+.001&&z>=b.minZ-.001&&z<=b.maxZ+.001}
  function furnitureIn(r){return system.all().filter(f=>{
    if(!f.root.visible||f.kind==='wall'||f.mount)return false;
    const p=f.root.position,owner=state.rooms.filter(v=>height(v)<=p.y+.1&&pointInside(p.x,p.z,v)).sort((a,b)=>height(b)-height(a))[0];
    return owner?.id===r.id;
  })}
  function validateRoom(r,previous=null){
    const balcony=r.level===2;
    if(system.levelRule&&(r.width>system.levelRule.width||r.depth>system.levelRule.depth))return fail('本关地基最大 '+system.levelRule.width+' × '+system.levelRule.depth+' 米');
    if(![r.x,r.z,r.width,r.depth].every(Number.isFinite)||r.width<(balcony?1:3)||r.width>20||r.depth<(balcony?1:3)||r.depth>20)return fail('地基长宽最大为 20 × 20 米');
    if(Math.abs(r.x)>65||Math.abs(r.z)>65)return fail('请在建筑附近添加房间');
    const b=boxOf(r);if(r.level===1&&fixedAreas.some(a=>overlap(b,boxOf(a))))return fail('地基不能与现有建筑重叠');
    if(state.rooms.some(other=>other.id!==r.id&&other.level===r.level&&overlap(b,boxOf(other))))return fail('同层房间不能重叠');

    if(previous){
      const dx=r.x-previous.x,dz=r.z-previous.z,resizing=r.width!==previous.width||r.depth!==previous.depth;
      if(!resizing&&(dx||dz)&&state.walls.some(w=>w.rooms.includes(r.id)&&w.rooms.length>1))return fail('房间有共墙，请先调整共墙');
      if(!resizing&&(dx||dz)&&roomWalls(r.id).some(f=>wallOwners(f).length>1))return fail('矮墙横跨两块地基，请先缩短或移开矮墙');
      for(const w of state.walls.filter(w=>w.rooms.includes(r.id))){const moved=resizing?w:{...w,x:w.x+dx,z:w.z+dz};if(!w.supportId&&!validWall(moved,r))return fail('地基边缘已碰到墙壁');}
      if(resizing&&roomWalls(previous.id).some(f=>!system.architecture.validWall(f,r)))return fail('地基边缘已碰到组件墙壁');
      if(resizing)for(const f of furnitureIn(previous)){const fb=new THREE.Box3().setFromObject(f.root);if(!inside({minX:fb.min.x,maxX:fb.max.x,minZ:fb.min.z,maxZ:fb.max.z},b))return fail('先移动边缘的家具，再缩小地基')}

    }return true;
  }
  function supported(r,replacement=null){
    // Exact coverage by a union of axis-aligned foundations, not just four corners.
    const b=boxOf(r),bases=[...fixedAreas,...state.rooms.filter(v=>v.level===1).map(v=>replacement?.id===v.id?replacement:v)].map(boxOf);
    const xs=[b.minX,b.maxX,...bases.flatMap(v=>[v.minX,v.maxX]).filter(x=>x>b.minX&&x<b.maxX)].sort((a,b)=>a-b);
    const zs=[b.minZ,b.maxZ,...bases.flatMap(v=>[v.minZ,v.maxZ]).filter(z=>z>b.minZ&&z<b.maxZ)].sort((a,b)=>a-b);
    for(let i=1;i<xs.length;i++)for(let j=1;j<zs.length;j++){const x=(xs[i-1]+xs[i])/2,z=(zs[j-1]+zs[j])/2;if(!bases.some(v=>x>=v.minX&&x<=v.maxX&&z>=v.minZ&&z<=v.maxZ))return false}return true;
  }
  function snapRoom(r){const candidate={...r,x:snap(r.x),z:snap(r.z)};for(const other of [...fixedAreas,...state.rooms]){if(other.id===r.id||other.level!==r.level)continue;for(const axis of ['x','z']){const dim=axis==='x'?'width':'depth',cross=axis==='x'?'z':'x',crossSize=axis==='x'?'depth':'width';if(Math.abs(candidate[cross]-other[cross])>(r[crossSize]+other[crossSize])/2+.3)continue;for(const side of [-1,1]){const target=other[axis]+side*(other[dim]+r[dim])/2;if(Math.abs(candidate[axis]-target)<.3)candidate[axis]=target}}}return candidate}
  function addRoom(point,level=1,dimensions={}){if(system.canAdd&&!system.canAdd())return fail('场景最多摆放 200 件物件，请先删除一些物件');
    if(state.rooms.length>=BUILD_LIMITS.maxRooms)return fail('最多可建造 16 个房间');
    const r=snapRoom({id:next('room'),type:'room',x:point.x,z:point.z,width:dimensions.width??6,depth:dimensions.depth??6,...(dimensions.elevation!==undefined?{elevation:dimensions.elevation}:{}),level:level===2?2:1,color:'#eee1cb',floorStyle:'wood-planks',floorRotation:0,roof:null});
    if(!validateRoom(r))return false;state.rooms.push(r);redraw();return r.id;
  }
  function upperDraft(point){
    const base=state.rooms.find(r=>r.level===1&&pointInside(point.x,point.z,r));
    const adjacent=base&&state.rooms.find(r=>r.level===2&&overlap(boxOf(r),boxOf(base)));
    return snapRoom({id:'preview',x:point.x,z:point.z,width:Math.min(6,base?.width||6),depth:Math.min(2,base?.depth||2),level:2,...(adjacent?.elevation!==undefined?{elevation:adjacent.elevation}:{})});
  }
  function addUpper(point){const draft=upperDraft(point);return addRoom(draft,2,draft)}
  function validGround(r){return [r.x,r.z,r.width,r.depth].every(Number.isFinite)&&Math.abs(r.x)<=65&&Math.abs(r.z)<=65&&r.width>=3&&r.width<=24&&r.depth>=3&&r.depth<=24||fail('地面长宽需要在 3–24 米之间，并放在建筑附近')}
  function addGround(point){if(system.canAdd&&!system.canAdd())return fail('场景最多摆放 200 件物件，请先删除一些物件');
    if(state.grounds.length>=32)return fail('最多可添加 32 块地面');
    const r={id:next('ground'),type:'ground',x:snap(point.x),z:snap(point.z),width:6,depth:6};
    if(!validGround(r))return false;state.grounds.push(r);redraw();return r.id;
  }

  function validPaving(r){
    if(![r.x,r.z,r.width,r.depth].every(Number.isFinite)||Math.abs(r.x)>65||Math.abs(r.z)>65||r.width<1||r.depth<1||r.width>20||r.depth>20)return fail('铺装长宽需要在 1–20 米之间');
    if(state.rooms.some(room=>room.level===1&&overlap(boxOf(r),boxOf(room))))return fail('请把室外铺装放在房间地基外');
    if(state.pavings.some(other=>other.id!==r.id&&overlap(boxOf(r),boxOf(other))))return fail('铺装区域不能相互重叠');

    return true;
  }
  function addPaving(point,family='tiles'){if(system.canAdd&&!system.canAdd())return fail('场景最多摆放 200 件物件，请先删除一些物件');
    if(state.pavings.length>=64)return fail('最多可摆放 64 块铺装');
    const r={id:next('paving'),type:'paving',x:snap(point.x),z:snap(point.z),width:4,depth:3,family,style:family==='garden'?'grass':'stone'};
    if(!validPaving(r))return false;state.pavings.push(r);redraw();return r.id;
  }
  function updatePaving(id,patch){const r=paving(id);if(!r)return false;const next={...r,...patch};if(!validPaving(next))return false;Object.assign(r,next);redraw();return true}
  function rotatePaving(id){const r=paving(id);return r?updatePaving(id,{width:r.depth,depth:r.width}):false}
  function updateGround(id,patch){const r=groundPlot(id);if(!r)return false;const next={...r,...patch};if(!validGround(next))return false;Object.assign(r,next);redraw();return true}
  function rotateGround(id){const r=groundPlot(id);return r?updateGround(id,{width:r.depth,depth:r.width}):false}
  function groundAt(x,z,preferred){const r=groundPlot(preferred);return r&&pointInside(x,z,r)?r:[...state.grounds].reverse().find(r=>pointInside(x,z,r))}
  function updateRoom(id,patch){const previous=room(id);if(!previous)return false;const r={...previous,...patch};if(!validateRoom(r,previous))return false;
    const dx=r.x-previous.x,dz=r.z-previous.z,resizing=r.width!==previous.width||r.depth!==previous.depth;
    if(!resizing&&(dx||dz)){for(const w of state.walls.filter(w=>w.rooms.includes(id))){w.x+=dx;w.z+=dz}for(const f of [...roomWalls(id),...furnitureIn(previous)]){f.root.position.x+=dx;f.root.position.z+=dz;f.root.updateMatrixWorld(true)}}
    Object.assign(previous,r);redraw();return true;
  }
  function rotateRoom(id){const r=room(id);if(!r)return false;if(state.walls.some(w=>w.rooms.includes(id)&&w.rooms.length>1))return fail('共墙房间不能单独旋转');
    if(roomWalls(id).some(f=>wallOwners(f).length>1))return fail('矮墙横跨两块地基，请先缩短或移开矮墙');
    const before=clone(state),furniture=[...roomWalls(id),...furnitureIn(r)].map(f=>({f,position:f.root.position.clone(),angle:f.root.rotation.y}));
    for(const w of state.walls.filter(w=>w.rooms.includes(id))){const x=w.x-r.x,z=w.z-r.z;w.x=r.x+z;w.z=r.z-x;w.angle+=Math.PI/2}
    [r.width,r.depth]=[r.depth,r.width];
    if(!validateRoom(r)||state.walls.some(w=>w.rooms.includes(id)&&!validWall(w))){state=before;return fail('旋转后的房间没有足够空间')}
    for(const {f,position,angle}of furniture){const x=position.x-r.x,z=position.z-r.z;f.root.position.set(r.x+z,position.y,r.z-x);f.root.rotation.y=angle+Math.PI/2;f.root.updateMatrixWorld(true)}
    for(const d of state.decorations.filter(d=>d.roomId===id)){[d.u,d.v]=[d.v,-d.u]}redraw();return true;
  }
  function addWall(roomId,edge){if(system.canAdd&&!system.canAdd())return fail('场景最多摆放 200 件物件，请先删除一些物件');const r=room(roomId);if(!r)return fail('先添加一块房间地基');const side=edge==='left'||edge==='right',sign=edge==='left'||edge==='back'?-1:1;
    const w={id:next('wall'),type:'wall',rooms:[roomId],x:r.x+(side?sign*(r.width/2-.1):0),z:r.z+(!side?sign*(r.depth/2-.1):0),angle:side?Math.PI/2:0,width:(side?r.depth:r.width),color:'#eee1cb',style:'plaster'};
    const same=state.walls.find(a=>Math.abs(a.angle-w.angle)<.01&&Math.abs(a.x-w.x)<.21&&Math.abs(a.z-w.z)<.21&&Math.abs(a.width-w.width)<.21&&room(a.rooms[0])?.level===r.level);
    if(same){if(!same.rooms.includes(roomId)){same.rooms.push(roomId);same.x=(same.x+w.x)/2;same.z=(same.z+w.z)/2}redraw();return same.id}
    if(!validWall(w))return fail('墙壁不能超出地基');state.walls.push(w);redraw();return w.id;
  }
  function snapWall(w){
    const r=state.rooms.filter(r=>pointInside(w.x,w.z,r)).sort((a,b)=>height(b)-height(a))[0];
    if(!r){w.rooms=[];w.elevation=GROUND_TOP+.01;return w}
    const dx=w.x-r.x,dz=w.z-r.z,side=r.width/2-Math.abs(dx)<r.depth/2-Math.abs(dz),sign=(side?dx:dz)<0?-1:1;
    w.width=Math.min(w.width,side?r.depth:r.width);w.angle=side?Math.PI/2:0;w.rooms=[r.id];delete w.elevation;
    if(side){w.x=r.x+sign*(r.width/2-.1);w.z=THREE.MathUtils.clamp(w.z,r.z-r.depth/2+w.width/2,r.z+r.depth/2-w.width/2)}else{w.z=r.z+sign*(r.depth/2-.1);w.x=THREE.MathUtils.clamp(w.x,r.x-r.width/2+w.width/2,r.x+r.width/2-w.width/2)}return w;
  }
  function addFreeWall(point){if(system.canAdd&&!system.canAdd())return fail('场景最多摆放 200 件物件');const w=snapWall({id:next('wall'),type:'wall',rooms:[],x:point.x,z:point.z,width:3,angle:0,color:'#eee1cb',style:'plaster'});if(!validWall(w))return false;state.walls.push(w);redraw();return w.id}
  function updateWall(id,patch){const w=wall(id);if(!w)return false;const candidate={...w,...patch};if(!w.supportId&&patch.width===undefined&&patch.angle===undefined&&(patch.x!==undefined||patch.z!==undefined))snapWall(candidate);if(candidate.width<1||candidate.width>24||!validWall(candidate))return fail('墙壁已到地基边缘');
    if(candidate.width<system.architecture.minimumLength(id))return fail('先调整墙上的装饰，再缩短墙壁');
    if(state.doors.some(d=>d.wallId===id&&(Math.abs(d.offset)+d.width/2+.1>candidate.width/2)))return fail('先移动门洞，再缩短墙壁');
    Object.assign(w,candidate);if(w.supportId){const proxy=wallProxy(w);proxy.dynamic=true;proxy.data=w;system.architecture.stacking.bind(proxy,system.get(w.supportId))}redraw();return true;
  }
  function addStackedWall(baseId){if(system.canAdd&&!system.canAdd())return fail('场景最多摆放 200 件物件，请先删除一些物件');
    const base=system.get(baseId);if(base?.kind!=='wall'||!base.root.visible)return fail('请选择墙顶');
    const owners=base.dynamic?base.data.rooms:wallOwners(base).map(r=>r.id);
    const w={id:next('wall'),type:'wall',rooms:[...owners],x:base.root.position.x,z:base.root.position.z,angle:0,width:Math.min(3,base.localBounds.getSize(new THREE.Vector3())[base.lengthAxis]*base.root.scale[base.lengthAxis]),color:'#eee1cb',style:'plaster'};
    const proxy=wallProxy(w);proxy.dynamic=true;proxy.data=w;
    if(!system.architecture.stacking.pose(proxy,base,base.root.position.clone()))return fail('墙顶没有足够空间');
    Object.assign(w,{x:proxy.root.position.x,z:proxy.root.position.z,angle:proxy.root.rotation.y});system.architecture.stacking.bind(proxy,base);state.walls.push(w);redraw();return w.id;
  }
  function removeStackedOn(id){
    const children=system.architecture.stacking.descendants(id).reverse();
    for(const child of children){for(const f of system.all())if(f.mount?.wallId===child.id)f.root.visible=false;if(child.dynamic)remove(child.id);else child.root.visible=false}
  }
  function setHeight(value){value=THREE.MathUtils.clamp(snap(value),2.4,6);if(state.doors.some(d=>d.height+.15>value)||state.walls.some(w=>system.architecture.minimumHeight(w.id)>value))return fail('墙高不能小于门洞或墙饰高度');const delta=value-state.height;for(const r of state.rooms.filter(r=>r.level===2&&r.elevation===undefined))for(const f of [...roomWalls(r.id),...furnitureIn(r)])f.root.position.y+=delta;state.height=value;redraw();return true}
  function validDoor(d){const w=wall(d.wallId);return w&&[d.width,d.height,d.offset].every(Number.isFinite)&&d.width>=.75&&d.width<=3&&d.height>=1.8&&d.height<=state.height-.15&&Math.abs(d.offset)+d.width/2+.1<=w.width/2&&!state.doors.some(v=>v.id!==d.id&&v.wallId===d.wallId&&Math.abs(v.offset-d.offset)<(v.width+d.width)/2+.15)}
  function addDoor(wallId,offset=0){if(system.canAdd&&!system.canAdd())return fail('场景最多摆放 200 件物件，请先删除一些物件');const d={id:next('door'),type:'door',wallId,offset:snap(offset),width:.9,height:2.1,color:'#96734e',open:true};if(!validDoor(d))return fail('门洞需要留在墙内，并与其它门洞错开');state.doors.push(d);redraw();return d.id}
  function updateDoor(id,patch){const d=door(id);if(!d)return false;const candidate={...d,...patch};if(!validDoor(candidate))return fail('门洞尺寸或位置超出可用墙面');Object.assign(d,candidate);redraw();return true}
  function setRoof(id,style){const r=room(id);if(r&&!r.roof&&system.canAdd&&!system.canAdd())return fail('场景最多摆放 200 件物件');if(!r)return fail('先选择房间地基');if(state.rooms.some(v=>v.level>r.level&&overlap(boxOf(v),boxOf(r))))return fail('这块房间上方已有二楼，请选择顶层房间');r.roof={style,rise:r.roof?.rise||1.25,color:r.roof?.color||'#58746d'};redraw();return true}
  function roofY(r,x,z){return height(r)+state.height+.12+(r.roof?.style==='gable'?r.roof.rise*Math.max(0,1-Math.abs(z-r.z)/(r.depth/2+.25)):0)}
  function addDecoration(id,x=0,z=0){if(system.canAdd&&!system.canAdd())return fail('场景最多摆放 200 件物件，请先删除一些物件');const r=room(id);if(!r?.roof)return fail('先为房间添加屋顶');const d={id:next('chimney'),type:'chimney',roomId:id,u:THREE.MathUtils.clamp(x,-.8,.8),v:THREE.MathUtils.clamp(z,-.8,.8),color:'#be9680'};state.decorations.push(d);redraw();return d.id}
  function removalContents(id){
    const selected=room(id);if(!selected)return null;
    const rooms=[selected];
    // Removing a supporting foundation also removes the rooms directly above it.
    for(const lower of rooms)for(const upper of state.rooms)if(upper.level>lower.level&&overlap(boxOf(upper),boxOf(lower))&&!rooms.includes(upper))rooms.push(upper);
    const roomIds=new Set(rooms.map(r=>r.id));
    const walls=state.walls.filter(w=>w.rooms.length&&w.rooms.every(id=>roomIds.has(id)));
    const wallIds=new Set(walls.map(w=>w.id));
    const furniture=system.all().filter(f=>{
      if(!f.root.visible)return false;
      if(f.kind==='wall')return wallOwners(f).some(r=>roomIds.has(r.id));
      const attachedComponent=system.get(f.mount?.wallId);if(attachedComponent?.kind==='wall'&&!attachedComponent.dynamic&&wallOwners(attachedComponent).some(r=>roomIds.has(r.id)))return true;
      if(wallIds.has(f.mount?.wallId))return true;
      // Resolve stacked surfaces to their highest supporting room, rather than
      // deleting downstairs furniture when removing only an upstairs floor.
      const p=f.root.position,owner=[...fixedAreas,...state.rooms].filter(r=>height(r)<=p.y+.1&&pointInside(p.x,p.z,r)).sort((a,b)=>b.level-a.level)[0];
      if(owner&&!roomIds.has(owner.id))return false;
      if(!owner){
        f.root.updateWorldMatrix(true,true);const b=new THREE.Box3().setFromObject(f.root),footprint={minX:b.min.x,maxX:b.max.x,minZ:b.min.z,maxZ:b.max.z};
        if(!rooms.some(r=>height(r)<=p.y+.1&&overlap(footprint,boxOf(r))))return false;
      }
      const mountedWall=wall(f.mount?.wallId);
      return !mountedWall||mountedWall.rooms.some(id=>roomIds.has(id));
    });
    const doors=state.doors.filter(d=>wallIds.has(d.wallId)),decorations=state.decorations.filter(d=>roomIds.has(d.roomId)),roofs=rooms.filter(r=>r.roof);
    const attachedWalls=state.walls.filter(w=>w.rooms.some(id=>roomIds.has(id)));
    return{roomIds:[...roomIds],furnitureIds:furniture.map(f=>f.id),wallIds:[...wallIds],count:rooms.length-1+furniture.length+attachedWalls.length+doors.length+decorations.length+roofs.length};
  }
  function removeFoundation(id){
    const contents=removalContents(id);if(!contents)return false;
    for(const itemId of contents.furnitureIds){const f=system.get(itemId);if(f)f.root.visible=false}
    // Upper floors go first so the ordinary support checks remain valid.
    for(const roomId of contents.roomIds.sort((a,b)=>room(b).level-room(a).level))if(!remove(roomId))return false;
    return true;
  }
  function remove(id){
    if(!id)return false;
    const r=room(id);
    if(r){
      if(r.level===1&&state.rooms.some(v=>v.level===2&&overlap(boxOf(v),boxOf(r))))return fail('请先移除上方二楼');
      for(const f of furnitureIn(r))f.root.visible=false;
      const removed=state.walls.filter(w=>w.rooms.length===1&&w.rooms.includes(id)).map(w=>w.id);
      for(const f of system.all())if(removed.includes(f.mount?.wallId))f.root.visible=false;
      state.walls=state.walls.filter(w=>!removed.includes(w.id));
      for(const w of state.walls){const wasShared=w.rooms.includes(id);w.rooms=w.rooms.filter(v=>v!==id);if(wasShared&&w.rooms.length===1){const owner=room(w.rooms[0]),b=boxOf(owner),wb=wallBounds(w);w.x+=Math.max(0,b.minX-wb.minX)-Math.max(0,wb.maxX-b.maxX);w.z+=Math.max(0,b.minZ-wb.minZ)-Math.max(0,wb.maxZ-b.maxZ)}}
      state.doors=state.doors.filter(d=>!removed.includes(d.wallId));state.decorations=state.decorations.filter(d=>d.roomId!==id);state.rooms=state.rooms.filter(v=>v.id!==id);
    }else if(paving(id))state.pavings=state.pavings.filter(r=>r.id!==id);
    else if(groundPlot(id))state.grounds=state.grounds.filter(r=>r.id!==id);
    else if(wall(id)){removeStackedOn(id);for(const f of system.all())if(f.mount?.wallId===id)f.root.visible=false;state.walls=state.walls.filter(w=>w.id!==id);state.doors=state.doors.filter(d=>d.wallId!==id)}
    else if(id.endsWith('-roof')){const r=room(id.slice(0,-5));if(r)r.roof=null;state.decorations=state.decorations.filter(d=>d.roomId!==r?.id)}
    else{state.doors=state.doors.filter(d=>d.id!==id);state.decorations=state.decorations.filter(d=>d.id!==id)}
    redraw();return true;
  }
  function color(id,value){const item=find(id)||room(id.replace(/-roof$/,''))?.roof;if(!item||!(room(id)?foundationColors:colors).includes(value))return false;item.color=value;redraw();return true}
  function setStyle(id,style){const plot=paving(id);if(plot&&outdoorStyles.some(s=>s.id===style&&s.family===plot.family)){plot.style=style;redraw();return true}const r=room(id),w=wall(id);if(r&&floorSystem.styles.some(s=>s.id===style)){r.floorStyle=style;redraw();return true}if(w&&system.architecture.styles.some(s=>s.id===style)){w.style=style;redraw();return true}return false}
  function rotateFloor(id){const r=room(id);if(!r)return false;r.floorRotation=((r.floorRotation||0)+90)%360;floorSystem.setRotation(id,r.floorRotation);system.notify();return true}
  function clear(){for(const id of dynamicFloors)if(!room(id))floorSystem.removeRoom(id);dynamicFloors.clear();root.traverse(o=>{if(o.isMesh){o.geometry.dispose();if(o.isInstancedMesh)o.dispose()}});root.clear();models.clear();wallRecords.clear();for(const m of ownedMaterials){if(m.userData.ownedTexture)m.map?.dispose();m.dispose()}ownedMaterials.clear()}
  function redraw(){
    clear();
    ground.update(state.rooms,state.grounds,!state.customGround);
    // Ground is rendered only by the union mesh. These anchors identify each
    // editable plot without introducing overlapping transparent picking slabs.
    for(const r of state.grounds){const g=group(r.id,'ground');g.position.set(r.x,GROUND_TOP,r.z)}
    for(const r of state.pavings){const g=createOutdoorPlot({width:r.width,depth:r.depth,style:outdoorStyles.find(s=>s.id===r.style),material});root.add(g);g.position.set(r.x,height(r),r.z);tag(g,r.id,'paving')}
    for(const r of state.rooms){
      const foundation=createRoomFoundation({width:r.width,depth:r.depth,level:r.level,color:r.color,material}),g=foundation.root;root.add(g);g.position.set(r.x,height(r),r.z);tag(g,r.id,'room');
      floorSystem.addRoom(r.id,foundation.floorRoot,foundation.base,foundation.width,foundation.depth,r.level);floorSystem.set(r.id,r.floorStyle);floorSystem.setRotation(r.id,r.floorRotation||0);dynamicFloors.add(r.id);
      if(r.roof){const roof=group(r.id+'-roof','roof');roof.position.set(r.x,height(r)+state.height,r.z);const m=material(r.roof.color),w=r.width+.5,d=r.depth+.5;
        if(r.roof.style==='flat')box(roof,w,.18,d,0,.1,0,m);
        else{const rise=r.roof.rise,slope=Math.atan2(rise,d/2),length=Math.hypot(d/2,rise);for(const sign of [-1,1]){const plane=box(roof,w,.16,length,0,rise/2+.12,sign*d/4,m);plane.rotation.x=sign*slope}box(roof,w+.03,.12,.18,0,rise+.18,0,material('#d7dcc9'));}
        tag(roof,r.id+'-roof','roof');
      }
    }
    for(const w of state.walls){
      const r=room(w.rooms[0]);const g=group(w.id,'wall');g.position.set(w.x,w.elevation??(r?height(r):GROUND_TOP+.01),w.z);g.rotation.y=w.angle;
      const m=material(w.color),bodyHeight=state.height-.12,ds=state.doors.filter(d=>d.wallId===w.id).sort((a,b)=>a.offset-b.offset);let start=-w.width/2;
      for(const d of ds){const left=d.offset-d.width/2,right=d.offset+d.width/2;box(g,left-start,bodyHeight,.2,(start+left)/2,bodyHeight/2,0,m);box(g,d.width,bodyHeight-d.height,.2,d.offset,(bodyHeight+d.height)/2,0,m);start=right}
      box(g,w.width/2-start,bodyHeight,.2,(start+w.width/2)/2,bodyHeight/2,0,m);
      const segments=[[-w.width/2,...ds.flatMap(d=>[d.offset-d.width/2,d.offset+d.width/2]),w.width/2]];
      for(let i=0;i<segments[0].length;i+=2){const a=segments[0][i],b=segments[0][i+1];box(g,b-a,.12,.23,(a+b)/2,.06,0,material('#d8c4a5'))}
      addWallCrown(g,w.width,state.height,material);tag(g,w.id,'wall');g.traverse(o=>o.userData.furnitureId=w.id);
      const localBounds=new THREE.Box3(new THREE.Vector3(-w.width/2,0,-.1),new THREE.Vector3(w.width/2,state.height,.1));
      const rec={id:w.id,sourceId:w.id,name:'墙壁',kind:'wall',lengthAxis:'x',wallTop:false,root:g,paint:[m],localBounds,collisionBounds:localBounds,initial:g.position.clone(),dynamic:true,data:w};wallRecords.set(w.id,rec);system.architecture.setMaterial(rec,w.style);
    }
    for(const d of state.doors){const w=wall(d.wallId);if(!w)continue;const wallModel=models.get(w.id),g=group(d.id,'door');wallModel.add(g);g.position.set(d.offset,0,0);const trim=material('#e6d5b9'),wood=material(d.color);
      for(const sign of [-1,1])box(g,.10,d.height+.06,.27,sign*(d.width/2+.025),d.height/2,0,trim);box(g,d.width+.16,.12,.27,0,d.height+.01,0,trim);
      const hinge=new THREE.Group();hinge.position.x=-d.width/2;hinge.rotation.y=d.open?-Math.PI*.48:0;g.add(hinge);box(hinge,d.width-.05,d.height-.05,.065,(d.width-.05)/2,d.height/2,0,wood);box(hinge,.07,.07,.14,d.width-.16,d.height*.47,.055,material('#c5a766',{metalness:.5}));tag(g,d.id,'door');
    }
    for(const d of state.decorations){const r=room(d.roomId);if(!r?.roof)continue;const g=group(d.id,'chimney'),x=r.x+d.u*r.width/2,z=r.z+d.v*r.depth/2;g.position.set(x,roofY(r,x,z)-.20,z);box(g,.55,1.15,.55,0,.55,0,material(d.color));box(g,.7,.13,.7,0,1.15,0,material('#e1d4bd'));box(g,.38,.015,.38,0,1.224,0,material('#435048'));tag(g,d.id,'chimney')}
    root.updateMatrixWorld(true);system.architecture.sync();applyView();system.notify();
  }
  function serialize(){return clone({...state,pavingDefaults:1,...(defaults.length?{componentDefaults:1}:{}),rooms:state.rooms.map(r=>({...r,floorStyle:floorSystem.get(r.id)?.styleId||r.floorStyle}))})}
  function load(saved){
    const empty={version:1,height:3,rooms:[],grounds:[],pavings:[],walls:[],doors:[],decorations:[]};
    if(!saved||saved.version!==1||!Array.isArray(saved.rooms)||saved.rooms.length>16)saved={...empty,rooms:clone(defaults),componentDefaults:1};
    else if(defaults.length&&!saved.componentDefaults)saved={...saved,rooms:[...clone(defaults),...saved.rooms.filter(r=>!defaults.some(d=>d.id===r.id))]};
    state=empty;state.customGround=!!saved.customGround;state.height=THREE.MathUtils.clamp(Number(saved.height)||3,2.4,6);
    const ids=new Set();const safe=v=>v&&/^build-[a-z]+-\d+$/.test(v.id)&&!ids.has(v.id)&&ids.add(v.id);
    for(const item of (Array.isArray(saved.grounds)?saved.grounds:[]).slice(0,32))if(safe(item)&&item.type==='ground'&&validGround(item))state.grounds.push({id:item.id,type:'ground',x:item.x,z:item.z,width:item.width,depth:item.depth});
    for(const item of [...saved.rooms].sort((a,b)=>a.level-b.level)){if(!safe(item))continue;const r=clone(item);r.width=Math.min(r.width,20);r.depth=Math.min(r.depth,20);if(r.elevation!==undefined&&(!Number.isFinite(r.elevation)||r.elevation<.14||r.elevation>12))delete r.elevation;r.floorRotation=((Math.round((Number(r.floorRotation)||0)/90)*90)%360+360)%360;if(![1,2].includes(r.level)||!validateRoom(r))continue;if(r.roof&&!['flat','gable'].includes(r.roof.style))r.roof=null;if(r.roof)r.roof.rise=THREE.MathUtils.clamp(Number(r.roof.rise)||1.25,.25,4);state.rooms.push(r)}
    const order=new Map(saved.rooms.map((r,i)=>[r.id,i]));state.rooms.sort((a,b)=>order.get(a.id)-order.get(b.id));
    for(const item of (saved.walls||[]).slice(0,100)){if(safe(item)&&[item.x,item.z,item.width,item.angle].every(Number.isFinite)&&Array.isArray(item.rooms)&&item.rooms.every(room)&&item.width>=1&&item.width<=24&&(item.supportId?typeof item.supportId==='string'&&Array.isArray(item.supportLocal)&&item.supportLocal.length===3&&item.supportLocal.every(Number.isFinite)&&Number.isFinite(item.supportRotation):validWall(item)))state.walls.push(clone(item))}
    for(const item of (saved.doors||[]).slice(0,80))if(safe(item)&&validDoor(item))state.doors.push(clone(item));
    for(const item of (saved.decorations||[]).slice(0,40))if(safe(item)&&room(item.roomId)?.roof&&[item.u,item.v].every(Number.isFinite))state.decorations.push({...clone(item),u:THREE.MathUtils.clamp(item.u,-.8,.8),v:THREE.MathUtils.clamp(item.v,-.8,.8)});
    // Legacy saves receive the replacement paving once; an empty saved list stays empty.
    for(const item of (saved.pavingDefaults?(Array.isArray(saved.pavings)?saved.pavings:[]):defaultPavings).slice(0,64)){
      if(!safe(item)||!outdoorStyles.some(s=>s.id===item.style&&s.family===item.family)||![item.x,item.z,item.width,item.depth].every(Number.isFinite)||item.width<1||item.depth<1||item.width>20||item.depth>20||Math.abs(item.x)>65||Math.abs(item.z)>65)continue;
      state.pavings.push({...clone(item),type:'paving'});
    }
    state=limitLayout({items:[],building:state}).building;state.doors=state.doors.filter(d=>state.walls.some(w=>w.id===d.wallId));
    redraw();
  }
  function applyView(camera,selectedId){const level=view==='1'?1:view==='2'?2:Infinity,insideView=Number.isFinite(level);
    for(const [id,g]of models){const item=find(id),r=room(id)||room(item?.rooms?.[0])||room(wall(item?.wallId)?.rooms[0])||room(item?.roomId)||room(id.replace(/-roof$/,''));if(!r)continue;
      let show=r.level<=level;if(g.userData.buildType==='roof'||item?.type==='chimney')show=!insideView;
      if(item?.type==='wall'&&insideView&&camera&&r.level===level&&id!==selectedId){const normal=new THREE.Vector3(Math.sin(item.angle),0,Math.cos(item.angle));const facing=camera.position.clone().sub(g.position).dot(normal);const sign=(Math.abs(Math.sin(item.angle))>.5?item.x-r.x:item.z-r.z);if(facing*sign>0)show=false}
      if(item?.type==='door'&&insideView){const wm=models.get(item.wallId);show=show&&!!(wm?.layers.mask&1)}
      g.traverse(o=>show?o.layers.enable(0):o.layers.disable(0));
    }
    for(const floor of floorSystem.all().filter(f=>!f.dynamic))floor.root.traverse(o=>floor.level<=level?o.layers.enable(0):o.layers.disable(0));
    for(const f of system.all()){
      let show=level!==1||f.kind==='wall'||f.root.position.y<3.6;
      if(f.mount&&models.has(f.mount.wallId))show=show&&!!(models.get(f.mount.wallId).layers.mask&1);
      f.root.traverse(o=>show?o.layers.enable(0):o.layers.disable(0));
    }
  }
  function setView(value){view=['outside','1','2','roof'].includes(String(value))?String(value):'outside';applyView()}
  function editable(record){if(!['1','2'].includes(view)||record.kind==='wall')return true;const level=record.level||(record.root.position.y>=3.6?2:1);return level===Number(view)}
  const getModel=id=>models.get(id)||null;
  function collisionBoxes(){const out=[];for(const w of wallRecords.values()){w.root.updateWorldMatrix(true,true);w.root.traverse(o=>{if(o.isMesh)out.push(new THREE.Box3().setFromObject(o))})}return out}
  const api={paving,outdoorStyles,addPaving,updatePaving,rotatePaving,validPaving,animate:t=>animateOutdoorPlots(root,t),componentDefaults:!!defaults.length,root,ground,groundPlot,groundAt,addGround,updateGround,rotateGround,validGround,limits:BUILD_LIMITS,colors,foundationColors,all:()=>state.rooms,find,room,wall,door,getModel,getWall:id=>wallRecords.get(id)||null,wallRecords:()=>[...wallRecords.values()],height,roofY,boxOf,pointInside,snapRoom,canPlaceRoom:validateRoom,addRoom,addUpper,upperDraft,updateRoom,rotateRoom,addWall,addFreeWall,addStackedWall,removeStackedOn,updateWall,setHeight,addDoor,updateDoor,setRoof,addDecoration,remove,removalContents,removeFoundation,color,setStyle,rotateFloor,redraw,serialize,load,validWall,collisionBoxes,setView,applyView,editable,get view(){return view},get lastError(){return lastError},get state(){return state}};
  if(defaults.length)load(null);
  return api;
}
