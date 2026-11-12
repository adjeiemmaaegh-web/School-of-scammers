/**
 * P15 Chromium end-to-end: real UI-loaded original gantry/pallet/bottle scenes,
 * authored PLC16 code and individually wired physical sensors + device loads.
 * The independent assessment Worker applies only one 24 V Start request.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const BASE=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const KEY='efo-open-sandbox-project-v1';
const CONFIG={
 'gantry-transfer':{
  outputs:[['feeder','feed'],['gantry','grip'],['gantry','dispatch'],['out','run']],
  inputs:[['pickup','present'],['gantry','partHeld'],['gantry','inPosition']],
  clauses:[
   'IF In0 THEN Phase := 1; END_IF;',
   'IF Count < 3 THEN Out0 := TRUE; Phase := 2; ELSE Phase := 9; END_IF;',
   'IF In1 THEN Phase := 3; END_IF;',
   'Out1 := TRUE; IF In2 THEN Phase := 4; END_IF;',
   'Out1 := TRUE; Out2 := TRUE; IF NOT In3 THEN Phase := 5; END_IF;',
   'Out1 := TRUE; Out2 := TRUE; IF In3 THEN Phase := 6; END_IF;',
   'Out2 := TRUE; IF NOT In2 THEN Phase := 7; END_IF;',
   'IF NOT In3 THEN Phase := 8; END_IF;',
   'IF In3 THEN Count := Count + 1; Phase := 1; END_IF;',
  ],
  expected:3,
 },
 'palletizing':{
  outputs:[['feeder','feed'],['palletizer','pick'],['palletizer','place']],
  inputs:[['pickup','present'],['palletizer','partHeld'],['palletizer','patternDone']],
  clauses:[
   'IF In0 THEN Phase := 1; END_IF;',
   'IF Count < 8 AND NOT In3 THEN Out0 := TRUE; Phase := 2; ELSE Phase := 9; END_IF;',
   'IF In1 THEN Phase := 3; END_IF;',
   'Out1 := TRUE; Wait := 0; Phase := 4;',
   'IF In2 THEN Phase := 5; ELSIF Wait >= 3 THEN Phase := 3; ELSE Wait := Wait + 1; END_IF;',
   'Out2 := TRUE; IF NOT In2 THEN Phase := 6; END_IF;',
   'Count := Count + 1; Phase := 1;',
  ],
  expected:8,
 },
 'bottle-line':{
  outputs:[['feeder','feed'],['belt','run'],['filler','fill'],['capper','cap']],
  inputs:[['fill-eye','present'],['filler','filled'],
   ['cap-eye','present'],['capper','capped'],['exit-eye','present']],
  clauses:[
   'IF In0 THEN Phase := 1; END_IF;',
   'IF Count < 3 THEN Out0 := TRUE; Phase := 2; ELSE Phase := 9; END_IF;',
   'Out1 := TRUE; IF In1 THEN Phase := 3; END_IF;',
   'Out2 := TRUE; IF In2 THEN Phase := 4; END_IF;',
   'Out1 := TRUE; IF In3 THEN Phase := 5; END_IF;',
   'Out3 := TRUE; IF In4 THEN Phase := 6; END_IF;',
   'Out1 := TRUE; IF In5 THEN Phase := 7; END_IF;',
   'Out1 := TRUE; IF NOT In5 THEN Count := Count + 1; Phase := 1; END_IF;',
  ],
  expected:3,
 },
};
function controller(id){
 const c=CONFIG[id],heads=[
  'VAR_INPUT',...Array.from({length:c.inputs.length+1},(_,i)=>' In'+i+' : BOOL;'),
  'END_VAR','VAR_OUTPUT',...c.outputs.map((_,i)=>' Out'+i+' : BOOL;'),
  'END_VAR','VAR',' Phase : INT := 0;',' Count : INT := 0;',
  ' Wait : INT := 0;','END_VAR',
  ...c.outputs.map((_,i)=>'Out'+i+' := FALSE;'),
 ];
 if(id==='gantry-transfer')heads.push('Out3 := Phase > 0 AND Phase < 9;');
 return [...heads,'CASE Phase OF',...c.clauses.map((cmd,i)=>i+': '+cmd),
  '9: Out0 := FALSE;','END_CASE;'].join('\n');
}
function wiring(id){
 const c=CONFIG[id],pairs=[
  ['scene-supply.P24','scene-plc.L+'],
  ['scene-supply.M0','scene-plc.M'],
 ];
 c.outputs.forEach(([device,command],i)=>{
  pairs.push(['scene-plc.Q0.'+i,device+'.CMD_'+command+'+'],
   ['scene-supply.M0',device+'.M-']);
 });
 c.inputs.forEach(([device,signal],i)=>{
  pairs.push([device+'.OUT_'+signal,'scene-plc.I0.'+(i+1)],
   ['scene-supply.P24',device+'.L+'],
   ['scene-supply.M0',device+'.M']);
 });
 return pairs.map(([from,to],i)=>({id:'p15autofactory'+i,from,to}));
}
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:[
  '--no-sandbox','--disable-setuid-sandbox','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
 ]});
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 const state=()=>page.$eval('[data-p15-autonomous]',e=>e.dataset.p15AutonomousState);
 const run=async(expected)=>{
  await page.$eval('[data-p12-matrix]',e=>{e.open=true;});
  assert.equal(await page.$eval('[data-p15-run-autonomous]',e=>e.disabled),false);
  await page.click('[data-p15-run-autonomous]');
  await page.waitForFunction(()=>['passed','failed'].includes(
   document.querySelector('[data-p15-autonomous]')?.dataset.p15AutonomousState)||
   !!document.querySelector('[data-p12-error]'),{timeout:120000});
  const got=await state();
  if(got!==expected)throw Error('Autonomous factory expected '+expected+' got '+got+' '+
    await page.$eval('[data-p15-autonomous]',e=>e.textContent.slice(-3000)));
 };
 try{
  await page.setViewport({width:1440,height:980});
  for(const id of Object.keys(CONFIG)){
   await page.goto(BASE+'/sandbox',{waitUntil:'networkidle0',timeout:45000});
   await page.evaluate(()=>localStorage.clear());
   await page.reload({waitUntil:'networkidle0',timeout:45000});
   await page.waitForSelector('[data-p9-scene-gallery]',{timeout:20000});
   await page.$eval('[data-p9-scene-gallery]',e=>{e.open=true;});
   await page.click('[data-load-plant-scene="'+id+'"]');
   await page.waitForSelector('[data-p15-autonomous]',{timeout:20000});
   assert.equal(await state(),'setup');
   assert.equal(await page.$eval('[data-p15-run-autonomous]',b=>b.disabled),true,
    'Original unsolved factory must fail autonomous preflight');
   await page.evaluate((key,wires,program)=>{
    const p=JSON.parse(localStorage.getItem(key));
    p.wires=wires;p.language='st';p.stSource=program;
    localStorage.setItem(key,JSON.stringify(p));
   },KEY,wiring(id),controller(id));
   await page.reload({waitUntil:'networkidle0',timeout:45000});
   await page.waitForSelector('[data-p15-autonomous]',{timeout:20000});
   await run('passed');
   const cases=await page.$$eval('[data-p15-auto-case]',els=>els.map(x=>[
    x.dataset.p15AutoCase,x.dataset.p15AutoCaseState]));
   assert.deepEqual(cases,[
    ['idle','pass'],['continuous-process','pass'],
    ['fault-in-batch','pass'],['bounded-flow','pass'],
   ]);
   const info=await page.$eval('[data-p15-auto-result]',e=>e.textContent);
   assert.ok(info.includes('Actual items: '+CONFIG[id].expected+'/'+CONFIG[id].expected));
   const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
   assert.equal(saved.components.some(c=>c.id==='p15-auto-factory-start'),false);
   assert.equal(JSON.stringify(saved).includes('faultRecovered'),false);
   console.log('P15 AUTONOMOUS '+id+' PASS: actual 24V PLC with physical process and second-body recovery');
  }
  await page.evaluate(key=>{
   const p=JSON.parse(localStorage.getItem(key));
   p.stSource=p.stSource.replace('IF In0 THEN Phase := 1; END_IF;',
    'IF FALSE THEN Phase := 1; END_IF;');
   localStorage.setItem(key,JSON.stringify(p));
  },KEY);
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p15-autonomous]',{timeout:20000});
  assert.equal(await state(),'setup');
  await run('failed');
  assert.deepEqual(errors.filter(e=>!/WebGL|GPU stall|favicon|swiftshader/i.test(e)),[]);
  console.log('P15 AUTONOMOUS FACTORY BROWSER PASS: all three physical processes, registered faults, wrong code and non-persistence');
 }finally{await browser.close();}
})().catch(e=>{console.error('P15 AUTONOMOUS FACTORY BROWSER FAIL',e.stack||String(e));process.exitCode=1;});
