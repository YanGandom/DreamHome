import * as THREE from './vendor/three.module.js';

export function createOutdoorStyles(){
  const definitions=[['stone','暖灰方砖','tiles','#b9b2a1'],['terracotta','陶红错缝砖','tiles','#c58167'],['slate','青灰长砖','tiles','#738b88'],['mosaic','奶油菱形拼砖','tiles','#e5d5b7'],['grass','绿草地','garden','#70934c'],['daisies','雏菊草地与蝴蝶','garden','#719d52'],['purple','紫色花地','garden','#6e9250'],['yellow','黄色花地','garden','#78934b']];
  return definitions.map(([id,name,family,color])=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d');c.fillStyle=color;c.fillRect(0,0,512,512);
    if(family==='garden'){
      for(let i=0;i<2200;i++){const x=i*137%512,y=i*223%512;c.strokeStyle=i%3?'#a6bd6d66':'#3d703e66';c.lineWidth=1.4;c.beginPath();c.moveTo(x,y);c.lineTo(x+3,y-5-i%5);c.stroke()}
      if(id!=='grass')for(let i=0;i<28;i++){const x=(i*137+25)%512,y=(i*71+35)%512;c.fillStyle=id==='purple'?'#ae7dda':id==='yellow'?'#f4ca4f':'#fffcdf';c.beginPath();c.arc(x,y,6,0,Math.PI*2);c.fill()}
    }else{
      c.fillStyle='#8b8273';c.fillRect(0,0,512,512);
      const w=id==='slate'?256:128,h=id==='slate'?64:id==='terracotta'?64:128;
      for(let row=0;row<512/h;row++)for(let col=-1;col<512/w+1;col++){
        const x=col*w+(['slate','terracotta'].includes(id)&&row%2?w/2:0),y=row*h;c.fillStyle=(row+col)%3===0?(id==='terracotta'?'#df9b7b':id==='slate'?'#93a5a0':id==='mosaic'?'#f0e4ce':'#d5cbb5'):color;c.fillRect(x+2,y+2,w-4,h-4);
        c.strokeStyle='#ffffff35';c.lineWidth=2;c.strokeRect(x+5,y+5,w-10,h-10);
        if(id==='mosaic'){c.fillStyle='#779d96';c.beginPath();c.moveTo(x+w/2,y+18);c.lineTo(x+w-18,y+h/2);c.lineTo(x+w/2,y+h-18);c.lineTo(x+18,y+h/2);c.closePath();c.fill()}
      }
    }
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;
    return{id,name,family,texture,preview:canvas.toDataURL?.('image/png')||'',span:family==='garden'?2:2.8};
  });
}

