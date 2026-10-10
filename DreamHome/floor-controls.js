import * as THREE from './vendor/three.module.js';

export function createFloorControls({camera,renderer,system,onInteract=()=>{},onSelection=()=>{}}){
  const floors=system.floorSystem,popup=document.getElementById('floor-ui'),options=document.getElementById('floor-options'),confirm=document.getElementById('floor-confirm');
  let selectedId=null,anchor=new THREE.Vector3();
  function render(){
    popup.hidden=!selectedId;
    for(const button of options.children){const selected=floors.get(selectedId)?.styleId===button.dataset.floorStyle;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected))}
    update();
  }
  function update(){
    if(!selectedId)return;
    camera.updateMatrixWorld();const point=anchor.clone().project(camera),rect=renderer.domElement.getBoundingClientRect();
    const width=popup.offsetWidth||280,height=popup.offsetHeight||84,margin=12;
    const x=rect.left+(point.x+1)*rect.width/2,y=rect.top+(1-point.y)*rect.height/2;
    popup.style.visibility=point.z>=-1&&point.z<=1&&x>=rect.left&&x<=rect.left+rect.width&&y>=rect.top&&y<=rect.top+rect.height?'visible':'hidden';
    popup.style.left=Math.max(rect.left+margin,Math.min(x-width/2,rect.left+rect.width-width-margin))+'px';
    popup.style.top=Math.max(rect.top+margin,Math.min(y-height-8,rect.top+rect.height-height-margin))+'px';
  }
  function close(commit=true){
    if(!selectedId)return;selectedId=null;
    if(commit)system.commitGesture();else system.cancelGesture();render();onSelection(null);
  }
  function select(id,point){
    if(!floors.get(id))return;close();selectedId=id;anchor.copy(point);system.beginGesture();onInteract();render();onSelection(id);
  }
  for(const style of floors.styles){
    const button=document.createElement('button');button.type='button';button.className='orbit-button floor-option';button.dataset.floorStyle=style.id;button.setAttribute('aria-label',style.name);button.setAttribute('aria-pressed','false');button.title=style.name;
    const image=document.createElement('img');image.src=style.preview;image.alt='';image.draggable=false;button.append(image);
    button.addEventListener('click',()=>{if(selectedId)system.floorPreview(selectedId,style.id)});options.append(button);
  }
  const buttons=[...options.children,confirm];buttons.forEach((button,i)=>{button.style.left=(34+i*53)+'px';button.style.top=(54-Math.sin(i*Math.PI/4)*21)+'px'});
  confirm.addEventListener('click',()=>close());system.subscribe(render);render();
  return{select,close,update,get selectedId(){return selectedId}};
}
