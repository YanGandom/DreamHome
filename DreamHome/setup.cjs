const fs=require('fs'),path=require('path');
const sources={
 'three.module.js':'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js',
 'OrbitControls.js':'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/controls/OrbitControls.js',
 'RoundedBoxGeometry.js':'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/geometries/RoundedBoxGeometry.js',
 'BufferGeometryUtils.js':'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/utils/BufferGeometryUtils.js'};
(async()=>{fs.mkdirSync(path.join(__dirname,'vendor'),{recursive:true});for(const [name,url]of Object.entries(sources)){const r=await fetch(url);if(!r.ok)throw Error(r.status+' '+url);const body=await r.text();fs.writeFileSync(path.join(__dirname,'vendor',name),body);console.log(name,body.length)}})().catch(e=>{console.error(e);process.exit(1)});
