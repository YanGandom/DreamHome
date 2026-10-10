const fs=require('fs');
const {chromium}=require('C:/Users/asi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const paths=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'];
 const executablePath=paths.find(p=>fs.existsSync(p));console.log('Browser',executablePath);
 for(const u of ['/','/scene.js','/vendor/three.module.js','/vendor/OrbitControls.js','/vendor/RoundedBoxGeometry.js','/vendor/BufferGeometryUtils.js']){try{const r=await fetch('http://127.0.0.1:4173'+u);console.log(r.status,u,(await r.text()).slice(0,80))}catch(e){console.log('HTTP ERROR',e.message)}}
 const browser=await chromium.launch({headless:true,executablePath});
 try{const page=await browser.newPage({viewport:{width:1600,height:1100}});
 page.on('pageerror',e=>console.log('PAGE ERROR',e.stack));page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')console.log('CONSOLE',m.type(),m.text())});page.on('requestfailed',r=>console.log('REQUEST FAILED',r.url(),r.failure()));
 await page.goto('http://127.0.0.1:4173',{waitUntil:'networkidle'});await page.waitForTimeout(5000);
 console.log('STATE',await page.evaluate(()=>({ready:window.__sceneReady,loading:document.querySelector('#loading-text')?.textContent,body:document.body.innerText.slice(0,300)})));
 await page.screenshot({path:__dirname+'/diagnosis.png'});
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
