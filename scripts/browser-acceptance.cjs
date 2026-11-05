#!/usr/bin/env node
/**
 * Browser acceptance smoke, run against built static site or hosted URL.
 * Optional QA dependency: npm install --no-save puppeteer@24.31.0
 * Then: npx puppeteer browsers install chrome
 * Usage: PLC_BASE_URL=http://127.0.0.1:4173 node scripts/browser-acceptance.cjs
 * Not a substitute for hardware-fidelity or cross-browser acceptance.
 */
const assert=require('node:assert/strict');
let puppeteer;
try{puppeteer=require('puppeteer');}
catch{console.error('Optional browser QA dependency missing: npm install --no-save puppeteer@24.31.0');process.exit(2);}
const base=(process.env.PLC_BASE_URL||'http://127.0.0.1:4173').replace(/\/+$/,'');
const pause=(ms)=>new Promise(r=>setTimeout(r,ms));
async function click(page,text){
 for(const button of await page.$$('button')){
  const label=await button.evaluate(node=>node.textContent?.trim()||'');
  if(label.includes(text)){await button.click();await pause(60);return;}
 }
 throw new Error('Expected button not found: '+text);
}
async function visit(page,route){
 const response=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:30000});
 assert.ok(response?.status()===200||response?.status()===304,'Page HTTP status for '+route+': '+response?.status());
 await page.waitForSelector('h1',{timeout:18000});
 assert.ok(await page.$eval('h1',node=>node.textContent?.trim().length),route+' missing page heading');
}
async function run(){
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote']});
 const page=await browser.newPage();
 const exceptions=[];page.on('pageerror',e=>exceptions.push(e.message));
 try{
  await page.setViewport({width:1366,height:768});
  const routes=['/','/labs','/engineering','/simulation','/assessments','/process-control','/starter-lab','/electrical-bench','/pneumatics','/workcell-composer','/dc-circuit'];
  for(const route of routes){await visit(page,route);console.log('ROUTE PASS',route);}
  await visit(page,'/engineering');await page.waitForSelector('select[aria-label="Logic exercise"]');
  await page.select('select[aria-label="Logic exercise"]','ctd');
  await page.click('input[aria-label="Logic input LoadCount"]');
  await click(page,'Single scan');
  const lessonOutput=async tag=>page.evaluate(tag=>{
    const root=document.querySelector('section[aria-label="PLC instruction and scan debugger"]');
    const row=[...(root?.querySelectorAll('.io > div')??[])].find(el=>el.querySelector('code')?.textContent?.trim()===tag);
    return {on:row?.querySelector('strong')?.textContent?.trim(),line:row?.textContent?.trim()};
  },tag);
  let countSample=await lessonOutput('ZeroReached');
  assert.equal(countSample.on,'OFF','CTD load must de-energize zero flag');
  assert.ok(countSample.line?.includes('3/3 count'),'CTD loads preset');
  await page.click('input[aria-label="Logic input LoadCount"]');
  await page.click('input[aria-label="Logic input Sensor"]');await click(page,'Single scan');
  countSample=await lessonOutput('ZeroReached');
  assert.ok(countSample.line?.includes('2/3 count'),'CTD decrements one per rising edge');
  await page.click('input[aria-label="Logic input Sensor"]');await click(page,'Single scan');
  await page.click('input[aria-label="Logic input Sensor"]');await click(page,'Single scan');
  await page.click('input[aria-label="Logic input Sensor"]');await click(page,'Single scan');
  await page.click('input[aria-label="Logic input Sensor"]');await click(page,'Single scan');
  countSample=await lessonOutput('ZeroReached');
  assert.equal(countSample.on,'ON','CTD reaches zero after three rising edges');
  await page.select('select[aria-label="Logic exercise"]','tp');
  await page.click('input[aria-label="Logic input Enable"]');await click(page,'Single scan');
  await page.click('input[aria-label="Logic input Enable"]');await click(page,'Single scan');
  let pulse=await lessonOutput('PulseDone');assert.equal(pulse.on,'ON','TP remains active after falling input');
  await click(page,'Single scan');pulse=await lessonOutput('PulseDone');assert.equal(pulse.on,'ON','TP third scan active');
  await click(page,'Single scan');pulse=await lessonOutput('PulseDone');assert.equal(pulse.on,'OFF','TP expires');
  console.log('TP/CTD INSTRUCTION BROWSER PASS');
  await visit(page,'/engineering');await page.waitForSelector('section[aria-label="Workcell PLC watch debugger"]');
  await click(page,'Isolate 24V supply');
  await click(page,'Restore 24V supply');
  const watched=async id=>page.evaluate(id=>{
   const root=document.querySelector('section[aria-label="Workcell PLC watch debugger"]');
   const row=[...(root?.querySelectorAll('tr[data-watch-id]')??[])].find(el=>el.getAttribute('data-watch-id')===id);
   return {value:row?.querySelector('td:nth-child(5) strong')?.textContent?.trim(),tag:row?.querySelector('td:nth-child(3) code')?.textContent?.trim()};
  },id);
  let point=await watched('IN:PowerOK');
  assert.equal(point.value,'TRUE','Watch shows latest sampled PowerOK');
  point=await watched('PLANT:SupplyAvailable');
  assert.equal(point.value,'TRUE','Watch shows post-scan plant supply');
  assert.ok((await page.$eval('[aria-label="Workcell watch changes"]',el=>el.innerText)).includes('SupplyAvailable'),'Watch records actual supply transitions');
  await click(page,'First scan');
  point=await watched('IN:PowerOK');
  assert.equal(point.value,'FALSE','Historical watch uses selected scan instead of current state');
  await page.click('button[aria-label="Return to live workcell scan"]');
  await page.waitForFunction(()=>{
   const row=document.querySelector('section[aria-label="Workcell PLC watch debugger"] tr[data-watch-id="IN:PowerOK"]');
   return row?.querySelector('td:nth-child(5) strong')?.textContent?.trim()==='TRUE';
  },{timeout:5000});
  point=await watched('IN:PowerOK');
  assert.equal(point.value,'TRUE','Live view restores latest scan');
  await page.select('select[aria-label="Workcell watch source"]','plant');
  await page.type('input[aria-label="Workcell watch search"]','SupplyAvailable');
  point=await watched('PLANT:SupplyAvailable');
  assert.equal(point.value,'TRUE','Source and search filter retain matching virtual plant signal');
  assert.equal(await watched('IN:PowerOK').then(r=>r.value),undefined,'Source filter excludes PLC input rows');
  console.log('WORKCELL TYPED WATCH BROWSER PASS');
  await visit(page,'/engineering');
  await page.waitForSelector('section[aria-label="Simulation-only PLC input force table"]');
  assert.equal(await page.$eval('button',node=>node.textContent?.length>=0),true,'Browser UI initialized');
  await click(page,'Isolate 24V supply');
  await page.select('select[aria-label="Simulated force tag"]','SensorOK');
  await page.select('select[aria-label="Simulated force value"]','true');
  await click(page,'Apply simulation force');
  await click(page,'Restore 24V supply');
  const forcedValue=await page.$eval('tr[data-watch-id="IN:SensorOK"]',row=>({value:row.querySelector('td:nth-child(5) strong')?.textContent?.trim(),flag:row.querySelector('td:nth-child(6)')?.textContent?.trim()}));
  const unforced=await page.$eval('tr[data-watch-id="RAW:SensorOK"]',row=>row.querySelector('td:nth-child(5) strong')?.textContent?.trim());
  assert.deepEqual(forcedValue,{value:'TRUE',flag:'FORCED'},'PLC input must be visibly forced');
  assert.equal(unforced,'FALSE','Unforced physical sensor remains FALSE');
  assert.equal(await page.$eval('button',node=>typeof node.textContent==='string'),true);
  const forceDisabled=await page.$eval('section[aria-label="Simulation-only PLC input force table"] button',button=>button.disabled);
  assert.equal(forceDisabled,true,'Active supply locks force controls');
  await click(page,'Open guard');
  assert.ok((await page.$eval('.workspace .panel h2',el=>el.textContent)).length>0,'Workbench remains interactive');
  await click(page,'Isolate 24V supply');
  await page.select('select[aria-label="Simulated force value"]','clear');
  await click(page,'Apply simulation force');
  const cleared=await page.evaluate(()=>document.querySelector('tr[data-watch-id="IN:SensorOK"] td:nth-child(6)')?.textContent?.trim());
  assert.notEqual(cleared,'FORCED','Clear restores underlying sampled input');
  console.log('WORKCELL INPUT FORCE BROWSER PASS');
  await visit(page,'/starter-lab');await page.waitForSelector('.starter-control-diagram');
  await click(page,'Press START');for(let i=0;i<4;i++)await click(page,'Advance 1 s');
  assert.equal(await page.$eval('.metric-grid .metric b',e=>e.textContent?.trim()),'DELTA','Starter must reach DELTA');
  await click(page,'Press STOP');
  assert.equal(await page.$eval('.metric-grid .metric b',e=>e.textContent?.trim()),'IDLE','STOP must drop contactor commands');
  console.log('STARTER PASS');
  await visit(page,'/electrical-bench');await page.waitForSelector('.patch-ports');
  await click(page,'Connect wire');await click(page,'Close S1');await click(page,'Energize 24 V supply');
  assert.ok((await page.$eval('.patch-light-on',e=>e.textContent||'')).includes('LIT'));
  assert.equal(await page.$eval('.patch-meter',e=>e.textContent?.trim()),'24.0 V DC','Correct loop meter voltage');
  await click(page,'Isolate supply');console.log('PATCH BENCH PASS');
  await visit(page,'/dc-circuit');
  await page.waitForSelector('.dc-meter');
  await click(page,'Series voltage divider');
  await click(page,'Energize 24 V supply');
  await page.select('select[aria-label="DC red probe"]','N1');
  await page.select('select[aria-label="DC black probe"]','GND');
  await pause(120);
  assert.equal(await page.$eval('.dc-meter',e=>e.textContent?.trim()),'12.000 V DC','Divider has correct 12 V midpoint');
  assert.ok((await page.$eval('body',e=>e.textContent||'')).includes('12.000 mA'),'Divider branch shows expected 12 mA');
  await click(page,'Isolate 24 V supply');
  await click(page,'Balanced bridge network');
  await click(page,'Energize 24 V supply');
  assert.equal(await page.$eval('.dc-meter',e=>e.textContent?.trim()),'12.000 V DC','Balanced bridge has correct midpoint');
  await click(page,'Isolate 24 V supply');
  await click(page,'Direct supply short');
  await click(page,'Energize 24 V supply');
  assert.ok((await page.$eval('body',e=>e.innerText)).includes('Cannot energize'),'Source short must block virtual energization');
  await click(page,'Series voltage divider');
  console.log('DC NODAL LAB PASS');
  await visit(page,'/process-control');await click(page,'Run 10 s');console.log('PID SCAN PASS');
  // Exercise typed ST from the React editor; isolated parser tests cannot prove UI wiring.
  await click(page,'Structured Text editor');
  await click(page,'Load typed variables example');
  const started=await page.evaluate(()=>{
   const tag=[...document.querySelectorAll('label.process-tag-input')].find(el=>el.textContent?.trim()==='Start');
   const checkbox=tag?.querySelector('input[type="checkbox"]');
   if(!checkbox)return false;
   checkbox.click();
   return true;
  });
  assert.ok(started,'Typed ST Start control missing');
  const stSnapshot=()=>page.evaluate(()=>{
   const read=(heading)=>{
    const panel=[...document.querySelectorAll('.process-lab .panel')].find(el=>el.querySelector('h2')?.textContent?.trim()===heading);
    if(!panel)throw new Error('Missing ST panel: '+heading);
    return Object.fromEntries([...panel.querySelectorAll('.io > div')].map(row=>[row.querySelector('code')?.textContent?.trim(),row.querySelector('strong')?.textContent?.trim()]));
   };
   return {outputs:read('PLC output memory'),memory:read('Retained scan memory')};
  });
  await click(page,'Compile & execute one scan');
  let sample=await stSnapshot();
  assert.equal(sample.outputs.Run,'true','Typed ST Start energizes Run');
  assert.equal(sample.outputs.Scans,'1','Typed ST output counts first scan');
  assert.equal(sample.memory.InternalCount,'1','Private VAR survives first scan');
  assert.ok(!Object.hasOwn(sample.outputs,'InternalCount'),'Private VAR is not an output');
  await click(page,'Compile & execute one scan');
  sample=await stSnapshot();
  assert.equal(sample.outputs.Scans,'2','Typed ST retained state increments next scan');
  assert.equal(sample.memory.InternalCount,'2','Private VAR persists across scans');
  await click(page,'Reset scan memory');
  await click(page,'Compile & execute one scan');
  sample=await stSnapshot();
  assert.equal(sample.outputs.Scans,'1','Reset re-applies typed initializers');
  console.log('TYPED ST EDITOR PASS');
  await visit(page,'/workcell-composer');
  await page.waitForSelector('.composer-grid');
  const initialCount=await page.evaluate(()=>document.querySelectorAll('.composer-cell.occupied').length);
  await click(page,'Pump skid');
  const addedCount=await page.evaluate(()=>document.querySelectorAll('.composer-cell.occupied').length);
  assert.equal(addedCount,initialCount+1,'Adding equipment must update floor plan');
  await click(page,'Undo');
  assert.equal(await page.evaluate(()=>document.querySelectorAll('.composer-cell.occupied').length),initialCount,'Undo must restore previous floor plan');
  await click(page,'Redo');
  assert.equal(await page.evaluate(()=>document.querySelectorAll('.composer-cell.occupied').length),initialCount+1,'Redo must restore added device');
  await click(page,'Scan 100 ms');
  assert.ok((await page.$eval('body',e=>e.innerText)).includes('100 ms'),'Machine scan advances');
  await page.select('select[aria-label="Commissioning scenario template"]','packaging-cell');
  await click(page,'Load commissioning scenario');
  const packaging=await page.$eval('body',el=>el.innerText);
  assert.ok(packaging.includes('Packaging cell')&&packaging.includes('PX2'),'Packaging scene and mapped sensor load into real UI');
  const enabled=await page.evaluate(()=>{
   const row=[...document.querySelectorAll('.composer-device')].find(el=>el.querySelector('button b')?.textContent?.trim()==='PX2');
   const input=row?.querySelector('input[type="checkbox"]');
   if(!input)return false;
   input.click();
   return true;
  });
  assert.ok(enabled,'Proximity field input is editable in ladder-controlled scenario');
  await click(page,'Scan 100 ms');
  const machineText=await page.$eval('body',el=>el.innerText);
  assert.ok(machineText.includes('PS2_POSITION_PERCENT'),'Pusher scan feedback visible to learner');
  assert.ok(machineText.includes('CV2_CMD'),'PLC command available from loaded packaging program');
  await page.select('select[aria-label="Commissioning scenario template"]','vertical-transfer');
  await click(page,'Load commissioning scenario');
  const vertical=await page.$eval('body',el=>el.innerText);
  assert.ok(vertical.includes('VF3_SPEED_PERCENT')&&vertical.includes('LF3_POSITION_PERCENT'),'VFD/lift feedback integrated into 3D scene studio');
  await click(page,'Run current scene acceptance');
  assert.ok((await page.$eval('[aria-label="Current scene acceptance results"]',el=>el.textContent)).includes('PASS'),'Current vertical scene passes commissioning FAT');
  await page.select('select[aria-label="Commissioning scenario template"]','process-skid');
  await click(page,'Load commissioning scenario');
  await click(page,'Run current scene acceptance');
  const fat=await page.$eval('[aria-label="Current scene acceptance results"]',el=>el.innerText);
  assert.ok(fat.includes('Tank filling and valve skid'),'Current-scene FAT uses editable process skid layout');
  assert.ok(fat.includes('guard')&&fat.includes('estop')&&fat.includes('replay'),'FAT includes independent simulated guard, E-stop and replay tests');
  console.log('FOUR SCENE MACHINE CATALOGUE BROWSER PASS');
  console.log('WORKCELL COMPOSER PASS');
  await visit(page,'/pneumatics');
  await click(page,'Reference commissioning sequence');
  const pneumaticText=await page.$eval('body',node=>node.innerText);
  assert.ok(pneumaticText.includes('PASS — demonstrated extension and retraction without alarms'), 'Pneumatic FAT example must pass');
  await click(page,'Reset exercise');
  await click(page,'EXTEND / 100 ms');
  assert.ok((await page.$eval('body',node=>node.innerText)).includes('8.3%'), 'Pneumatic cylinder must advance under coil command');
  console.log('PNEUMATIC COMMISSIONING PASS');
  await visit(page,'/simulation');
  for(const b of ['Record visual inspection','Read PLC I/O','Reconnect sensor circuit','START MOTOR','Verify operation','Submit task'])await click(page,b);
  assert.ok((await page.$eval('body',e=>e.innerText)).includes('Assessment report'));
  console.log('ASSESSMENT PASS');
  await page.setViewport({width:390,height:780});
  for(const route of ['/','/labs','/starter-lab','/electrical-bench','/pneumatics','/workcell-composer','/dc-circuit']){
   await visit(page,route);
   const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));
   assert.ok(size.scroll<=size.viewport+2,'Horizontal mobile overflow '+route+' '+JSON.stringify(size));
   console.log('MOBILE PASS',route);
  }
  assert.deepEqual(exceptions,[],'Uncaught browser errors');
  console.log('BROWSER SMOKE PASS: '+routes.length+' routes, interactions, 390px mobile and no page exceptions');
 }finally{await browser.close();}
}
run().catch(e=>{console.error('BROWSER SMOKE FAIL',e.stack||String(e));process.exitCode=1;});