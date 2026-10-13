// A lightweight model thumbnail bridges the dock and the 3D placement preview.
export function createLibraryCarry(){
  const image=document.createElement('img');image.className='library-carry';image.hidden=true;image.draggable=false;image.alt='';image.setAttribute('aria-hidden','true');document.body.append(image);
  return{
    start(card,event={}){image.src=card.children[0]?.src||'';const r=card.getBoundingClientRect();this.move({clientX:event.clientX||r.left+r.width/2,clientY:event.clientY||r.top+r.height/2});},
    move(event,show=true){image.style.left=event.clientX+'px';image.style.top=event.clientY+'px';image.hidden=!show;},
    hide(){image.hidden=true}
  };
}
