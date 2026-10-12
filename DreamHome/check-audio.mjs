import assert from 'node:assert/strict';
import {createGameAudio} from './game-audio.js';
const contexts=[],events={},doc={hidden:false,addEventListener:(type,fn)=>events[type]=fn};
class Audio{constructor(){this.state='suspended';this.currentTime=0;this.destination={};this.tones=[];contexts.push(this)}resume(){this.state='running';return Promise.resolve()}suspend(){this.state='suspended';return Promise.resolve()}close(){this.state='closed';return Promise.resolve()}createOscillator(){const oscillator={frequency:{value:0},connect(){},disconnect(){},start:time=>this.tones.push({time,frequency:oscillator.frequency.value}),stop(){}};return oscillator}createGain(){return{gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}}}}
const original=globalThis.AudioContext;globalThis.AudioContext=Audio;
const audio=createGameAudio({doc});
try{
 assert.equal(contexts.length,0,'no autoplay before interaction');await audio.start();assert.ok(contexts[0].tones.length>=2,'music creates actual notes');let count=contexts[0].tones.length;audio.effect();assert.equal(contexts[0].tones.length,count+1);
 audio.set(true,false);await Promise.resolve();count=contexts[0].tones.length;audio.effect();assert.equal(contexts[0].tones.length,count,'sound toggle mutes effects independently');
 audio.set(false,true);await Promise.resolve();assert.equal(contexts[0].state,'closed');assert.equal(contexts.at(-1).tones.length,0,'music toggle silences music');audio.effect();assert.equal(contexts.at(-1).tones.length,1);
 doc.hidden=true;events.visibilitychange();assert.equal(contexts.at(-1).state,'suspended');doc.hidden=false;events.visibilitychange();await Promise.resolve();assert.equal(contexts.at(-1).state,'running');
 audio.set(false,false);assert.equal(contexts.at(-1).state,'closed');audio.set(true,true);await Promise.resolve();assert.ok(contexts.at(-1).tones.length>=2,'music restarts immediately after toggling');
 console.log(JSON.stringify({passed:1,scope:'Web Audio scheduling, independent switches, visibility pause and resume; simulated audio context'}));
}finally{audio.dispose();globalThis.AudioContext=original}
