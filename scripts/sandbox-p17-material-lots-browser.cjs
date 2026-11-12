/**
 * P17 browser E2E — real unsolved original gallery scene -> authored
 * 24 V/sensor/PLC wiring and source -> private multi-fault assessment Worker.
 * Two distinct workcells prove accessible UI, physical replay controls,
 * source edits invalidating evidence and no private fixture persistence.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const BASE=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const STORAGE='efo-open-sandbox-project-v1';

const robotBody=[
 '0: IF In0 THEN Phase := 1; END_IF;',
 '1: IF Count < 3 THEN Out0 := TRUE; Phase := 2; ELSE Phase := 9; END_IF;',
 '2: IF In1 THEN Lane := In2; Phase := 3; END_IF;',
 '3: Out1 := TRUE; Out3 := Lane; IF In3 THEN Phase := 4; END_IF;',
 '4: Out1 := TRUE; Out2 := TRUE; Out3 := Lane; IF NOT In4 THEN Phase := 5; END_IF;',
 '5: Out1 := TRUE; Out2 := TRUE; Out3 := Lane; IF In4 THEN Phase := 6; END_IF;',
 '6: Out2 := TRUE; Out3 := Lane; IF NOT In3 THEN Phase := 7; END_IF;',
 '7: Out3 := Lane; IF NOT In4 THEN Phase := 8; END_IF;',
 '8: Out3 := Lane; IF In4 THEN Count := Count + 1; Phase := 1; END_IF;',
];
const bottleBody=[
 '0: IF In0 THEN Phase := 1; END_IF;',
 '1: IF Count < 3 THEN Out0 := TRUE; Phase := 2; ELSE Phase := 9; END_IF;',
 '2: Out1 := TRUE; IF In1 THEN Phase := 3; END_IF;',
 '3: Out2 := TRUE; IF In2 THEN Phase := 4; END_IF;',
 '4: Out1 := TRUE; IF In3 THEN Phase := 5; END_IF;',
 '5: Out3 := TRUE; IF In4 THEN Phase := 6; END_IF;',
 '6: Out1 := TRUE; IF In5 THEN Phase := 7; END_IF;',
 '7: Out1 := TRUE; IF NOT In5 THEN Count := Count + 1; Phase := 1; END_IF;',
];
function source(scene){
 const robot=scene==='robot-sort',count=robot?5:6,outputs=robot?6:4;
 return [
  'VAR_INPUT',...Array.from({length:count},(_,i)=>' In'+i+' : BOOL;'),
  'END_VAR','VAR_OUTPUT',...Array.from({length:outputs},(_,i)=>' Out'+i+' : BOOL;'),
  'END_VAR','VAR',' Phase : INT := 0;',' Count : INT := 0;',
  ...(robot?[' Lane : BOOL := FALSE;']:[]),'END_VAR',
  ...Array.from({length:outputs},(_,i)=>'Out'+i+' := FALSE;'),
  ...(robot?['Out3 := Lane;','Out4 := Phase > 0 AND Phase < 9;',
   'Out5 := Phase > 0 AND Phase < 9;']:[]),
  'CASE Phase OF',...(robot?robotBody:bottleBody),
  '9: Out0 := FALSE;','END_CASE;',
 ].join('\n');
}
function wiring(scene){
 const robot=scene==='robot-sort';
 const outputs=robot?[
  ['feeder','feed'],['robot','grip'],['robot','dispatch'],
  ['robot','routeMetal'],['metal-out','run'],['plain-out','run'],
 ]:[
  ['feeder','feed'],['belt','run'],['filler','fill'],['capper','cap'],
 ];
 const inputs=robot?[
  ['pickup','present'],['eye','present'],['robot','partHeld'],
  ['robot','inPosition'],
 ]:[
  ['fill-eye','present'],['filler','filled'],['cap-eye','present'],
  ['capper','capped'],['exit-eye','present'],
 ];
 const paths=[
  ['scene-supply.P24','scene-plc.L+'],
  ['scene-supply.M0','scene-plc.M'],
 ];
 outputs.forEach(([id,channel],i)=>{
  paths.push(['scene-plc.Q0.'+i,id+'.CMD_'+channel+'+'],
   ['scene-supply.M0',id+'.M-']);
 });
 inputs.forEach(([id,signal],i)=>{
  paths.push([id+'.OUT_'+signal,'scene-plc.I0.'+(i+1)],
   ['scene-supply.P24',id+'.L+'],['scene-supply.M0',id+'.M']);
 });
 return paths.map(([from,to],i)=>({id:'p17-e2e-wire-'+i,from,to}));
}
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:[
  '--no-sandbox','--disable-setuid-sandbox','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
 ]});
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 const state=()=>page.$eval('[data-p17-material-lots]',e=>e.dataset.p17State);
 async function run(expected){
  await page.$eval('[data-p12-matrix]',e=>{e.open=true;});
  assert.equal(await page.$eval('[data-p17-run-material-lots]',e=>e.disabled),false,
   'A physically wired original scene must enable the P17 audit');
  await page.click('[data-p17-run-material-lots]');
  await page.waitForFunction(()=>['passed','failed','blocked'].includes(
   document.querySelector('[data-p17-material-lots]')?.dataset.p17State)||
   !!document.querySelector('[data-p12-error]'),{timeout:120000});
  const current=await state();
  if(current!==expected)throw Error('P17 expected '+expected+' got '+current+': '+
   await page.$eval('[data-p17-material-lots]',e=>e.textContent.slice(-5400)));
 }
 try{
  await page.setViewport({width:1440,height:970});
  for(const scene of ['robot-sort','bottle-line']){
   await page.goto(BASE+'/sandbox',{waitUntil:'networkidle0',timeout:45000});
   await page.evaluate(()=>localStorage.clear());
   await page.reload({waitUntil:'networkidle0',timeout:45000});
   await page.waitForSelector('[data-p9-scene-gallery]',{timeout:20000});
   await page.$eval('[data-p9-scene-gallery]',e=>{e.open=true;});
   await page.click('[data-load-plant-scene="'+scene+'"]');
   await page.waitForSelector('[data-p17-material-lots]',{timeout:20000});
   assert.equal(await state(),'setup');
   assert.equal(await page.$eval('[data-p17-run-material-lots]',e=>e.disabled),true,
    'An unsolved original scene must never self-pass P17');
   await page.evaluate((key,wires,src,scene)=>{
    const project=JSON.parse(localStorage.getItem(key));
    if(!project||!project.components.some(c=>c.id==='scene-plc'))
     throw Error('Original unsolved factory and PLC were not loaded');
    project.wires=wires;project.language='st';project.stSource=src;
    if(scene==='robot-sort')project.params={
     ...project.params,robot:{...project.params?.robot,sortMode:1},
     eye:{...project.params?.eye,rangeMm:400},
    };
    localStorage.setItem(key,JSON.stringify(project));
   },STORAGE,wiring(scene),source(scene),scene);
   await page.reload({waitUntil:'networkidle0',timeout:45000});
   await page.waitForSelector('[data-p17-material-lots]',{timeout:20000});
   await run('passed');
   const profiles=await page.$$eval('[data-p17-lot]',els=>els.map(e=>[
    e.dataset.p17Lot,e.dataset.p17LotState,
   ]));
   assert.deepEqual(profiles,[
    ['lot-a','pass'],['lot-b','pass'],['lot-c','pass'],
    ['replay-b','pass'],
   ]);
   assert.equal(await page.$eval('[data-p17-replay]',e=>e.dataset.p17Replay),'pass');
   assert.equal(await page.$eval('[data-p17-diversity]',e=>e.dataset.p17Diversity),'pass');
   const traces=await page.$$eval('[data-p17-lot]',els=>els.map(e=>
    (e.textContent.match(/actual feeder order\s+(\w{3})/i)||[])[1]??null));
   assert.deepEqual(traces,['CCM','CMC','MCC','CMC']);
   assert.equal(await page.$$eval('[data-p17-body]',els=>els.length),12,
    'Four independent three-body material lots must expose original physical trace');
   assert.equal(await page.$$eval('[data-p17-body-state="fail"]',els=>els.length),0);
   const stored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),STORAGE);
   assert.equal(stored.components.some(c=>/p17.*start|p15-auto-start/.test(c.id)),false);
   assert.equal(JSON.stringify(stored).includes('materialDiversity'),false);
   console.log('P17 MATERIAL LOTS '+scene+' PASS: three feeder-seeded physical material orders and exact replay');
  }
  // Source edits invalidate the previous audit instead of reusing a score.
  await page.evaluate(key=>{
   const project=JSON.parse(localStorage.getItem(key));
   project.stSource=project.stSource.replace(
    'IF In0 THEN Phase := 1; END_IF;',
    'IF FALSE THEN Phase := 1; END_IF;');
   localStorage.setItem(key,JSON.stringify(project));
  },STORAGE);
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p17-material-lots]',{timeout:20000});
  assert.equal(await state(),'setup');
  await run('failed');
  assert.equal(await page.$eval('[data-p17-lot="first"]',
   e=>e.dataset.p17LotState),'fail');
  assert.deepEqual(errors.filter(e=>!/WebGL|GPU stall|favicon|swiftshader/i.test(e)),[]);
  console.log('P17 MATERIAL LOTS BROWSER PASS: original PLC browser-to-worker tests, original body-quality traces, source edit invalidation and no saved evidence');
 }finally{await browser.close();}
})().catch(e=>{console.error('P17 MATERIAL LOTS BROWSER FAIL',e.stack||String(e));process.exitCode=1;});
