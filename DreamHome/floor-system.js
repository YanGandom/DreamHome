import * as THREE from './vendor/three.module.js';

function makeStyles(anisotropy){
  const definitions=[
    {id:'wood-planks',name:'橡木直铺',kind:'wood',span:2.4,roughness:.66},
    {id:'wood-herringbone',name:'胡桃木人字拼',kind:'wood',span:2.4,roughness:.62},
    {id:'tile-checker',name:'双色棋盘瓷砖',kind:'tile',span:2.4,roughness:.38},
    {id:'tile-floral',name:'蓝白花纹瓷砖',kind:'tile',span:1.8,roughness:.44}
  ];
  for(const style of definitions){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
    const c=canvas.getContext('2d'),size=512;let seed=219;
    const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
    function plank(x,y,w,h,vertical,dark){
      c.save();c.translate(x,y);if(vertical){c.rotate(Math.PI/2);c.translate(0,-w);[w,h]=[h,w]}
      c.fillStyle=dark?['#875431','#98643c','#ad794a','#764b30'][Math.floor(random()*4)]:['#bf915e','#cea370','#d6ac79','#b88956'][Math.floor(random()*4)];
      c.fillRect(1,1,w-2,h-2);
      c.strokeStyle=dark?'#422b2440':'#79512640';c.lineWidth=.7;
      for(let i=0;i<9;i++){const yy=3+random()*(h-6);c.beginPath();c.moveTo(2,yy);c.bezierCurveTo(w*.27,yy-2,w*.65,yy+3,w-2,yy);c.stroke()}
      c.strokeStyle='#ffe9c438';c.lineWidth=1;c.beginPath();c.moveTo(2,2);c.lineTo(w-2,2);c.stroke();c.restore();
    }
    if(style.id==='wood-planks'){
      c.fillStyle='#765638';c.fillRect(0,0,size,size);
      for(let row=0;row<8;row++)for(let col=-1;col<3;col++)plank(col*256+(row%2)*128,row*64,256,64,false,false);
    }else if(style.id==='wood-herringbone'){
      c.fillStyle='#523622';c.fillRect(0,0,size,size);
      // Two interlocking rectangles form a periodic herringbone unit cell.
      const unit=32,L=4;
      for(let i=-2;i<7;i++)for(let j=-24;j<25;j++){
        const x=(i*(L+1)+j)*unit,y=(i*(L-1)-j)*unit;
        if(x+5*unit<0||x>size||y+4*unit<0||y>size)continue;
        plank(x,y,L*unit,unit,false,true);plank(x+L*unit,y,unit,L*unit,true,true);
      }
    }else if(style.id==='tile-checker'){
      c.fillStyle='#a99e86';c.fillRect(0,0,size,size);
      for(let row=0;row<8;row++)for(let col=0;col<8;col++){
        c.fillStyle=(row+col)%2?'#6b8580':'#eee3cd';c.fillRect(col*64+1.5,row*64+1.5,61,61);
        c.strokeStyle='#ffffff30';c.strokeRect(col*64+3,row*64+3,58,58);
      }
    }else{
      c.fillStyle='#b5bdb7';c.fillRect(0,0,size,size);
      for(let row=0;row<4;row++)for(let col=0;col<4;col++){
        const x=col*128,y=row*128;c.fillStyle='#f1ead9';c.fillRect(x+2,y+2,124,124);
        c.strokeStyle='#7896a0';c.lineWidth=2;c.strokeRect(x+10,y+10,108,108);
        c.save();c.translate(x+64,y+64);c.fillStyle='#628696';
        for(let i=0;i<4;i++){c.save();c.rotate(i*Math.PI/2);c.beginPath();c.moveTo(0,0);c.bezierCurveTo(-24,-8,-25,-34,0,-44);c.bezierCurveTo(25,-34,24,-8,0,0);c.fill();c.restore()}
        c.fillStyle='#c5a56b';c.beginPath();c.arc(0,0,8,0,Math.PI*2);c.fill();
        c.fillStyle='#628696';for(const sx of [-1,1])for(const sy of [-1,1]){c.beginPath();c.moveTo(sx*44,sy*36);c.lineTo(sx*51,sy*44);c.lineTo(sx*44,sy*51);c.lineTo(sx*36,sy*44);c.closePath();c.fill()}c.restore();
      }
    }
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=anisotropy;
    style.texture=texture;style.preview=canvas.toDataURL?.('image/png')||'';
  }
  return definitions;
}

