import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';
import {frameThumbnail,createModelThumbnails} from './model-thumbnails.js';

export function checkThumbnails(records,test){
  test('every real model fits its thumbnail camera without altering source geometry or transform',()=>{
    for(const r of records){
      const before=r.root.position.toArray(),visible=r.root.visible,{model,camera}=frameThumbnail(r),box=new THREE.Box3().setFromObject(model);
      for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const p=new THREE.Vector3(x,y,z).project(camera);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z>=-1&&p.z<=1,r.id)}
      assert.deepEqual(r.root.position.toArray(),before);assert.equal(r.root.visible,visible);assert.equal(model.children[0].geometry,r.root.children[0].geometry);assert.equal(model.children[0].material,r.root.children[0].material);
      model.traverse(o=>{if(o.isLight)assert.equal(o.visible,false)});r.root.traverse(o=>{if(o.isLight)assert.equal(o.visible,true)});
    }
  });
  test('thumbnail previews fit high-DPI targets, cache images and restore screen or target state after errors',()=>{
    for(const pixelRatio of [1,1.5,2,3])for(const useTarget of [false,true]){
    const originalCreate=document.createElement;let imageData,fail=false,renders=0;
    document.createElement=()=>({getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:data=>{imageData=data}}),toDataURL:()=> 'data:image/png;base64,test'});
    const viewport=new THREE.Vector4(1,2,900,600),scissor=new THREE.Vector4(3,4,700,400),clear=new THREE.Color('#112233');
    const activeViewport=new THREE.Vector4(),activeScissor=new THREE.Vector4();
    let currentTarget=null,scissorTest=true,activeScissorTest=true,alpha=.4;
    // Match Three r170: setViewport scales CSS units, whereas binding a
    // render target installs its viewport directly in framebuffer pixels.
    const renderer={shadowMap:{enabled:true},autoClear:false,toneMappingExposure:1.18,
      getRenderTarget:()=>currentTarget,setRenderTarget:v=>{currentTarget=v;activeViewport.copy(v?v.viewport:viewport.clone().multiplyScalar(pixelRatio).floor());activeScissor.copy(v?v.scissor:scissor.clone().multiplyScalar(pixelRatio).floor());activeScissorTest=v?v.scissorTest:scissorTest},getViewport:v=>v.copy(viewport),getScissor:v=>v.copy(scissor),getScissorTest:()=>scissorTest,setScissorTest:v=>{scissorTest=v;activeScissorTest=v},getClearColor:v=>v.copy(clear),getClearAlpha:()=>alpha,setClearColor:(v,a)=>{clear.copy(v);alpha=a},
      setViewport:(...args)=>{args.length===1?viewport.copy(args[0]):viewport.set(...args);activeViewport.copy(viewport).multiplyScalar(pixelRatio).round()},setScissor:v=>{scissor.copy(v);activeScissor.copy(v).multiplyScalar(pixelRatio).round()},
      render:(scene,camera)=>{renders++;assert.equal(currentTarget.width,240);assert.deepEqual(activeViewport.toArray(),[0,0,240,240],`DPR ${pixelRatio}`);assert.equal(activeScissorTest,false);assert.ok(scene.children.some(o=>o.isGroup));assert.ok(camera.isPerspectiveCamera);if(fail)throw new Error('mock GPU failure')},
      readRenderTargetPixels:(target,x,y,w,h,pixels)=>{pixels.fill(0);pixels[0]=11;pixels[(h-1)*w*4]=22}
    };
    const previousTarget=useTarget?new THREE.WebGLRenderTarget(320,180):null;
    if(previousTarget){previousTarget.viewport.set(8,6,300,164);previousTarget.scissor.set(12,10,280,150);previousTarget.scissorTest=true}
    renderer.setRenderTarget(previousTarget);
    const state=()=>({target:currentTarget,viewport:viewport.toArray(),scissor:scissor.toArray(),scissorTest,activeViewport:activeViewport.toArray(),activeScissor:activeScissor.toArray(),activeScissorTest,clear:clear.getHexString(),alpha,shadow:renderer.shadowMap.enabled,auto:renderer.autoClear,exposure:renderer.toneMappingExposure});
    try{
      const before=state(),service=createModelThumbnails(renderer),a={},b={};service.request(records[0],a);service.request(records[0],b);service.update();
      assert.equal(renders,1);assert.equal(a.src,b.src);assert.ok(a.src.startsWith('data:image/png'));assert.equal(imageData.data[0],22);assert.equal(imageData.data[(240-1)*240*4],11);assert.deepEqual(state(),before);
      const cached={};service.request(records[0],cached);service.update();assert.equal(renders,1);assert.equal(cached.src,a.src);
      fail=true;service.request(records[1],{});assert.throws(()=>service.update(),/mock GPU failure/);assert.deepEqual(state(),before);
    }finally{document.createElement=originalCreate}
    }
  });
}
