const {chromium}=require('playwright');
const fs=require('fs'),assert=require('assert/strict');
(async()=>{
 const executablePath=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
 const browser=await chromium.launch({executablePath,headless:true,args:['--disable-gpu-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/?v=settings-test');await page.waitForFunction(()=>window.__winterScene?.game||window.__sceneError,null,{timeout:45000});assert.equal(await page.evaluate(()=>window.__sceneError),undefined);
  const click=id=>page.evaluate(id=>document.getElementById(id).click(),id);
  await click('dream-start');await click('mode-level');assert.equal(await page.evaluate(()=>document.getElementById('level-picker').hidden),true);assert.equal(await page.evaluate(()=>document.getElementById('level-brief').hidden),false);
  await page.screenshot({path:'settings-brief-mobile.png'});await click('level-brief-close');await click('settings-toggle');
  for(const lang of ['en','es','fr','zh']){
   await page.evaluate(lang=>{const select=document.getElementById('settings-language');select.value=lang;select.dispatchEvent(new Event('change',{bubbles:true}))},lang);
   await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>document.documentElement.lang),lang==='zh'?'zh-CN':lang);
   if(lang!=='zh')assert.equal(await page.evaluate(()=>/[\u3400-\u9fff]/.test([...document.querySelectorAll('#settings-panel label,#settings-panel button,#settings-panel h2,#settings-panel p')].map(n=>n.textContent).join(''))),false);
  }
  await click('settings-music');await click('settings-effects');
  const code=value=>page.evaluate(value=>{document.getElementById('settings-code').value=value;document.getElementById('settings-code-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))},value);
  await code('Asi');assert.equal(await page.evaluate(()=>__winterScene.game.progression.allLevelsAvailable()),true);await click('settings-close');await click('mode-level');assert.equal(await page.evaluate(()=>document.getElementById('level-picker').hidden),false);await click('level-picker-close');await click('settings-toggle');await code('AsiDesign');
  assert.equal(await page.evaluate(()=>document.getElementById('design-panel').hidden),false);await page.screenshot({path:'settings-design-mobile.png'});
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)}
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,scope:'Headless WebGL browser, DOM events, four locales, mobile and desktop widths'}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