export function createFloorSystem({parent,specs,mergeGeometries,anisotropy=1}){
  const styles=makeStyles(anisotropy),records=new Map();
  for(const spec of specs){
    const root=new THREE.Group();root.name='RoomFloor-'+spec.id;
    const [base,...decorations]=spec.meshes,details=new THREE.Group();details.name='OriginalFloorPattern';
    root.add(base);root.add(details);parent.add(root);
    // Keep each room's original decorative tiles in a small number of batches.
    const buckets=new Map();
    for(const mesh of decorations){
      mesh.updateWorldMatrix(true,false);const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      if(!buckets.has(mesh.material))buckets.set(mesh.material,[]);buckets.get(mesh.material).push(geometry);mesh.removeFromParent();
    }
    for(const [material,geometries]of buckets){
      const geometry=mergeGeometries(geometries,false);if(!geometry)throw new Error('无法组合地面：'+spec.name);
      const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;details.add(mesh);geometries.forEach(g=>g.dispose());
    }
    const level=spec.id==='balcony'?2:1;root.userData.surfaceId='floor-'+level;
    root.traverse(o=>{if(o.isMesh){o.userData.floorId=spec.id;o.userData.surfaceId='floor-'+level}});
    const materials=new Map();
    for(const style of styles){
      const map=style.texture.clone();map.repeat.set(spec.width/style.span,spec.depth/style.span);map.needsUpdate=true;
      materials.set(style.id,new THREE.MeshStandardMaterial({map,color:'#ffffff',roughness:style.roughness}));
    }
    records.set(spec.id,{id:spec.id,name:spec.name,level,width:spec.width,depth:spec.depth,root,base,details,original:base.material,materials,styleId:null});
  }
  function set(id,styleId){
    const room=records.get(id);if(!room||(styleId!==null&&!room.materials.has(styleId)))return false;
    room.styleId=styleId;room.base.material=styleId===null?room.original:room.materials.get(styleId);
    if(styleId===null)room.root.add(room.details);else room.details.removeFromParent();
    room.root.updateMatrixWorld(true);return true;
  }
  function meshes(){const result=[];for(const room of records.values())room.root.traverse(o=>{if(o.isMesh)result.push(o)});return result}
  const serialize=()=>Object.fromEntries([...records.values()].map(r=>[r.id,r.styleId]));
  const load=state=>{for(const r of records.values()){const id=state?.[r.id];set(r.id,r.materials.has(id)?id:null)}};
  function resizeTextures(id,sx,sz){const r=records.get(id);if(!r)return;for(const style of styles)r.materials.get(style.id).map.repeat.set(r.width*sx/style.span,r.depth*sz/style.span)}
  function addRoom(id,root,base,width,depth,level){
    const existing=records.get(id);
    base.userData.floorId=id;base.userData.surfaceId='floor-'+level;
    if(existing?.dynamic){Object.assign(existing,{root,base,width,depth,level,original:base.material});resizeTextures(id,1,1);return existing}
    const materials=new Map();for(const style of styles){const map=style.texture.clone();map.repeat.set(width/style.span,depth/style.span);map.needsUpdate=true;materials.set(style.id,new THREE.MeshStandardMaterial({map,roughness:style.roughness}))}
    records.set(id,{id,name:'新房间',level,width,depth,root,base,details:new THREE.Group(),original:base.material,materials,styleId:null,dynamic:true});return records.get(id);
  }
  function removeRoom(id){const r=records.get(id);if(!r?.dynamic)return;for(const m of r.materials.values()){m.map.dispose();m.dispose()}records.delete(id)}
  return{styles,all:()=>[...records.values()],get:id=>records.get(id)||null,meshes,set,serialize,load,resizeTextures,addRoom,removeRoom};
}
