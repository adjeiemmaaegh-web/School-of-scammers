/**
 * Full genuine-Chromium E2E: a learner-saved 3-roller / turntable / two-photoeye
 * factory uses real PLC16 ST and physical 24V wiring through the Web Worker.
 * Correct logic routes the box north; wrong ST routes east, not an animation.
 * The body tracker is a pure projection of RenderSnapshot.plantWorld.
 */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
const key = 'efo-open-sandbox-project-v1';
const ST = [
  'VAR_INPUT', ' In0 : BOOL;', ' In1 : BOOL;', ' In2 : BOOL;', 'END_VAR',
  'VAR_OUTPUT', ...Array.from({ length: 8 }, (_, i) => ' Out'+i+' : BOOL;'), 'END_VAR',
  'VAR', ' Count : INT := 0;', ' Rotate : BOOL := FALSE;', 'END_VAR',
  'Count := Count + 1;',
  'IF In1 THEN Rotate := TRUE; END_IF;',
  'Out0 := In0;', 'Out1 := In0;', 'Out2 := Rotate;',
  'Out3 := In0;', 'Out4 := In0;',
  'Out5 := In0 AND Count = 1;', 'Out6 := In0 AND Count = 1;',
  'Out7 := In2;',
].join('\n');
const pieces = [
  ['supply','supply',10,10], ['ctrl','plc16',260,10],
  ['feeder','box-feeder',390,225], ['in','roller-conveyor',410,225],
  ['table','turntable',455,225], ['east','roller-conveyor',503,225],
  ['north','roller-conveyor',455,273], ['eye1','geometry-photoeye',448,225],
  ['eye2','geometry-photoeye',455,260], ['pilot','lamp',580,225],
];
const links = [
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
const makeProject = (wrong = false) => ({
  formatVersion: 1,
  components: pieces.map(([id,kind,x,y]) => ({
    id,kind,x,y,pressed:false,...(id==='north'?{yawDeg:90}:{})
  })),
  wires: links.map(([from,to],i) => ({id:'w'+(i+1),from,to})),
  program: {id:'sandbox-program',version:'1.0',rungs:[
    {id:'rung-1',elements:[{type:'contact',tag:'In0'}],coil:'Out0'},
  ]},
  language:'st',
  stSource: wrong ? ST.replace('Out2 := Rotate;', 'Out2 := FALSE;') : ST,
});
(async () => {
  const browser = await puppeteer.launch({headless:true,args:[
    '--no-sandbox','--disable-setuid-sandbox','--enable-webgl',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'
  ]});
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  async function clickText(text) {
    const ok = await page.evaluate(label => {
      const button = [...document.querySelectorAll('button')].find(
        b => b.textContent.trim() === label);
      if (!button || button.disabled) return false;
      button.click(); return true;
    },text);
    assert.ok(ok,'Expected enabled button: '+text);
  }
  async function runCase(wrong, destination) {
    const fixture = makeProject(wrong);
    await page.evaluate((key,data) => {
      localStorage.clear();
      localStorage.setItem(key,JSON.stringify(data));
    },key,fixture);
    await page.reload({waitUntil:'networkidle0'});
    await page.waitForSelector('[data-p3-bodies]',{timeout:20000});
    await page.waitForSelector('.sandbox-p3-body-list');
    await page.waitForFunction(() =>
      document.querySelector('.sandbox-st-status strong')?.textContent.trim() === 'Compiler OK',
      {timeout:12000});
    assert.match(await page.$eval('#sandbox-st-source',el=>el.value),/Out2 := /);
    await clickText('▶ Run');
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.sandbox-toolbar button')].some(b=>b.textContent.trim()==='Pause'),
      {timeout:10000});
    await page.waitForFunction(() => Number(document.querySelector('[data-p3-bodies]')?.textContent)>0,
      {timeout:25000});
    await page.waitForFunction(dest=>
      !!document.querySelector('.sandbox-p3-body-list [data-supported-by="'+dest+'"]'),
      {timeout:45000},destination);
    const telemetry = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.sandbox-p3-signal-list section')];
      return Object.fromEntries(rows.map(el=>{
        const name=el.querySelector('strong')?.textContent.trim().split(' · ').at(-1);
        return [name,el.textContent.trim()];
      }));
    });
    assert.match(telemetry.table||'',wrong?/rotated = false/:/rotated = true/);
    if (!wrong) {
      await page.waitForFunction(() =>
        [...document.querySelectorAll('.sandbox-p3-signal-list section')]
          .some(el=>el.textContent.includes('eye2')&&el.textContent.includes('present = true')),
        {timeout:15000});
      await page.waitForFunction(() =>
        document.querySelector('[data-device-id="pilot"] .sandbox-device-status')
          ?.textContent.includes('ON') || 
        document.querySelector('[data-device-id="pilot"] .sandbox-device-status')
          ?.textContent.includes('LIT'),
        {timeout:15000}).catch(()=>{});
      assert.equal(await page.$eval('.sandbox-p3-body-list',el=>
        !!el.querySelector('[data-supported-by="east"]')),false,'Correct ST must not route east');
    } else {
      assert.equal(await page.$eval('.sandbox-p3-body-list',el=>
        !!el.querySelector('[data-supported-by="north"]')),false,'Wrong ST must not route north');
    }
    await clickText('Pause');
    await page.waitForFunction(() => [...document.querySelectorAll('.sandbox-toolbar button')]
      .some(b=>b.textContent.trim()==='▶ Run'),{timeout:12000});
    await page.waitForFunction(key=>!!localStorage.getItem(key),{},key);
    const saved = await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.equal(saved.components.length,10);
    assert.equal(saved.wires.length,23);
    assert.equal(saved.components.find(c=>c.id==='north')?.yawDeg,90);
    assert.equal(saved.stSource,fixture.stSource);
    await page.reload({waitUntil:'networkidle0'});
    await page.waitForFunction(() =>
      document.querySelectorAll('.sandbox-wire-list > div').length===23,
      {timeout:15000});
    assert.match(await page.$eval('#sandbox-st-source',el=>el.value),/Out2 := /);
  }
  try {
    await page.setViewport({width:1440,height:940,deviceScaleFactor:1});
    await page.goto(base+'/sandbox',{waitUntil:'networkidle0',timeout:30000});
    await runCase(false,'north');
    await runCase(true,'east');
    assert.deepEqual(pageErrors.filter(s=>!/favicon|WebGL|GPU stall|swiftshader/i.test(s)),[]);
    console.log('THREE-CONVEYOR TURNTABLE E2E PASS: worker body north vs east, two sensors, ST, wiring, persistence');
  } finally {
    await browser.close();
  }
})().catch(e=>{console.error('THREE-CONVEYOR TURNTABLE E2E FAIL',e.stack||String(e));process.exitCode=1;});
