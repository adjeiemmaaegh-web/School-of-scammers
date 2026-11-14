/** P15 Chromium integration: genuine PLC16 code -> pickup/inductive sensors ->
 *  physical robot X/Y sorting -> two real receiving conveyor lanes.
 *  Only a private wired 24 V Start is pressed, once per trial.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const BASE=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const KEY='efo-open-sandbox-project-v1';
const source=[
 'VAR_INPUT',' In0 : BOOL;',' In1 : BOOL;',' In2 : BOOL;',
 ' In3 : BOOL;',' In4 : BOOL;','END_VAR',
 'VAR_OUTPUT',' Out0 : BOOL;',' Out1 : BOOL;',' Out2 : BOOL;',
 ' Out3 : BOOL;',' Out4 : BOOL;',' Out5 : BOOL;','END_VAR',
 'VAR',' Phase : INT := 0;',' Count : INT := 0;',' Lane : BOOL := FALSE;','END_VAR',
 'Out0 := FALSE; Out1 := FALSE; Out2 := FALSE; Out3 := Lane;',
 'Out4 := Phase > 0 AND Phase < 9;',
 'Out5 := Phase > 0 AND Phase < 9;',
 'CASE Phase OF',
 '0: IF In0 THEN Phase := 1; END_IF;',
 '1: IF Count < 3 THEN Out0 := TRUE; Phase := 2; ELSE Phase := 9; END_IF;',
 '2: IF In1 THEN Lane := In2; Phase := 3; END_IF;',
 '3: Out1 := TRUE; Out3 := Lane; IF In3 THEN Phase := 4; END_IF;',
 '4: Out1 := TRUE; Out2 := TRUE; Out3 := Lane; IF NOT In4 THEN Phase := 5; END_IF;',
 '5: Out1 := TRUE; Out2 := TRUE; Out3 := Lane; IF In4 THEN Phase := 6; END_IF;',
 '6: Out2 := TRUE; Out3 := Lane; IF NOT In3 THEN Phase := 7; END_IF;',
 '7: Out3 := Lane; IF NOT In4 THEN Phase := 8; END_IF;',
 '8: Out3 := Lane; IF In4 THEN Count := Count + 1; Phase := 1; END_IF;',
 '9: Out0 := FALSE;',
 'END_CASE;',
].join('\n');
const endpoints=[
 ['scene-supply.P24','scene-plc.L+'],['scene-supply.M0','scene-plc.M'],
 ['scene-plc.Q0.0','feeder.CMD_feed+'],['scene-supply.M0','feeder.M-'],
 ['scene-plc.Q0.1','robot.CMD_grip+'],['scene-supply.M0','robot.M-'],
 ['scene-plc.Q0.2','robot.CMD_dispatch+'],
 ['scene-plc.Q0.3','robot.CMD_routeMetal+'],
 ['scene-plc.Q0.4','metal-out.CMD_run+'],['scene-supply.M0','metal-out.M-'],
 ['scene-plc.Q0.5','plain-out.CMD_run+'],['scene-supply.M0','plain-out.M-'],
 ['pickup.OUT_present','scene-plc.I0.1'],['eye.OUT_present','scene-plc.I0.2'],
 ['robot.OUT_partHeld','scene-plc.I0.3'],
 ['robot.OUT_inPosition','scene-plc.I0.4'],
 ['scene-supply.P24','pickup.L+'],['scene-supply.M0','pickup.M'],
 ['scene-supply.P24','eye.L+'],['scene-supply.M0','eye.M'],
 ['scene-supply.P24','robot.L+'],['scene-supply.M0','robot.M'],
].map(([from,to],i)=>({id:'p15sort-wire-'+i,from,to}));
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:[
  '--no-sandbox','--disable-setuid-sandbox','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
 ]});
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 const status=()=>page.$eval('[data-p15-autonomous]',e=>e.dataset.p15AutonomousState);
 const run=async(expected)=>{
  await page.$eval('[data-p12-matrix]',e=>{e.open=true;});
  assert.equal(await page.$eval('[data-p15-run-autonomous]',e=>e.disabled),false,
   'The wired physical cell must pass preflight');
  await page.click('[data-p15-run-autonomous]');
  await page.waitForFunction(()=>['passed','failed'].includes(
   document.querySelector('[data-p15-autonomous]')?.dataset.p15AutonomousState)||
   !!document.querySelector('[data-p12-error]'),{timeout:120000});
  const actual=await status();
  if(actual!==expected)throw Error('P15 autonomous expected '+expected+' but got '+
   actual+': '+await page.$eval('[data-p15-autonomous]',e=>e.textContent.slice(-3500)));
 };
 try{
  await page.setViewport({width:1440,height:980});
  await page.goto(BASE+'/sandbox',{waitUntil:'networkidle0',timeout:45000});
  await page.evaluate(()=>localStorage.clear());
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p9-scene-gallery]',{timeout:20000});
  await page.$eval('[data-p9-scene-gallery]',e=>{e.open=true;});
  await page.click('[data-load-plant-scene="robot-sort"]');
  await page.waitForSelector('[data-p15-autonomous]',{timeout:20000});
  assert.equal(await status(),'setup');
  assert.equal(await page.$eval('[data-p15-run-autonomous]',e=>e.disabled),true);
  await page.evaluate((key,wires,source)=>{
   const p=JSON.parse(localStorage.getItem(key));
   if(!p.components.some(c=>c.id==='pickup')||
      !p.components.some(c=>c.id==='metal-out')||
      !p.components.some(c=>c.id==='plain-out'))
    throw Error('Physical metal/plain destination machines absent in original source scene');
   p.wires=wires;p.language='st';p.stSource=source;
   p.params={...p.params,robot:{...p.params?.robot,sortMode:1},
    eye:{...p.params?.eye,rangeMm:400}};
   localStorage.setItem(key,JSON.stringify(p));
  },KEY,endpoints,source);
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p15-autonomous]',{timeout:20000});
  await run('passed');
  const cases=await page.$$eval('[data-p15-auto-case]',els=>els.map(e=>[
   e.dataset.p15AutoCase,e.dataset.p15AutoCaseState]));
  assert.deepEqual(cases,[
   ['idle','pass'],['classification','pass'],['three-products','pass'],
   ['fault-repair','pass'],['capacity-and-flow','pass'],
  ]);
  const result=await page.$eval('[data-p15-auto-result]',e=>e.textContent);
  assert.match(result,/Metal:\s*[1-3]/);
  assert.match(result,/plain:\s*[1-3]/);
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
  assert.equal(saved.components.some(c=>c.id==='p15-auto-start'),false);
  assert.equal(JSON.stringify(saved).includes('faultRecovered'),false);
  await page.evaluate((key)=>{
   const p=JSON.parse(localStorage.getItem(key));
   p.stSource=p.stSource.replace('Lane := In2;','Lane := FALSE;');
   localStorage.setItem(key,JSON.stringify(p));
  },KEY);
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p15-autonomous]',{timeout:20000});
  assert.equal(await status(),'setup','Passing result must not survive source edit');
  await run('failed');
  assert.equal(await page.$eval('[data-p15-auto-case="classification"]',
   e=>e.dataset.p15AutoCaseState),'fail');
  assert.deepEqual(errors.filter(e=>!/WebGL|GPU stall|favicon|swiftshader/i.test(e)),[]);
  console.log('P15 AUTONOMOUS ROBOT SORT PASS: real PLC sensor-feedback, two physical material routes, second-body robot fault, source-negative rejection, no saved trial');
 }finally{await browser.close();}
})().catch(e=>{console.error('P15 AUTONOMOUS ROBOT SORT FAIL',e.stack||String(e));process.exitCode=1;});
