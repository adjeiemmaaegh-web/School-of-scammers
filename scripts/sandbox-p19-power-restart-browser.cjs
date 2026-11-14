/**
 * P19 Chromium E2E: original gallery bottle factory -> independently wired
 * real PLC16 -> offline Worker -> real supply-open/drive-loss campaign.
 * No hidden PLC solution or fixture persists in the learner's project.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const BASE=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const STORAGE='efo-open-sandbox-project-v1';
const body=[
 '0: IF In0 THEN Phase := 1; END_IF;',
 '1: IF Count < 3 THEN Out0 := TRUE; Phase := 2; ELSE Phase := 9; END_IF;',
 '2: Out1 := TRUE; IF In1 THEN Phase := 3; END_IF;',
 '3: Out2 := TRUE; IF In2 THEN Phase := 4; END_IF;',
 '4: Out1 := TRUE; IF In3 THEN Phase := 5; END_IF;',
 '5: Out3 := TRUE; IF In4 THEN Phase := 6; END_IF;',
 '6: Out1 := TRUE; IF In5 THEN Phase := 7; END_IF;',
 '7: Out1 := TRUE; IF NOT In5 THEN Count := Count + 1; Phase := 1; END_IF;',
];
const source=()=>[
 'VAR_INPUT',...Array.from({length:9},(_,i)=>' In'+i+' : BOOL;'),
 'END_VAR','VAR_OUTPUT',...Array.from({length:6},(_,i)=>' Out'+i+' : BOOL;'),
 'END_VAR','VAR',' Phase : INT := 0;',' Count : INT := 0;','END_VAR',
 ...Array.from({length:4},(_,i)=>'Out'+i+' := FALSE;'),
 'Out4 := In6 AND In7;',
 'Out5 := In8 AND In7;',
 'CASE Phase OF',...body,'9: Out0 := FALSE;','END_CASE;',
].join('\n');
const wires=()=>{
 const pairs=[
  ['scene-supply.P24','scene-plc.L+'],
  ['scene-supply.M0','scene-plc.M'],
 ];
 const output=[
  ['feeder','feed'],['belt','run'],['filler','fill'],
  ['capper','cap'],['belt','resetJam'],['belt','resetRestart'],
 ];
 output.forEach(([id,act],i)=>pairs.push(
  ['scene-plc.Q0.'+i,id+'.CMD_'+act+'+'],
  ['scene-supply.M0',id+'.M-']));
 const input=[
  ['fill-eye','present'],['filler','filled'],['cap-eye','present'],
  ['capper','capped'],['exit-eye','present'],
 ];
 input.forEach(([id,sig],i)=>pairs.push(
  [id+'.OUT_'+sig,'scene-plc.I0.'+(i+1)],
  ['scene-supply.P24',id+'.L+'],['scene-supply.M0',id+'.M']));
 pairs.push(
  ['belt.OUT_jam','scene-plc.I0.6'],
  ['belt.OUT_restartRequired','scene-plc.I1.0'],
  ['scene-supply.P24','belt.L+'],
  ['scene-supply.M0','belt.M']);
 return pairs.map(([from,to],i)=>({id:'p19-browser-wire-'+i,from,to}));
};
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:[
  '--no-sandbox','--disable-setuid-sandbox','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
 ]});
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 const state=()=>page.$eval('[data-p19-power]',e=>e.dataset.p19State);
 async function run(expected){
  await page.$eval('[data-p12-matrix]',e=>{e.open=true;});
  assert.equal(await page.$eval('[data-p19-run-power]',e=>e.disabled),false);
  await page.click('[data-p19-run-power]');
  await page.waitForFunction(()=>['passed','failed','blocked'].includes(
   document.querySelector('[data-p19-power]')?.dataset.p19State)||
   !!document.querySelector('[data-p12-error]'),{timeout:120000});
  const actual=await state();
  if(actual!==expected)throw Error('P19 expected '+expected+' but got '+actual+': '+
   await page.$eval('[data-p19-power]',e=>e.textContent.slice(-8500)));
 }
 try{
  await page.setViewport({width:1440,height:960});
  await page.goto(BASE+'/sandbox',{waitUntil:'networkidle0',timeout:45000});
  await page.evaluate(()=>localStorage.clear());
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p9-scene-gallery]',{timeout:20000});
  await page.$eval('[data-p9-scene-gallery]',e=>{e.open=true;});
  await page.click('[data-load-plant-scene="bottle-line"]');
  await page.waitForSelector('[data-p19-power]',{timeout:20000});
  assert.equal(await state(),'setup');
  assert.equal(await page.$eval('[data-p19-run-power]',e=>e.disabled),true,
   'Unsolved original scene must never self-pass P19');
  await page.evaluate((key,edges,code)=>{
   const p=JSON.parse(localStorage.getItem(key));
   if(!p||!p.components.some(c=>c.id==='scene-plc')||
    !p.components.some(c=>c.id==='belt'))
    throw Error('Expected original bottle plant with physically wired PLC');
   p.wires=edges;p.language='st';p.stSource=code;
   p.params={...p.params,belt:{...p.params?.belt,
    jamResetMode:1,restartHoldMode:1}};
   localStorage.setItem(key,JSON.stringify(p));
  },STORAGE,wires(),source());
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p19-power]',{timeout:20000});
  await run('passed');
  const kinds=await page.$$eval('[data-p19-episode]',els=>els.map(e=>[
   e.dataset.p19Episode,e.dataset.p19EpisodeState,
  ]));
  assert.deepEqual(kinds,Array.from({length:7},(_,i)=>[String(i),'pass']));
  assert.equal(await page.$eval('[data-p19-replay]',e=>e.dataset.p19Replay),'pass');
  const text=await page.$eval('[data-p19-result]',e=>e.textContent);
  assert.match(text,/Original products completed:\s*18\s*\/\s*18/i);
  assert.match(text,/plc-supply/i);
  assert.match(text,/drive-power/i);
  assert.match(text,/restart inhibited: yes/i);
  assert.equal(await page.$$eval('[data-p19-case-state="fail"]',els=>els.length),0);
  const stored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),STORAGE);
  assert.equal(stored.components.some(c=>c.id==='p19-start'||c.id==='p19-maintenance'),false);
  assert.equal(JSON.stringify(stored).includes('restartLatched'),false);
  console.log('P19 POWER RESTART BROWSER PASS: 6 original real PLC-supply/drive outage episodes, 18 unique bottles, new energized reset, replay and no persisted evidence');
  await page.evaluate(key=>{
   const p=JSON.parse(localStorage.getItem(key));
   p.stSource=p.stSource.replace('Out5 := In8 AND In7;','Out5 := FALSE;');
   localStorage.setItem(key,JSON.stringify(p));
  },STORAGE);
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p19-power]',{timeout:20000});
  assert.equal(await state(),'setup');
  await run('failed');
  assert.equal(await page.$eval('[data-p19-episode="0"]',
   e=>e.dataset.p19EpisodeState),'fail');
  assert.deepEqual(errors.filter(e=>!/WebGL|GPU stall|favicon|swiftshader/i.test(e)),[]);
  console.log('P19 POWER RESTART SOURCE-NEGATIVE BROWSER PASS: missing Q0.5 source fails and saved project never gains test fixtures');
 }finally{await browser.close();}
})().catch(error=>{console.error('P19 POWER RESTART BROWSER FAIL',error.stack||String(error));process.exitCode=1;});
