#!/usr/bin/env node
/** Headless CPU-constrained smoke; NOT an 8 GB Windows or physical GPU benchmark.
 * Verifies optional WebGL failure does not block the virtual device controls.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const base=(process.env.PLC_BASE_URL||'http://127.0.0.1:4173').replace(/\/+$/,'');
async function run(){
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-gpu','--disable-webgl','--disable-dev-shm-usage']});
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.evaluateOnNewDocument(()=>{
   const original=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(type,...args){
    if(type==='webgl'||type==='webgl2'||type==='experimental-webgl')return null;
    return original.call(this,type,...args);
   };
  });
  const session=await page.target().createCDPSession();
  await session.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.goto(base+'/',{waitUntil:'networkidle2',timeout:45000});
  await page.waitForSelector('h1');
  const loaded=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>e.name));
  assert.ok(!loaded.some(u=>/(?:OrbitControls|SceneShell|Sandbox3D)-[\w-]+\.js/.test(u)),'3D renderer must not load on landing page');
  console.log('LOW-SPEC LANDING PASS: 3D code lazy-loaded, CPU throttling enabled');
  await page.goto(base+'/workcell-composer',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForSelector('.composer-grid',{timeout:20000});
  const fallback=await page.$eval('.graphics-fallback',x=>x.textContent||'');
  assert.ok(fallback.includes('3D rendering is unavailable'),'WebGL fallback must render');
  const disabled=await page.$eval('.graphics-toggle',x=>x.disabled);
  assert.equal(disabled,true,'3D toggle disabled without WebGL');
  const before=await page.evaluate(()=>document.querySelectorAll('.composer-cell.occupied').length);
  await page.evaluate(()=>{
   const b=[...document.querySelectorAll('button')].find(x=>x.textContent?.includes('Pump skid'));
   if(!b)throw Error('Pump control missing');b.click();
  });
  await new Promise(r=>setTimeout(r,100));
  const after=await page.evaluate(()=>document.querySelectorAll('.composer-cell.occupied').length);
  assert.equal(after,before+1,'Grid editing must work without GPU');
  await page.evaluate(()=>{
   const b=[...document.querySelectorAll('button')].find(x=>x.textContent?.includes('Scan 100 ms'));
   if(!b)throw Error('Scan button missing');b.click();
  });
  await new Promise(r=>setTimeout(r,100));
  const status=await page.$eval('body',e=>e.innerText);
  assert.ok(status.includes('Executed 1 deterministic manual scan'),'PLC teaching scan must work without GPU');

  await page.goto(base+'/sandbox',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForSelector('.sandbox-3d-fallback',{timeout:20000});
  const message=await page.$eval('.sandbox-3d-fallback',el=>el.textContent||'');
  assert.ok(message.includes('3D renderer unavailable'),'Open sandbox must clearly disclose no-WebGL mode');
  const add=await page.evaluate(()=>{
    const button=[...document.querySelectorAll('button')].find(b=>b.textContent?.trim()==='Place starter layout');
    if(!button) return false; button.click(); return true;
  });
  assert.ok(add,'No-WebGL sandbox layout must remain available');
  await page.waitForFunction(()=>document.querySelectorAll('.sandbox-patch .sandbox-device').length===6);
  assert.ok(await page.$('[data-terminal-id="plc-2.I0.0"]'),'Patching terminals remain accessible without graphics');
  const beforeTick=await page.$eval('.sandbox-scan',el=>Number(el.textContent?.replace(/\D/g,'')));
  await page.evaluate(()=>{
    const button=[...document.querySelectorAll('.sandbox-toolbar button')].find(b=>b.textContent?.trim()==='Step scan');
    if(!button)throw Error('Step scan missing without WebGL'); button.click();
  });
  await page.waitForFunction(n=>Number(document.querySelector('.sandbox-scan')?.textContent.replace(/\D/g,''))>n,{},beforeTick);
  console.log('OPEN SANDBOX NO-WEBGL PASS: component controls, terminal patching and PLC scan remain usable');
  assert.deepEqual(errors,[],'No uncaught page errors in no-WebGL flow');
  console.log('LOW-SPEC CPU-ONLY FALLBACK PASS: 4x CPU throttling, optional WebGL disabled, editing and scan remain usable');
 }finally{await browser.close();}
}
run().catch(e=>{console.error('LOW-SPEC FALLBACK FAIL',e.stack||String(e));process.exitCode=1;});
