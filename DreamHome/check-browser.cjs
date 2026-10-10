const {chromium}=require('C:/Users/asi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
(async()=>{
  const executablePath=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p=>fs.existsSync(p));
  const browser=await chromium.launch({executablePath,headless:true,args:['--disable-gpu-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const errors=[];const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto('http://127.0.0.1:4173/?v=20261010-homestead-13');await page.waitForFunction(()=>window.__sceneReady||window.__sceneError,{timeout:45000});
    if(await page.evaluate(()=>window.__sceneError))throw Error(await page.evaluate(()=>window.__sceneError));
    await page.waitForTimeout(1000);
    for(const [name,width,height]of [['desktop',1440,1000],['mobile',390,844],['small',320,640],['landscape',844,390]]){
      await page.setViewportSize({width,height});await page.waitForTimeout(500);
      const layout=await page.evaluate(()=>{const ids=['scene','editor-panel','library-list','scene-menu-toggle'];return{viewport:[innerWidth,innerHeight],overflow:document.documentElement.scrollWidth>innerWidth,rects:Object.fromEntries(ids.map(id=>{const r=document.getElementById(id).getBoundingClientRect();return[id,{x:r.x,y:r.y,w:r.width,h:r.height}]})),canvas:[__winterScene.renderer.domElement.width,__winterScene.renderer.domElement.height],cards:document.querySelectorAll('.model-preview[src]').length}});
      if(layout.overflow)throw Error('Horizontal page overflow: '+name);
      if(layout.rects.scene.h<140||layout.rects['library-list'].h<55)throw Error('Insufficient editing space: '+name);
      console.log(name,JSON.stringify(layout));await page.screenshot({path:'preview-'+name+'.png'});
    }
    if(errors.length)throw Error(errors.join('\n'));
  }finally{await browser.close()}
})().catch(e=>{console.error(e.message);process.exitCode=1});
