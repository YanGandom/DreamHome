import * as THREE from './vendor/three.module.js';

export function createGoldenDog({scene,system,random=Math.random}){
  const root=new THREE.Group();root.name='GoldenRetriever';root.userData.editorHelper=true;scene.add(root);
  const coat=new THREE.MeshStandardMaterial({color:'#dca64b',roughness:.9}),light=new THREE.MeshStandardMaterial({color:'#f2cc7d',roughness:.95}),earMat=new THREE.MeshStandardMaterial({color:'#b97c32',roughness:.9}),dark=new THREE.MeshStandardMaterial({color:'#302921',roughness:.5}),pink=new THREE.MeshStandardMaterial({color:'#db8184',roughness:.8}),collarMat=new THREE.MeshStandardMaterial({color:'#488b83',roughness:.6});
  const geo=new THREE.SphereGeometry(1,12,8);
  function ell(parent,name,x,y,z,sx,sy,sz,material){const m=new THREE.Mesh(geo,material);m.name=name;m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=m.receiveShadow=true;parent.add(m);return m}
  const body=new THREE.Group();root.add(body);
  ell(body,'GoldenCoat',0,.69,0,.30,.34,.57,coat);ell(body,'ChestRuff',0,.78,.37,.33,.39,.27,light);
  for(let i=0;i<5;i++)ell(body,'ChestFeather',Math.sin(i*1.6)*.21,.52,.43+i*.009,.105,.19,.13,light);
  const head=new THREE.Group();head.position.set(0,1.08,.48);body.add(head);
  ell(head,'Head',0,.08,.04,.28,.28,.29,coat);ell(head,'Muzzle',0,-.035,.30,.20,.135,.21,light);
  ell(head,'Smile',0,-.10,.38,.13,.048,.10,dark);ell(head,'Tongue',0,-.14,.41,.063,.07,.026,pink);ell(head,'Nose',0,.025,.46,.10,.063,.063,dark);
  const eyes=[];for(const side of [-1,1]){eyes.push(ell(head,'Eye',side*.18,.14,.244,.043,.052,.035,dark));ell(head,'EyeGlint',side*.18-.01,.158,.272,.012,.013,.01,light)}
  const ears=[];for(const side of [-1,1]){const ear=ell(head,'FloppyEar',side*.26,-.045,.015,.125,.29,.15,earMat);ear.rotation.z=side*.17;ears.push(ear)}
  const collar=new THREE.Mesh(new THREE.TorusGeometry(.25,.045,6,20),collarMat);collar.rotation.x=Math.PI/2;collar.position.set(0,.99,.42);body.add(collar);ell(body,'CollarTag',0,.88,.665,.055,.075,.024,light);
  const legs=[];for(const z of [-.34,.34])for(const x of [-.2,.2]){const leg=new THREE.Group();leg.position.set(x,.65,z);root.add(leg);ell(leg,'Leg',0,-.21,0,.09,.25,.10,coat);ell(leg,'Paw',0,-.49,.05,.115,.075,.155,light);legs.push(leg)}
  const tail=new THREE.Group();tail.position.set(0,.85,-.44);body.add(tail);
  for(let i=0;i<5;i++)ell(tail,'FeatherTail',0,.06+i*.065,-i*.12,.10-i*.012,.12-i*.012,.14, i>2?light:coat);
  const step=.55,cols=34,rows=27,x0=-9.1,z0=-6.4,clearance=.47;
  let cells=[],route=[],current=-1,state='idle',timer=1.5,rebuild=0,time=0,disposed=false;
  const point=i=>new THREE.Vector3(x0+(i%cols)*step,.16,z0+Math.floor(i/cols)*step);
  function rebuildGrid(){
    if(system.construction?.state.customGround){cells=[];root.visible=false;return}
    const blocked=[];for(const r of system.all()){
      if(!r.root.visible)continue;const b=new THREE.Box3().setFromObject(r.root);
      if(b.min.y>1.45||b.max.y<.25)continue;blocked.push(b);
    }
    for(const r of system.construction?.all()||[])if(r.level===1)blocked.push(new THREE.Box3(new THREE.Vector3(r.x-r.width/2,0,r.z-r.depth/2),new THREE.Vector3(r.x+r.width/2,2,r.z+r.depth/2)));
    for(const r of system.construction?.wallRecords()||[])blocked.push(new THREE.Box3().setFromObject(r.root));
    cells=Array.from({length:cols*rows},(_,i)=>{const p=point(i);return p.x> -8.7&&p.x<8.7&&p.z> -6.2&&p.z<8.2&&!blocked.some(b=>p.x>b.min.x-clearance&&p.x<b.max.x+clearance&&p.z>b.min.z-clearance&&p.z<b.max.z+clearance)});
    if(current<0||!cells[current]){const available=cells.map((ok,i)=>ok?i:-1).filter(i=>i>=0).sort((a,b)=>point(a).distanceToSquared(new THREE.Vector3(1,.16,7.8))-point(b).distanceToSquared(new THREE.Vector3(1,.16,7.8)));current=available[0]??-1;if(current>=0)root.position.copy(point(current));route=[]}
    root.visible=current>=0;if(route.some(i=>!cells[i])){route=[];state='idle';timer=.5}
  }
  function plan(){
    const queue=[current],parents=new Map([[current,-1]]);
    for(let k=0;k<queue.length;k++){const i=queue[k],x=i%cols,z=Math.floor(i/cols);for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz,j=nz*cols+nx;if(nx<0||nx>=cols||nz<0||nz>=rows||!cells[j]||parents.has(j))continue;parents.set(j,i);queue.push(j)}}
    const candidates=queue.filter(i=>point(i).distanceTo(root.position)>2&&point(i).distanceTo(root.position)<7);
    if(!candidates.length){state='idle';timer=2;return}
    let end=candidates[Math.floor(random()*candidates.length)];route=[];while(end!==current){route.unshift(end);end=parents.get(end)}state='walk';
  }
  function update(dt,paused=false){
    if(disposed)return;dt=Math.min(.05,Math.max(0,dt));time+=dt;rebuild-=dt;if(rebuild<=0&&!paused){rebuildGrid();rebuild=2}
    if(!root.visible)return;
    if(!paused){
      if(state==='walk'&&route.length){const destination=point(route[0]),delta=destination.clone().sub(root.position),distance=delta.length(),travel=.85*dt;const angle=Math.atan2(delta.x,delta.z),difference=Math.atan2(Math.sin(angle-root.rotation.y),Math.cos(angle-root.rotation.y));root.rotation.y+=difference*Math.min(1,dt*9);
        if(distance<=travel){root.position.copy(destination);current=route.shift()}else root.position.addScaledVector(delta,travel/distance);
        if(!route.length){state=['idle','sniff','sit'][Math.floor(random()*3)];timer=2+random()*3}
      }else{timer-=dt;if(timer<=0)plan()}
    }
    const walking=!paused&&state==='walk',sitting=state==='sit',phase=time*8;
    body.position.y=walking?Math.sin(phase*2)*.018:sitting?-.13:Math.sin(time*2)*.008;
    body.rotation.x=sitting?-.22:0;
    head.rotation.x=state==='sniff'?.5+Math.sin(time*4)*.08:Math.sin(time*1.6)*.045;head.rotation.y=walking?0:Math.sin(time*.85)*.16;
    tail.rotation.y=Math.sin(time*(walking?9:5))*.48;tail.rotation.x=sitting?-.2:.1;
    legs.forEach((leg,i)=>{leg.rotation.x=walking?Math.sin(phase+(i===0||i===3?0:Math.PI))*.43:sitting&&i<2?-1.0:0;leg.position.y=sitting&&i<2?.36:.565});
    ears.forEach((ear,i)=>ear.rotation.x=walking?Math.sin(phase+i)*.13:Math.sin(time*2)*.025);
    const blink=time%4.7<.12;eyes.forEach(eye=>eye.scale.y=blink?.008:.052);
  }
  rebuildGrid();
  return{root,update,get state(){return state},get route(){return route.map(point)},get position(){return root.position.clone()},dispose(){disposed=true;root.removeFromParent();geo.dispose();collar.geometry.dispose();for(const m of [coat,light,earMat,dark,pink,collarMat])m.dispose()}};
}
