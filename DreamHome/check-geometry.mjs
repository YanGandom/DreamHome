// CPU-only scene validation: real Three.js geometry, with DOM/renderer stubs.
// This does not launch a browser and does not validate WebGL rendering.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import * as ThreeCore from './vendor/three.module.js';
import {createFurnitureSystem} from './furniture-system.js';
import {createPlacement} from './placement.js';
import {createFloorSystem} from './floor-system.js';
import {createArchitectureSystem} from './architecture-system.js';
import {createBuildingSystem} from './building-system.js';
const threeURL=pathToFileURL(new URL('./vendor/three.module.js',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1')).href;
async function addon(file){const src=fs.readFileSync(new URL('./vendor/'+file,import.meta.url),'utf8').replaceAll("from 'three'",`from '${threeURL}'`);return import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));}
const {RoundedBoxGeometry}=await addon('RoundedBoxGeometry.js');
const {mergeGeometries}=await addon('BufferGeometryUtils.js');
const {OrbitControls}=await addon('OrbitControls.js');
const noop=()=>{};
const ctx=new Proxy({createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop})},{get:(o,k)=>k in o?o[k]:noop,set:(o,k,v)=>(o[k]=v,true)});
const element=()=>({style:{},classList:{add:noop,toggle:noop},appendChild:noop,addEventListener:noop,removeEventListener:noop,getRootNode:()=>({addEventListener:noop,removeEventListener:noop}),clientWidth:1600,clientHeight:1100,setAttribute:noop,getContext:()=>ctx,showModal:noop,close:noop,click:noop});
const elements=new Map();globalThis.document={body:element(),createElement:element,querySelector:s=>{if(!elements.has(s))elements.set(s,element());return elements.get(s)},querySelectorAll:()=>[]};
document.getElementById=id=>document.querySelector('#'+id);
globalThis.innerWidth=1600;globalThis.innerHeight=1100;globalThis.devicePixelRatio=1;globalThis.window={};globalThis.addEventListener=noop;globalThis.requestAnimationFrame=noop;
class Renderer{constructor(){this.domElement=element();this.shadowMap={};this.capabilities={getMaxAnisotropy:()=>8};this.info={render:{triangles:0}}}setPixelRatio(){}setSize(){}render(){}}
const THREE={...ThreeCore,WebGLRenderer:Renderer};
const src=fs.readFileSync(new URL('./scene.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
const createSceneEditor=()=>({update:noop,dragging:false});
new Function('THREE','OrbitControls','RoundedBoxGeometry','mergeGeometries','createFurnitureSystem','createSceneEditor','createPlacement','createFloorSystem','createArchitectureSystem','createSceneMenu','createBuildingSystem',src)(THREE,OrbitControls,RoundedBoxGeometry,mergeGeometries,createFurnitureSystem,createSceneEditor,createPlacement,createFloorSystem,createArchitectureSystem,()=>{},createBuildingSystem);
let vertices=0,invalid=0,meshes=0;
window.__winterScene.scene.traverse(o=>{if(o.isMesh){meshes++;const p=o.geometry.attributes.position;vertices+=p.count;for(const n of p.array)if(!Number.isFinite(n))invalid++}});
console.log(JSON.stringify({ready:window.__sceneReady,meshes,vertices,invalid,...window.__winterScene.stats},null,2));
if(!window.__sceneReady||invalid)process.exitCode=1;
export {OrbitControls};
