// Small synthesized soundtrack: no downloads and no third-party audio assets.
export function createGameAudio({music=true,effects=true,doc=document}={}){
  let context=null,timer=null,step=0,next=0,started=false;
  const notes=[261.63,329.63,392,523.25,440,392,329.63,293.66];
  function tone(frequency,time,duration,volume,type='sine'){
    const oscillator=context.createOscillator(),gain=context.createGain();oscillator.type=type;oscillator.frequency.value=frequency;gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(volume,time+.02);gain.gain.exponentialRampToValueAtTime(.0001,time+duration);oscillator.connect(gain);gain.connect(context.destination);oscillator.start(time);oscillator.stop(time+duration+.02);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect()};
  }
  function schedule(){if(!context||!music||doc.hidden||context.state!=='running')return;while(next<context.currentTime+.4){tone(notes[step%notes.length],next,1.6,.024);if(step%4===0)tone(notes[Math.floor(step/4)%4]/2,next,2.6,.018);step++;next+=.65}}
  async function start(){if(!music&&!effects)return;const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return;try{context??=new Audio();const current=context;await current.resume();if(context!==current)return;started=true;if(!timer)timer=setInterval(schedule,150);next=Math.max(next,context.currentTime);schedule()}catch{}}
  function stopMusic(){if(timer){clearInterval(timer);timer=null}if(context){context.close().catch(()=>{});context=null}started=false;next=0;step=0}
  function set(nextMusic,nextEffects){const changed=music!==nextMusic;music=nextMusic;effects=nextEffects;if(changed||!music&&!effects)stopMusic();if(music||effects)start()}
  function effect(){if(effects&&context?.state==='running'&&!doc.hidden)tone(660,context.currentTime,.09,.025,'triangle')}
  doc.addEventListener('pointerdown',()=>{if(!started)start()},{capture:true});
  doc.addEventListener('click',e=>{if(e.target?.closest?.('button'))effect()},{capture:true});
  doc.addEventListener('visibilitychange',()=>{if(doc.hidden){context?.suspend().catch(()=>{})}else if(started)start()});
  return{set,start,effect,dispose:stopMusic,get music(){return music},get effects(){return effects}};
}
