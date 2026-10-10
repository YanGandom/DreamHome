export function createSceneMenu(doc=document){
  const toggle=doc.getElementById('scene-menu-toggle'),panel=doc.getElementById('scene-menu');
  function setOpen(open,focus=false){panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));if(focus)(open?doc.getElementById('rotate'):toggle).focus()}
  toggle.addEventListener('click',()=>setOpen(panel.hidden));
  doc.addEventListener('pointerdown',event=>{if(!panel.hidden&&!panel.contains(event.target)&&!toggle.contains(event.target))setOpen(false)});
  doc.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){event.preventDefault();event.stopImmediatePropagation();setOpen(false,true)}},{capture:true});
  doc.getElementById('capture').addEventListener('click',()=>setOpen(false));
  setOpen(false);return{setOpen,get open(){return!panel.hidden}};
}
