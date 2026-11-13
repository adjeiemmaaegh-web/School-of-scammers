/**
 * P4 SOURCE-ONLY browser acceptance recipe (integration developer executes).
 * Exercises real worker + student-editable ST and two isolated supply domains,
 * using an original source-owned panel template. Never a hardware test.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const base=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const key='efo-open-sandbox-project-v1';
const ST=['VAR_INPUT',' In0 : BOOL;',' In1 : BOOL;','END_VAR',
 'VAR_OUTPUT',' Out0 : BOOL;',' Out1 : BOOL;',' Out2 : BOOL;','END_VAR',
 'VAR',' Latched : BOOL := FALSE;',' Count : DINT := 0;','END_VAR',
 'IF NOT In1 THEN',' Latched := FALSE;',' Count := 0;',
 'ELSIF In0 THEN',' Latched := TRUE;','END_IF;',
 'IF Latched AND Count < 100000 THEN',' Count := Count + 1;','END_IF;',
 'Out0 := Latched;','Out1 := Latched AND Count < 50;',
 'Out2 := Latched AND Count >= 54;'].join('\n');
const components=[
 ['control','supply',10,10],['mains','three-phase-supply',10,250],
 ['plc16','plc16',290,10],['drive','star-delta-drive',650,200],
 ['start','start',260,250],['stop','stop',460,250],
].map(([id,kind,x,y])=>({id,kind,x,y,pressed:false}));
const links=[
 ['control.P24','plc16.L+'],['control.M0','plc16.M'],
 ['control.P24','start.A'],['start.B','plc16.I0.0'],
 ['control.P24','stop.A'],['stop.B','plc16.I0.1'],
 ['control.M0','drive.M-'],['plc16.Q0.0','drive.MAIN+'],
 ['plc16.Q0.1','drive.STAR+'],['plc16.Q0.2','drive.DELTA+'],
 ['mains.L1','drive.L1'],['mains.L2','drive.L2'],['mains.L3','drive.L3'],['mains.PE','drive.PE'],
].map(([from,to],i)=>({id:'test-wire-'+(i+1),from,to}));
const project={formatVersion:1,components,wires:links,
 program:{id:'sandbox-program',version:'1.0',rungs:[
  {id:'rung-1',elements:[{type:'contact',tag:'In0'}],coil:'Out0'},
 ]},language:'st',stSource:ST};
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox',
   '--disable-setuid-sandbox','--enable-webgl','--use-gl=angle',
   '--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(String(error)));
 const value=(attr)=>page.$eval('[data-three-phase="drive"] ['+attr+']',el=>el.textContent.trim());
 const clickText=async(label)=>{
   const ok=await page.evaluate(text=>{
    const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
    if(!button||button.disabled)return false;button.click();return true;
   },label);
   assert.ok(ok,'Button present and enabled: '+label);
 };
 try{
  await page.setViewport({width:1440,height:940,deviceScaleFactor:1});
  await page.goto(base+'/sandbox',{waitUntil:'networkidle0',timeout:20000});
  await page.evaluate((key,data)=>{localStorage.clear();localStorage.setItem(key,JSON.stringify(data));},key,project);
  await page.reload({waitUntil:'networkidle0'});
  await page.waitForSelector('[data-phase-status]');
  assert.equal(await value('data-phase-status'),'live');
  await clickText('▶ Run');
  await page.waitForFunction(()=>[...document.querySelectorAll('.sandbox-toolbar button')]
   .some(b=>b.textContent.trim()==='Pause'),{timeout:9000});
  await page.click('[data-device-id="start"] .sandbox-operate');
  await page.waitForFunction(()=>document.querySelector('[data-phase-mode]')?.textContent.trim()==='star',
    {timeout:12000});
  await page.waitForFunction(()=>document.querySelector('[data-phase-mode]')?.textContent.trim()==='delta',
    {timeout:20000});
  const amps=Number.parseFloat(await value('data-phase-amps'));
  assert.ok(amps>0,'Modeled motor draws positive current when wired and running');
  await page.click('[data-device-id="stop"] .sandbox-operate');
  await page.waitForFunction(()=>document.querySelector('[data-phase-mode]')?.textContent.trim()==='off',
    {timeout:12000});
  await clickText('Pause');
  await page.waitForFunction(()=>[...document.querySelectorAll('.sandbox-toolbar button')]
   .some(b=>b.textContent.trim()==='▶ Run'&&!b.disabled),{timeout:9000});
  await page.click('[data-three-phase="drive"] details summary');
  await page.click('[data-phase-source="mains"]');
  await page.waitForFunction(()=>document.querySelector('[data-phase-status]')?.textContent.trim()==='isolated',
    {timeout:10000});
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null'),key);
  assert.equal(saved.wires.length,14);
  assert.equal(saved.stSource,ST);
  await page.reload({waitUntil:'networkidle0'});
  await page.waitForSelector('[data-phase-status]');
  assert.equal(await value('data-phase-status'),'live'); // operational source switch is ephemeral, not saved
  assert.deepEqual(errors.filter(e=>!/WebGL|favicon|GPU stall/i.test(e)),[]);
  console.log('P4 SOURCE BROWSER PASS: two domains, PLC/ST, STAR/DELTA, stop, isolate and save');
 }finally{await browser.close();}
})().catch(error=>{console.error('P4 SOURCE BROWSER FAIL',error.stack||String(error));process.exitCode=1;});
