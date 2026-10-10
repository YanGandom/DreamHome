// Render the exact Canvas2D texture generators locally, without a browser.
import fs from 'node:fs';
import {createCanvas} from '@napi-rs/canvas';
import * as THREE from './vendor/three.module.js';
import {createFloorSystem} from './floor-system.js';
globalThis.document={createElement:()=>createCanvas(512,512)};
const {styles}=createFloorSystem({parent:new THREE.Group(),specs:[],mergeGeometries:()=>null});
const output=createCanvas(1120,328),ctx=output.getContext('2d');ctx.fillStyle='#f3efe6';ctx.fillRect(0,0,1120,328);
styles.forEach((style,i)=>{ctx.drawImage(style.texture.image,i*280+16,16,248,248);ctx.fillStyle='#35463b';ctx.font='16px sans-serif';ctx.fillText(style.name,i*280+16,300)});
fs.writeFileSync('floor-material-preview.png',output.toBuffer('image/png'));
console.log(JSON.stringify({styles:styles.map(s=>({id:s.id,bytes:s.preview.length})),preview:'floor-material-preview.png'},null,2));
