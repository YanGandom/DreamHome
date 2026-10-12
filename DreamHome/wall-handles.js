import * as THREE from './vendor/three.module.js';

const stripStyles=new WeakMap();
export function setResizeStripActive(bar,active){
  if(!stripStyles.has(bar))stripStyles.set(bar,{color:bar.material.color.clone(),opacity:bar.material.opacity});
  const initial=stripStyles.get(bar);bar.userData.resizeActive=!!active;
  bar.material.color.copy(active?new THREE.Color('#dcff92'):initial.color);bar.material.opacity=active?1:initial.opacity;
}

// Scene-space strips sit just outside the selected wall's three editable edges.
// They are not children of the wall, so their thickness does not stretch with it.
export function createWallHandles(scene,camera,canvas){
  const root=new THREE.Group();root.name='WallResizeHandles';root.visible=false;root.userData.editorHelper=true;scene.add(root);
  const geometry=new THREE.BoxGeometry(1,1,1),bars={};let current=null,frame=null;
  for(const edge of ['top','left','right']){
    const material=new THREE.MeshBasicMaterial({color:'#74df85',transparent:true,opacity:.92,depthTest:false,depthWrite:false,toneMapped:false});
    const bar=new THREE.Mesh(geometry,material);bar.name='WallResize-'+edge;bar.userData.resizeEdge=edge;bar.renderOrder=25;root.add(bar);bars[edge]=bar;
  }
  function setActive(edge){for(const [key,bar]of Object.entries(bars))setResizeStripActive(bar,key===edge)}
  function update(record,visible){
    current=record;root.visible=!!visible&&(record?.kind==='wall'||record?.railing);if(!root.visible){setActive(null);return}
    bars.top.visible=!record.railing;
    record.root.updateWorldMatrix(true,true);camera.updateMatrixWorld();
    const b=record.localBounds,along=record.lengthAxis,depth=along==='x'?'z':'x',center=b.getCenter(new THREE.Vector3()),size=b.getSize(new THREE.Vector3());
    const tangent=new THREE.Vector3(along==='x'?1:0,0,along==='z'?1:0).applyQuaternion(record.root.quaternion),normal=new THREE.Vector3(depth==='x'?1:0,0,depth==='z'?1:0).applyQuaternion(record.root.quaternion);
    const middle=record.root.localToWorld(center.clone());if(camera.position.clone().sub(middle).dot(normal)<0)normal.negate();
    const rect=canvas.getBoundingClientRect(),pixelWorld=2*camera.position.distanceTo(middle)*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/rect.height,thickness=THREE.MathUtils.clamp(pixelWorld*10,.08,.28);
    const width=size[along]*record.root.scale[along],height=size.y*record.root.scale.y;
    root.position.copy(middle).addScaledVector(normal,size[depth]*record.root.scale[depth]/2+.045);
    root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(tangent,new THREE.Vector3(0,1,0),new THREE.Vector3().crossVectors(tangent,new THREE.Vector3(0,1,0))));
    bars.top.position.set(0,height/2+thickness*.75,0);bars.top.scale.set(Math.max(thickness*2,width*.8),thickness,thickness*.65);
    for(const [edge,sign]of [['left',-1],['right',1]]){bars[edge].position.set(sign*(width/2+thickness*.75),0,0);bars[edge].scale.set(thickness,Math.max(thickness*2,height*.76),thickness*.65)}
    root.updateMatrixWorld(true);frame={tangent,normal,width,height,middle};
  }
  function pick(raycaster){return root.visible?raycaster.intersectObjects(Object.values(bars).filter(b=>b.visible),false)[0]||null:null}
  function begin(edge,raycaster,event){
    if(!current||!frame)return null;
    const direction=edge==='top'?new THREE.Vector3(0,1,0):frame.tangent.clone();
    // A camera-facing plane containing the drag axis remains usable from above
    // and oblique views; an edge-on wall plane would produce unstable jumps.
    const view=camera.position.clone().sub(frame.middle),planeNormal=view.addScaledVector(direction,-view.dot(direction));
    if(planeNormal.lengthSq()<1e-5)planeNormal.copy(frame.normal);planeNormal.normalize();
    const anchor=bars[edge].getWorldPosition(new THREE.Vector3()),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal,anchor),start=raycaster.ray.intersectPlane(plane,new THREE.Vector3());
    if(!start)return null;
    const a=anchor.clone().project(camera),b=anchor.clone().add(direction).project(camera),rect=canvas.getBoundingClientRect(),screenAxis=new THREE.Vector2((b.x-a.x)*rect.width/2,(a.y-b.y)*rect.height/2);
    setActive(edge);
    return{edge,plane,start,direction,width:frame.width,height:frame.height,position:current.root.position.clone(),scale:current.root.scale.clone(),pointerStart:new THREE.Vector2(event.clientX,event.clientY),screenAxis};
  }
  function delta(state,raycaster,event){
    // At a near top-down angle the vertical axis is foreshortened. Keep an
    // intuitive screen-up height gesture instead of amplifying tiny movements.
    if(state.screenAxis.length()<12&&state.edge==='top')return(state.pointerStart.y-event.clientY)*.025;
    const p=raycaster.ray.intersectPlane(state.plane,new THREE.Vector3());return p?p.sub(state.start).dot(state.direction):0;
  }
  return{root,bars,update,pick,begin,delta,setActive};
}
