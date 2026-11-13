/**
 * P14 real Chromium -> worker -> original BOTTLE process acceptance:
 * loaded 21-scene gallery has a never-prewired cylinder-bottle line;
 * an edited PLC16 program + genuine 24V electrical Q loads causes actual
 * feeder cylinder -> moving physical belt -> measured 500 ml fill -> cap
 * only after filling. No body/signal is manufactured in the test script.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const BASE=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const KEY='efo-open-sandbox-project-v1';
const program=logic=>[
 'VAR_INPUT',' In0 : BOOL;',' In1 : BOOL;',' In2 : BOOL;',' In3 : BOOL;',
 'END_VAR','VAR_OUTPUT',' Out0 : BOOL;',' Out1 : BOOL;',
 ' Out2 : BOOL;',' Out3 : BOOL;','END_VAR',logic,
].join('\n');
const links=[
 ['scene-supply.P24','scene-plc.L+'],
 ['scene-supply.M0','scene-plc.M'],
 ['scene-plc.Q0.0','feeder.CMD_feed+'],
 ['scene-supply.M0','feeder.M-'],
 ['scene-plc.Q0.1','belt.CMD_run+'],
 ['scene-supply.M0','belt.M-'],
 ['scene-plc.Q0.2','filler.CMD_fill+'],
 ['scene-supply.M0','filler.M-'],
 ['scene-plc.Q0.3','capper.CMD_cap+'],
 ['scene-supply.M0','capper.M-'],
].map(([from,to],i)=>({id:'p14-w'+(i+1),from,to}));
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:[
  '--no-sandbox','--disable-setuid-sandbox','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
 ]});
 const page=await browser.newPage(),errors=[],consoleErrors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text());});
 const state=()=>page.$eval('[data-p12-matrix]',e=>e.dataset.p12State);
 const doRun=async(expected)=>{
  await page.$eval('[data-p12-matrix]',el=>{el.open=true;});
  assert.equal(await page.$eval('[data-p12-run-matrix]',b=>b.disabled),false);
  await page.click('[data-p12-run-matrix]');
  try{
   await page.waitForFunction(()=>['passed','failed'].includes(
    document.querySelector('[data-p12-matrix]')?.dataset.p12State)||
    !!document.querySelector('[data-p12-error]'),{timeout:90000});
  }catch(e){
   const debug=await page.evaluate(()=>({
    state:document.querySelector('[data-p12-matrix]')?.dataset.p12State,
    error:document.querySelector('[data-p12-error]')?.textContent,
    preflight:document.querySelector('[data-p12-preflight]')?.textContent,
    result:document.querySelector('[data-p12-matrix-result]')?.textContent?.slice(0,2400),
   }));
   throw Error('P14 genuine material worker timeout: '+JSON.stringify({
    debug,errors,consoleErrors,cause:String(e)}));
  }
  const current=await state();
  if(current!==expected){
   const detail=await page.$eval('[data-p12-matrix]',x=>x.textContent.slice(-3800));
   throw Error('Expected '+expected+', got '+current+': '+detail);
  }
 };
 try{
  await page.setViewport({width:1440,height:950,deviceScaleFactor:1});
  await page.goto(BASE+'/sandbox',{waitUntil:'networkidle0',timeout:45000});
  await page.evaluate(()=>localStorage.clear());
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p9-scene-gallery]',{timeout:20000});
  await page.$eval('[data-p9-scene-gallery]',el=>{el.open=true;});
  await page.click('[data-load-plant-scene="bottle-line"]');
  await page.waitForSelector('[data-p12-matrix][data-p12-scene-id="bottle-line"]',
   {timeout:20000});
  assert.equal(await state(),'setup');
  assert.equal(await page.$eval('[data-p12-run-matrix]',el=>el.disabled),true,
   'A default unopened bottle factory must never self-grade');
  const setup=await page.evaluate((key,patches,st)=>{
   const p=JSON.parse(localStorage.getItem(key));
   p.wires=patches;p.language='st';p.stSource=st;
   localStorage.setItem(key,JSON.stringify(p));
   return {shape:p.params?.feeder?.shapeMode,cap:p.params?.capper?.requiresFilled};
  },KEY,links,program('Out0 := In0; Out1 := In1; Out2 := In2; Out3 := In3;'));
  assert.deepEqual(setup,{shape:1,cap:1},
   'Physical bottle and fill-before-cap settings must originate in the real source scene');
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p12-matrix][data-p12-scene-id="bottle-line"]',{timeout:20000});
  await doRun('passed');
  const actual=await page.$$eval('[data-p12-case]',elements=>elements.map(e=>({
   name:e.dataset.p12Case,pass:e.dataset.p12CaseState,detail:e.textContent,
  })));
  assert.deepEqual(actual.map(x=>[x.name,x.pass]),[
   ['idle','pass'],['demand','pass'],['release','pass'],
   ['fault-recovery','pass'],
  ]);
  assert.ok(actual.every(c=>/simulated at \d+ ms/.test(c.detail)));
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
  assert.equal(saved.wires.length,10);
  assert.equal(saved.components.some(c=>c.id.startsWith('p14-trial-')),false);
  assert.equal(JSON.stringify(saved).includes('sourceSignature'),false);
  await page.evaluate((key,st)=>{
   const p=JSON.parse(localStorage.getItem(key));
   p.stSource=st;localStorage.setItem(key,JSON.stringify(p));
  },KEY,program('Out0 := TRUE; Out1 := TRUE; Out2 := TRUE; Out3 := TRUE;'));
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p12-matrix]',{timeout:20000});
  assert.equal(await state(),'setup','Passing verdict must never survive edit or browser reload');
  await doRun('failed');
  assert.equal(await page.$eval('[data-p12-case="idle"]',
   e=>e.dataset.p12CaseState),'fail','Always-on material feeder cannot pass idle test');
  assert.deepEqual(errors.filter(e=>!/WebGL|GPU stall|favicon|swiftshader/i.test(e)),[]);
  console.log('P14 PHYSICAL BOTTLE BROWSER PASS: real PLC feeder cylinder, moving belt, measured fill, interlocked cap, fault repair, always-on rejection and no storage pollution');
 }finally{await browser.close();}
})().catch(e=>{console.error('P14 PHYSICAL BOTTLE BROWSER FAIL',e.stack||String(e));process.exitCode=1;});
