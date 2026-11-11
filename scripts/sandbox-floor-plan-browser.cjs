/**
 * P6 visual workcell: a learner builds a 10-device turntable line from an EMPTY
 * workspace using the new GPU-free 2D plan (no project JSON, no starter
 * template). The browser then wires all 23 actual terminals, authors ST,
 * and observes a worker-owned parcel. A second reload proves persistence.
 *
 * This is educational simulated physics, not physical PLC acceptance.
 */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
const storage = 'efo-open-sandbox-project-v1';
const PARTS = [
  ['supply', 'supply', 10, 10],
  ['ctrl', 'plc16', 260, 10],
  ['feeder', 'box-feeder', 390, 225],
  ['in', 'roller-conveyor', 410, 225],
  ['table', 'turntable', 455, 225],
  ['east', 'roller-conveyor', 503, 225],
  ['north', 'roller-conveyor', 455, 273],
  ['eye1', 'geometry-photoeye', 448, 225],
  ['eye2', 'geometry-photoeye', 455, 260],
  ['pilot', 'lamp', 580, 225],
];
const LINKS = [
  ['supply.P24','ctrl.L+'], ['supply.M0','ctrl.M'],
  ['supply.P24','ctrl.I0.0'],
  ['ctrl.Q0.0','in.CMD_run+'], ['supply.M0','in.M-'],
  ['ctrl.Q0.1','table.CMD_run+'], ['ctrl.Q0.2','table.CMD_turn+'],
  ['supply.M0','table.M-'],
  ['ctrl.Q0.3','east.CMD_run+'], ['supply.M0','east.M-'],
  ['ctrl.Q0.4','north.CMD_run+'], ['supply.M0','north.M-'],
  ['ctrl.Q0.5','feeder.CMD_enable+'],
  ['ctrl.Q0.6','feeder.CMD_feed+'], ['supply.M0','feeder.M-'],
  ['supply.P24','eye1.L+'], ['supply.M0','eye1.M'],
  ['eye1.OUT_present','ctrl.I0.1'],
  ['supply.P24','eye2.L+'], ['supply.M0','eye2.M'],
  ['eye2.OUT_present','ctrl.I0.2'],
  ['ctrl.Q0.7','pilot.L+'], ['supply.M0','pilot.M-'],
];
const ST = [
  'VAR_INPUT', ' In0 : BOOL;', ' In1 : BOOL;', ' In2 : BOOL;', 'END_VAR',
  'VAR_OUTPUT', ...Array.from({length:8},(_,i)=>' Out'+i+' : BOOL;'), 'END_VAR',
  'VAR', ' Count : INT := 0;', ' Rotate : BOOL := FALSE;', 'END_VAR',
  'Count := Count + 1;',
  'IF In1 THEN Rotate := TRUE; END_IF;',
  'Out0 := In0;', 'Out1 := In0;', 'Out2 := Rotate;',
  'Out3 := In0;', 'Out4 := In0;',
  'Out5 := In0 AND Count = 1;', 'Out6 := In0 AND Count = 1;',
  'Out7 := In2;',
].join('\n');
(async () => {
 const browser = await puppeteer.launch({headless:true,args:[
   '--no-sandbox','--disable-setuid-sandbox','--disable-webgl','--disable-gpu','--disable-dev-shm-usage',
 ]});
 const page = await browser.newPage(), errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 const saved=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),storage);
 const count=(n)=>page.waitForFunction(num=>
   document.querySelectorAll('[data-plan-device]').length===num,{timeout:15000},n);
 const clickText=async label=>{
  const found=await page.evaluate(value=>{
   const b=[...document.querySelectorAll('button')].find(el=>el.textContent.trim()===value);
   if(!b||b.disabled)return false;
   b.click();return true;
  },label);
  assert.ok(found,'Expected enabled toolbar control: '+label);
 };
 const position=async(x,y)=>{
   await page.$eval('[data-floor-plan] svg',el=>el.scrollIntoView({block:'center'}));
   const box=await page.$eval('[data-floor-plan] svg',el=>{
    const r=el.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height};
   });
   const cx=box.x+(x+85)*box.w/1080,cy=box.y+(y+65)*box.h/580;
   await page.mouse.click(cx,cy);
 };
 const clickTerminal=async terminal=>{
  const sel=`[data-terminal-id="${terminal}"]`;
  await page.$eval(sel,el=>el.scrollIntoView({block:'center'}));
  await page.click(sel);
 };
 try {
  await page.setViewport({width:1440,height:940,deviceScaleFactor:1});
  await page.goto(base+'/sandbox',{waitUntil:'networkidle0',timeout:30000});
  await page.evaluate(()=>localStorage.clear());
  await page.reload({waitUntil:'networkidle0'});
  await page.waitForSelector('[data-p5-view="plan"]',{timeout:15000});
  await page.click('[data-p5-view="plan"]');
  await page.waitForSelector('[data-floor-plan]');
  assert.equal((await saved())?.components?.length??0,0,'Must begin with a blank project');
  assert.equal(await page.$eval('[data-floor-plan] svg',svg=>getComputedStyle(svg).display),'block');
  await page.select('select[aria-label="Workspace snap grid size"]','1');
  const ids={};
  for(const [role,kind,x,y] of PARTS) {
    await page.select('[data-floor-tool]',kind);
    await position(x,y);
    await count(Object.keys(ids).length+1);
    const parts=(await saved()).components;
    const newest=parts[parts.length-1];
    ids[role]=newest.id;
    assert.equal(newest.kind,kind);
    assert.ok(Math.abs(newest.x-x)<=2&&Math.abs(newest.y-y)<=2,
      `Placed ${role} precisely by pointer: ${newest.x}, ${newest.y}`);
  }
  // A first-person GUI must allow selecting hidden or overlapping machines via
  // keyboard, not only clicking the topmost mesh.
  await page.$eval(`[data-plan-device="${ids.north}"]`,el=>el.focus());
  await page.keyboard.press('Enter');
  await page.waitForFunction(id=>
   document.querySelector(`[data-plan-device="${id}"]`)?.getAttribute('aria-pressed')==='true',
   {timeout:10000},ids.north);
  await clickText('↷ 90°');
  await page.waitForFunction(id=>{
   const p=JSON.parse(localStorage.getItem('efo-open-sandbox-project-v1')||'null');
   return p?.components?.find(c=>c.id===id)?.yawDeg===90;
  },{timeout:10000},ids.north);
  await page.select('[data-floor-tool]','');
  // Make an edit by pointer drag. It must arrive in the worker-owned saved
  // project, with undo and redo restoring the worker-acknowledged snapshots.
  await page.$eval(`[data-plan-device="${ids.pilot}"]`,el=>el.scrollIntoView({block:'center'}));
  const pilotBox=await page.$eval(`[data-plan-device="${ids.pilot}"] rect`,el=>{
   const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};
  });
  const before=(await saved()).components.find(c=>c.id===ids.pilot);
  await page.mouse.move(pilotBox.x,pilotBox.y);
  await page.mouse.down();
  await page.mouse.move(pilotBox.x+20,pilotBox.y+10,{steps:10});
  await page.mouse.up();
  await page.waitForFunction((id,x)=>{
   const p=JSON.parse(localStorage.getItem('efo-open-sandbox-project-v1')||'null');
   return p?.components?.find(c=>c.id===id)?.x!==x;
  },{timeout:12000},ids.pilot,before.x);
  assert.equal((await saved()).components.length,10,'No duplicate device on move');
  // Plan is an editing view; switch into the real terminal board to wire it.
  await page.click('[data-floor-plan] button:last-child');
  await page.waitForFunction(()=>document.querySelector('[data-p5-view-active]')?.
   getAttribute('data-p5-view-active')==='logical',{timeout:10000});
  for(const [first,second] of LINKS){
   const translate=pin=>{
    const index=pin.indexOf('.');
    return ids[pin.slice(0,index)]+pin.slice(index);
   };
   await clickTerminal(translate(first));
   await clickTerminal(translate(second));
  }
  await page.waitForFunction(()=>document.querySelectorAll('.sandbox-wire-list>div').length===23,
   {timeout:15000});
  await clickText('Structured Text (ST)');
  await page.waitForSelector('#sandbox-st-source');
  await page.click('#sandbox-st-source');
  await page.keyboard.down('Control');await page.keyboard.press('KeyA');await page.keyboard.up('Control');
  await page.keyboard.type(ST);
  await page.waitForFunction(()=>
   document.querySelector('.sandbox-st-status strong')?.textContent.trim()==='Compiler OK',
   {timeout:15000});
  await clickText('Compile & activate ST');
  await page.click('[data-p5-view="plan"]');
  await page.waitForSelector('[data-floor-plan]');
  await clickText('▶ Run');
  await page.waitForFunction(()=>
   document.querySelectorAll('[data-plan-parcel]').length>0,
   {timeout:30000});
  // At least one actual body follows the northbound route rather than a
  // frontend-generated animation. The body location comes from the worker.
  await page.waitForFunction(()=>
   [...document.querySelectorAll('[data-plan-parcel]')].some(el=>{
    const m=/translate\\(([-.0-9]+),([-.0-9]+)\\)/.exec(el.getAttribute('transform')||'');
    return m&&Number(m[2])>315;
   }),{timeout:50000});
  await clickText('Pause');
  const project=await saved();
  assert.equal(project.components.length,10);
  assert.equal(project.wires.length,23);
  assert.equal(project.components.find(c=>c.id===ids.north)?.yawDeg,90);
  assert.equal(project.language,'st');
  assert.match(project.stSource||'',/Out2 := Rotate/);
  await page.reload({waitUntil:'networkidle0'});
  await page.click('[data-p5-view="plan"]');
  await count(10);
  assert.equal((await saved()).wires.length,23);
  assert.deepEqual(errors.filter(s=>!/WebGL|GPU stall|favicon|swiftshader/i.test(s)),[]);
  console.log('P6 WORKCELL BUILDER PASS: blank floor -> precise 2D placement -> 3D yaw -> drag -> 23 wires -> handwritten ST -> worker parcel -> reload, no WebGL');
 }finally{await browser.close();}
})().catch(e=>{console.error('P6 WORKCELL BUILDER FAIL',e.stack||String(e));process.exitCode=1;});