export function createOutdoorPlot({width,depth,style,material}){
  const root=new THREE.Group();root.name='OutdoorPlot';root.userData.surfaceId='outdoor';
  const garden=style.family==='garden',border=garden?.18:0,map=style.texture.clone();map.repeat.set((width-border*2)/style.span,(depth-border*2)/style.span);map.needsUpdate=true;
  const finish=material('#ffffff',{map,roughness:.94});finish.userData.ownedTexture=true;
  const surface=new THREE.Mesh(new THREE.BoxGeometry(width-border*2,.055,depth-border*2),finish);surface.name='OutdoorPlotFinish';surface.position.y=.0275;surface.receiveShadow=true;surface.userData.surfaceId='outdoor';root.add(surface);
  if(garden){
    const nx=Math.max(1,Math.ceil(width/.42)),nz=Math.max(1,Math.ceil((depth-.36)/.42)),brickGeo=new THREE.BoxGeometry(1,.14,1),bricks=new THREE.InstancedMesh(brickGeo,material('#b78668'),2*(nx+nz)),o=new THREE.Object3D();bricks.name='BrickEdging';let at=0;
    for(const sign of [-1,1]){for(let i=0;i<nx;i++){o.position.set(-width/2+(i+.5)*width/nx,.07,sign*(depth/2-.09));o.scale.set(width/nx-.015,1,.18);o.updateMatrix();bricks.setMatrixAt(at++,o.matrix)}for(let i=0;i<nz;i++){o.position.set(sign*(width/2-.09),.07,-(depth-.36)/2+(i+.5)*(depth-.36)/nz);o.scale.set(.18,1,(depth-.36)/nz-.015);o.updateMatrix();bricks.setMatrixAt(at++,o.matrix)}}
    bricks.receiveShadow=bricks.castShadow=true;bricks.userData.surfaceId='other';root.add(bricks);
    if(style.id!=='grass'){
      const count=Math.min(800,Math.max(4,Math.floor((width-.4)*(depth-.4)*(style.id==='daisies'?8:24)))),shape=new THREE.Shape();
      for(let i=0;i<=60;i++){const a=i/60*Math.PI*2,r=.052+.018*Math.cos(5*a),x=Math.cos(a)*r,y=Math.sin(a)*r;if(i)shape.lineTo(x,y);else shape.moveTo(x,y)}
      const petals=new THREE.InstancedMesh(new THREE.ShapeGeometry(shape),material(style.id==='purple'?'#a56dd0':style.id==='yellow'?'#f5c441':'#fffbea',{side:THREE.DoubleSide}),count),centers=new THREE.InstancedMesh(new THREE.SphereGeometry(.018,6,4),material(style.id==='daisies'?'#efbd38':style.id==='purple'?'#705095':'#ba852b'),count),stems=new THREE.InstancedMesh(new THREE.CylinderGeometry(.006,.006,.12,4),material('#547d3d'),count);
      petals.name='FlowerPetals';centers.name='FlowerCenters';stems.name='FlowerStems';
      for(let i=0;i<count;i++){const x=((i*.61803398875+.17)%1-.5)*(width-.5),z=((i*.41421356237+.29)%1-.5)*(depth-.5),y=.14+(i%5)*.012;o.position.set(x,y,z);o.rotation.set(-Math.PI/2,0,i*2.4);o.scale.setScalar(.9+(i%3)*.15);o.updateMatrix();petals.setMatrixAt(i,o.matrix);o.rotation.set(0,0,0);o.scale.set(1,1,1);o.position.y=y+.006;o.updateMatrix();centers.setMatrixAt(i,o.matrix);o.position.y=y-.055;o.updateMatrix();stems.setMatrixAt(i,o.matrix)}
      for(const mesh of [petals,centers,stems]){mesh.userData.surfaceId='other';root.add(mesh)}
    }
    if(style.id==='daisies')for(let i=0;i<Math.min(8,Math.max(2,Math.round(width*depth/5)));i++){
      const butterfly=new THREE.Group();butterfly.name='GardenButterfly';butterfly.userData.butterfly={phase:i*2.399,width,depth};
      for(const side of [-1,1]){const wing=new THREE.Mesh(new THREE.CircleGeometry(.075,10),material(i%2?'#f3b965':'#c4a2ed',{side:THREE.DoubleSide}));wing.position.x=side*.05;wing.scale.y=1.45;wing.userData.wingSide=side;butterfly.add(wing)}
      butterfly.userData.editorHelper=true;butterfly.traverse(o=>o.userData.editorHelper=true);root.add(butterfly);
    }
  }
  root.updateMatrixWorld(true);return root;
}

export function animateOutdoorPlots(root,seconds){root.traverse(o=>{const b=o.userData.butterfly;if(!b)return;const a=seconds*.6+b.phase;o.position.set(Math.sin(a)*Math.max(.1,b.width/2-.4)*.75,.45+Math.sin(seconds*1.7+b.phase)*.10,Math.cos(a*.8)*Math.max(.1,b.depth/2-.4)*.75);o.rotation.y=-a;for(const wing of o.children)wing.rotation.y=wing.userData.wingSide*(.3+Math.sin(seconds*15+b.phase)*.75)})}
