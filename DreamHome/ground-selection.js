import * as THREE from './vendor/three.module.js';

// Flat scene-space selection graphics stay on the selected object's own floor.
export function createGroundSelection(scene,name='GroundSelection'){
  const root=new THREE.Group();root.name=name;root.visible=false;root.userData.editorHelper=true;scene.add(root);
  const material=(color,opacity=1)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  const fill=new THREE.Mesh(new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),material('#59db75',.24));fill.name='SelectionFootprint';fill.renderOrder=10;root.add(fill);
  const borderShape=new THREE.Shape();borderShape.moveTo(-.5,-.5);borderShape.lineTo(.5,-.5);borderShape.lineTo(.5,.5);borderShape.lineTo(-.5,.5);borderShape.closePath();
  const hole=new THREE.Path();hole.moveTo(-.48,-.48);hole.lineTo(-.48,.48);hole.lineTo(.48,.48);hole.lineTo(.48,-.48);hole.closePath();borderShape.holes.push(hole);
  const border=new THREE.Mesh(new THREE.ShapeGeometry(borderShape).rotateX(-Math.PI/2),material('#a0f2a2',.95));border.name='SelectionFootprintEdge';border.position.y=.002;border.renderOrder=11;root.add(border);
  const arrows=new THREE.Group();arrows.name='MoveArrows';root.add(arrows);
  const shape=new THREE.Shape();shape.moveTo(-.15,-.5);shape.lineTo(.15,-.5);shape.lineTo(.15,.08);shape.lineTo(.42,.08);shape.lineTo(0,.5);shape.lineTo(-.42,.08);shape.lineTo(-.15,.08);shape.closePath();
  const geometry=new THREE.ShapeGeometry(shape).rotateX(-Math.PI/2),green=material('#46d64d');
  for(const [name,x,z,angle,axis]of [['front',0,1,Math.PI,'z'],['back',0,-1,0,'z'],['left',-1,0,Math.PI/2,'x'],['right',1,0,-Math.PI/2,'x']]){
    const arrow=new THREE.Mesh(geometry,green);arrow.name='MoveArrow-'+name;arrow.rotation.y=angle;arrow.renderOrder=12;arrow.userData={moveAxis:axis,direction:[x,z]};arrows.add(arrow);
  }
  if(name!=='GroundSelection')root.traverse(o=>{if(o!==root)o.name=name+'-'+o.name});
  const bounds=new THREE.Box3();
  function update(record,moving){
    root.visible=!!record;if(!record)return bounds;
    record.root.updateWorldMatrix(true,true);bounds.setFromObject(record.root);
    const side=Math.max(bounds.max.x-bounds.min.x,bounds.max.z-bounds.min.z,.5)+.20;
    // Above the floor finish, below the furniture; the slight offset avoids z-fighting.
    const floor=record.root.position.y+.02;
    const invalid=record.root.userData.placementInvalid;
    fill.material.color.set(invalid?'#e65b4f':'#59db75');border.material.color.set(invalid?'#ff9b82':'#a0f2a2');
    root.position.set((bounds.min.x+bounds.max.x)/2,floor,(bounds.min.z+bounds.max.z)/2);
    fill.scale.set(side,1,side);border.scale.copy(fill.scale);
    if(record.kind==='wall'){fill.scale.set(bounds.max.x-bounds.min.x+.2,1,bounds.max.z-bounds.min.z+.2);border.scale.copy(fill.scale)}
    root.rotation.set(0,0,0);
    if(record.railing){
      const size=record.localBounds.getSize(new THREE.Vector3()).multiply(record.root.scale);
      const center=record.root.localToWorld(record.localBounds.getCenter(new THREE.Vector3()));
      root.position.set(center.x,floor,center.z);root.rotation.y=record.root.rotation.y;
      fill.scale.set(size.x+.2,1,size.z+.2);border.scale.copy(fill.scale);
    }
    if(record.kind==='mounted'){
      const wallAngle=record.root.rotation.y+(record.mountWallId==='wall-3'?Math.PI/2:0),normal=new THREE.Vector3(Math.sin(wallAngle),0,Math.cos(wallAngle));
      root.rotation.set(Math.PI/2,wallAngle,0,'YXZ');root.position.copy(bounds.getCenter(new THREE.Vector3())).addScaledVector(normal,Math.min(bounds.max.x-bounds.min.x,bounds.max.z-bounds.min.z)/2+.025);
      const width=record.mountWallId==='wall-3'?record.localBounds.max.z-record.localBounds.min.z:record.localBounds.max.x-record.localBounds.min.x;
      fill.scale.set(width+.15,1,bounds.max.y-bounds.min.y+.15);border.scale.copy(fill.scale);
    }
    arrows.visible=moving;
    // Movement arrows retain the world X/Z axes used by drag constraints.
    arrows.rotation.y=record.railing?-root.rotation.y:0;
    const arrowWidth=record.railing?bounds.max.x-bounds.min.x+.2:fill.scale.x,arrowDepth=record.railing?bounds.max.z-bounds.min.z+.2:fill.scale.z;
    const length=THREE.MathUtils.clamp(side*.23,.50,.82),distanceX=arrowWidth/2+length/2+.16,distanceZ=arrowDepth/2+length/2+.16;
    for(const arrow of arrows.children){const [x,z]=arrow.userData.direction;arrow.position.set(x*distanceX,.008,z*distanceZ);arrow.scale.set(length,1,length)}
    root.updateMatrixWorld(true);return bounds;
  }
  function pick(raycaster){return root.visible&&arrows.visible?raycaster.intersectObjects(arrows.children,false)[0]||null:null}
  return{root,update,pick};
}
