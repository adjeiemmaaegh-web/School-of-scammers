/**
 * P2 source-only browser acceptance recipe for the integration developer.
 * A learner uses the actual sandbox UI and PLC worker, not a mock engine:
 * pre-wired motor panel -> activate/edit FBD -> run -> stop -> reopen.
 * NOT included in CI automatically; developer owns execution and signoff.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const base=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const key='efo-open-sandbox-project-v1';
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--enable-webgl',
   '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 const click=async(label)=>{
   const ok=await page.evaluate(text=>{
     const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===text);
     if(!b||b.disabled)return false;b.click();return true;
   },label);
   assert.ok(ok,'Available button: '+label);
 };
 const status=(id,value)=>page.waitForFunction((target,want)=>
   document.querySelector('[data-device-id="'+target+'"] .sandbox-device-status')?.textContent.trim()===want,
   {timeout:12000},id,value);
 const mode=(label)=>page.waitForFunction(value=>
   [...document.querySelectorAll('.sandbox-language-tabs button')].some(b=>b.textContent.trim()===value&&b.getAttribute('aria-pressed')==='true'),
   {timeout:10000},label);
 try{
   await page.setViewport({width:1440,height:940,deviceScaleFactor:1});
   await page.goto(base+'/sandbox',{waitUntil:'networkidle0',timeout:20000});
   await page.evaluate(()=>localStorage.clear());
   await page.reload({waitUntil:'networkidle0'});
   await page.waitForSelector('[data-starters]');
   await page.click('[data-starters] > summary');
   await page.waitForSelector('[data-add-panel]',{visible:true});
   await page.click('[data-add-panel]');
   await page.waitForFunction(()=>document.querySelectorAll('.sandbox-device').length===6);
   await page.waitForFunction(()=>document.querySelectorAll('.sandbox-wire-list > div').length===11);
   await click('Function Blocks (FBD)');
   await mode('Function Blocks (FBD)');
   await page.waitForFunction(()=>document.querySelector('.sandbox-fbd-validation strong')?.textContent==='Compiler OK');
   // A real authored change, not a fixed example slideshow. Change an FBD block's layout.
   await page.$eval('input[aria-label="FBD layout x latch"]',input=>{
     const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
     setter.call(input,'320');input.dispatchEvent(new Event('input',{bubbles:true}));
   });
   await page.waitForFunction(()=>[...document.querySelectorAll('.sandbox-fbd-editor button')]
     .some(b=>b.textContent.trim()==='Compile & activate FBD'&&!b.disabled));
   await click('Compile & activate FBD');
   await page.waitForFunction(id=>{
     const saved=JSON.parse(localStorage.getItem(id)||'null');
     return saved?.language==='fbd'&&saved?.fbd?.nodes?.find(n=>n.id==='latch')?.x===320;
   },{timeout:12000},key);

   await click('▶ Run');
   await page.waitForFunction(()=>[...document.querySelectorAll('.sandbox-toolbar button')]
     .some(b=>b.textContent.trim()==='Pause'),{timeout:12000});
   await page.click('[data-device-id="start-1"] .sandbox-operate');
   await status('motor-1','RUNNING');
   await page.click('[data-device-id="start-1"] .sandbox-operate');
   await page.waitForFunction(()=>[...document.querySelectorAll('.sandbox-fbd-block legend')]
     .some(n=>n.textContent.includes('coil')&&n.textContent.includes('TRUE')),{timeout:8000});
   await page.click('[data-device-id="stop-1"] .sandbox-operate');
   await status('motor-1','STOPPED');
   await click('Pause');
   await page.waitForFunction(()=>[...document.querySelectorAll('.sandbox-toolbar button')]
     .some(b=>b.textContent.trim()==='▶ Run'),{timeout:10000});
   await page.reload({waitUntil:'networkidle0'});
   await mode('Function Blocks (FBD)');
   const doc=await page.evaluate(id=>JSON.parse(localStorage.getItem(id)||'null'),key);
   assert.equal(doc.language,'fbd');
   assert.equal(doc.fbd.nodes.find(n=>n.id==='latch').x,320);
   assert.equal(new Set(doc.fbd.nodes.map(n=>n.id)).size,doc.fbd.nodes.length);
   assert.deepEqual(errors.filter(e=>!/WebGL|favicon|GPU stall/i.test(e)),[]);
   console.log('P2 FBD SOURCE ACCEPTANCE PASS: real FBD edit, wire-level motor latch, stop, persistence');
 }finally{await browser.close();}
})().catch(error=>{console.error('P2 FBD SOURCE ACCEPTANCE FAIL',error.stack||String(error));process.exitCode=1;});
