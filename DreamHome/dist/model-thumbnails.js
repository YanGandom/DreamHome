import * as THREE from './vendor/three.module.js';

export function frameThumbnail(record){
  const model=record.root.clone(true);model.visible=true;model.position.set(0,0,0);model.traverse(o=>{if(o.isLight)o.visible=false});
  const bounds=new THREE.Box3().setFromObject(model),center=bounds.getCenter(new THREE.Vector3());model.position.sub(center);
  const radius=Math.max(bounds.getSize(new THREE.Vector3()).length()/2,.1),camera=new THREE.PerspectiveCamera(32,1,.01,radius*20+10);
  camera.position.set(1.25,.95,1.6).normalize().multiplyScalar(radius/Math.sin(16*Math.PI/180)*1.12);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
  return{model,camera};
}

// One offscreen target on the existing renderer, never one WebGL context per card.
export function createModelThumbnails(renderer){
  const size=240,target=new THREE.WebGLRenderTarget(size,size);target.texture.colorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#ecefe5');
  // Render targets bypass display tone mapping in Three r170. Keep the neutral
  // preview illumination below clipping; its sRGB attachment handles encoding.
  scene.add(new THREE.HemisphereLight('#fff9ea','#778c89',1.5));
  const light=new THREE.DirectionalLight('#fff2d7',1.7);light.position.set(-3,6,5);scene.add(light);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d');
  const pixels=new Uint8Array(size*size*4),cache=new Map(),queue=new Map();
  function request(record,image){
    const key=[record.sourceId,record.color||'original',record.root.rotation.y.toFixed(3),record.wallMaterial||'',record.root.scale.toArray().join(',')].join(':');
    if(cache.has(key)){image.src=cache.get(key);return}
    if(!queue.has(key))queue.set(key,{record,images:[]});queue.get(key).images.push(image);
  }
  function update(){
    const next=queue.entries().next();if(next.done)return;
    const [key,{record,images}]=next.value;queue.delete(key);
    const {model,camera}=frameThumbnail(record);scene.add(model);
    const state={target:renderer.getRenderTarget(),viewport:renderer.getViewport(new THREE.Vector4()),scissor:renderer.getScissor(new THREE.Vector4()),scissorTest:renderer.getScissorTest(),clear:renderer.getClearColor(new THREE.Color()),alpha:renderer.getClearAlpha(),autoClear:renderer.autoClear,shadows:renderer.shadowMap.enabled,exposure:renderer.toneMappingExposure};
    try{
      renderer.shadowMap.enabled=false;renderer.toneMappingExposure=1.1;renderer.autoClear=true;renderer.setRenderTarget(target);renderer.setViewport(0,0,size,size);renderer.setScissorTest(false);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,size,size,pixels);
      const data=ctx.createImageData(size,size);for(let y=0;y<size;y++)data.data.set(pixels.subarray((size-1-y)*size*4,(size-y)*size*4),y*size*4);ctx.putImageData(data,0,0);
      const url=canvas.toDataURL('image/png');cache.set(key,url);if(cache.size>160)cache.delete(cache.keys().next().value);for(const image of images)image.src=url;
    }finally{
      model.removeFromParent();renderer.setRenderTarget(state.target);renderer.setViewport(state.viewport);renderer.setScissor(state.scissor);renderer.setScissorTest(state.scissorTest);renderer.setClearColor(state.clear,state.alpha);renderer.autoClear=state.autoClear;renderer.shadowMap.enabled=state.shadows;renderer.toneMappingExposure=state.exposure;
    }
  }
  function clearPending(){queue.clear()}
  return{request,update,clearPending};
}
