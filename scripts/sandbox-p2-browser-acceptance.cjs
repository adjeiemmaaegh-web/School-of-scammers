/** P2 browser end-to-end: one actual 24V netlist, multi-rung TON, edited ST and breakpoint.
 * Runs after npm ci, Vite preview and a software-WebGL-capable Chrome runner.
 */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
const wires = [
  ['supply-1.P24','plc-2.L+'], ['supply-1.M0','plc-2.M'],
  ['supply-1.P24','start-5.A'], ['start-5.B','plc-2.I0.0'],
  ['supply-1.P24','stop-6.A'], ['stop-6.B','plc-2.I0.1'],
  ['plc-2.Q0.0','contactor-3.A1'], ['supply-1.M0','contactor-3.A2'],
  ['supply-1.P24','contactor-3.13'], ['contactor-3.14','motor-4.L+'],
  ['supply-1.M0','motor-4.M-'],
];
const clickText = async (page, label) => {
  const exists = await page.evaluate(text => {
    const button = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === text);
    if(!button) return false;
    button.click(); return true;
  }, label);
  assert.ok(exists, `Missing button ${label}`);
};
(async () => {
  const browser = await puppeteer.launch({headless:true,
    args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page = await browser.newPage();
  // The sticky toolbar covers a band of the viewport. Like a person, scroll the target to the centre
  // before clicking (Puppeteer only scrolls elements that are entirely off-screen).
  { const original = page.click.bind(page);
    page.click = async (selector, options) => {
      await page.$eval(selector, el => el.scrollIntoView({ block: 'center', inline: 'center' }));
      return original(selector, options);
    }; }
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  try {
    await page.goto(base + '/sandbox', {waitUntil:'networkidle0'});
    await page.waitForSelector('.sandbox-device-list');
    await clickText(page, 'Place starter layout');
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-patch .sandbox-device').length === 6);
    for(const [from,to] of wires) {
      await page.click(`[data-terminal-id="${from}"]`);
      await page.waitForFunction(pin => document.querySelector(`[data-terminal-id="${pin}"]`)?.classList.contains('selected'),{},from);
      await page.click(`[data-terminal-id="${to}"]`);
    }
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-wire-list > div').length === 11);
    await page.type('#sandbox-new-tag', 'DelayReady');
    await clickText(page, 'Add tag');
    await page.waitForFunction(() => [...document.querySelectorAll('.sandbox-symbol-list code')].some(x => x.textContent === 'DelayReady'));
    await page.select('[data-rung-id="rung-1"] select[aria-label="Output coil"]', 'DelayReady');
    await page.waitForFunction(() => document.querySelector('[data-rung-id="rung-1"] select[aria-label="Output coil"]')?.value === 'DelayReady');
    await page.select('select[aria-label="Instruction for rung-1"]','ton');
    await page.waitForSelector('input[aria-label="Timer preset for rung-1"]');
    await page.$eval('input[aria-label="Timer preset for rung-1"]', input => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      set.call(input,'150');input.dispatchEvent(new Event('input',{bubbles:true}));
    });
    await page.waitForFunction(() => document.querySelector('input[aria-label="Timer preset for rung-1"]')?.value === '150');
    await clickText(page, '+ Add rung');
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-rung').length === 2);
    await page.select('[data-rung-id="rung-2"] select[aria-label="Contact tag"]','DelayReady');
    await page.waitForFunction(() => document.querySelector('[data-rung-id="rung-2"] select[aria-label="Contact tag"]')?.value === 'DelayReady');
    await page.select('[data-rung-id="rung-2"] select[aria-label="Output coil"]','Run');
    await page.waitForFunction(() => document.querySelector('[data-rung-id="rung-2"] select[aria-label="Output coil"]')?.value === 'Run');
    await clickText(page,'▶ Run');
    await page.click('[data-device-id="start-5"] .sandbox-operate');
    await page.waitForFunction(() => document.querySelector('[data-device-id="motor-4"] .sandbox-device-status')?.textContent === 'RUNNING',{timeout:5000});
    const timer = await page.$eval('.sandbox-memory-row', node => node.textContent);
    assert.match(timer,/150 ms/);
    await clickText(page,'Pause');
    await page.waitForFunction(() => [...document.querySelectorAll('.sandbox-toolbar button')].some(x => x.textContent.trim() === '▶ Run'));

    await clickText(page,'Structured Text (ST)');
    await page.waitForSelector('#sandbox-st-source');
    const st = await page.$eval('#sandbox-st-source', element => element.value);
    assert.match(st,/Run := StopOK AND/);
    // Edit and compile the actual source: no generated animation or mocked ST interpreter.
    await page.focus('#sandbox-st-source');
    await page.keyboard.press('End');
    await page.keyboard.type('\n(* Browser-verified ST *)');
    await page.waitForFunction(() => [...document.querySelectorAll('.sandbox-st-editor button')].some(x =>
      x.textContent.includes('Compile & activate ST') && !x.disabled));
    await clickText(page,'Compile & activate ST');
    await page.waitForFunction(() => document.querySelector('#sandbox-st-source')?.value.includes('Browser-verified ST'));
    await clickText(page,'Reset scan state');
    await clickText(page,'▶ Run');
    await page.waitForFunction(() => document.querySelector('[data-device-id="motor-4"] .sandbox-device-status')?.textContent === 'RUNNING',{timeout:5000});
    await page.click('[data-device-id="start-5"] .sandbox-operate');
    const prior = await page.$eval('.sandbox-scan', element => Number(element.textContent.replace(/\D/g,'')));
    await page.waitForFunction(n => Number(document.querySelector('.sandbox-scan')?.textContent.replace(/\D/g,'')) >= n + 3,{},prior);
    assert.equal(await page.$eval('[data-device-id="motor-4"] .sandbox-device-status',el => el.textContent),'RUNNING');
    await page.click('[data-device-id="stop-6"] .sandbox-operate');
    await page.waitForFunction(() => document.querySelector('[data-device-id="motor-4"] .sandbox-device-status')?.textContent === 'STOPPED',{timeout:5000});

    await clickText(page,'Pause');
    await page.waitForFunction(() => [...document.querySelectorAll('.sandbox-toolbar button')].some(x => x.textContent.trim() === '▶ Run'));
    await clickText(page,'Reset scan state');
    await page.type('input[aria-label="Breakpoint scan number"]','3');
    await clickText(page,'Set');
    await page.waitForFunction(() => document.querySelector('.sandbox-breakpoint-panel')?.textContent.includes('Armed at scan 3'));
    await clickText(page,'▶ Run');
    await page.waitForFunction(() => document.querySelector('.sandbox-breakpoint-hit')?.textContent === 'Paused at scan 3',{timeout:6000});
    assert.equal(await page.$eval('.sandbox-scan',el => el.textContent.trim()),'Scan 3');

    // The previous numeric breakpoint is cleared before arming a genuine BOOL signal edge.
    await page.$eval('.sandbox-breakpoint-panel', section => {
      const clear = [...section.querySelectorAll('button')].find(button => button.textContent.trim() === 'Clear');
      if (!clear) throw new Error('Missing numeric breakpoint Clear control');
      clear.click();
    });
    await page.waitForFunction(() => !document.querySelector('.sandbox-breakpoint-panel')?.textContent.includes('Armed at scan'));
    await page.select('select[aria-label="Breakpoint PLC tag"]','Start');
    await page.select('select[aria-label="Breakpoint signal edge"]','rising');
    await clickText(page,'Arm edge');
    await page.waitForFunction(() => [...document.querySelectorAll('.sandbox-breakpoint-panel')]
      .some(panel => panel.textContent.includes('Watching Start')));
    await clickText(page,'▶ Run');
    await page.click('[data-device-id="start-5"] .sandbox-operate');
    await page.waitForFunction(() => document.querySelector('.sandbox-breakpoint-hit')?.textContent.includes('Start rising edge'),
      {timeout:6000});
    assert.ok(await page.$('.sandbox-scan-history-list [role="row"]:nth-child(2)'),'Worker scan history must be visible');
    const exportButton = await page.$eval('.sandbox-scan-history', section => {
      const button = [...section.querySelectorAll('button')].find(entry => entry.textContent.trim() === 'Export scan CSV');
      return !!button && !button.disabled;
    });
    assert.ok(exportButton,'Real scan evidence must be exportable');
    // The same editor must expose load and reset controls for the salvaged CTD/CTU instructions.
    await clickText(page,'Ladder (LD)');
    await page.waitForSelector('select[aria-label="Instruction for rung-1"]', { timeout: 8000 });
    await page.select('select[aria-label="Instruction for rung-1"]','ctd');
    await page.waitForSelector('select[aria-label="Load condition for rung-1"]');
    await page.select('select[aria-label="Load condition for rung-1"]','Start');
    await page.waitForFunction(() => document.querySelector('select[aria-label="Load condition for rung-1"]')?.value === 'Start');
    await page.select('select[aria-label="Instruction for rung-1"]','ctu');
    await page.waitForSelector('select[aria-label="Reset condition for rung-1"]');

    assert.deepEqual(errors,[]);
    console.log('P2 SANDBOX E2E PASS: wired TON, LD/ST, scan and edge breakpoints, scan history and CTD/CTU editing');
  } finally { await browser.close(); }
})().catch(e=>{console.error('P2 SANDBOX E2E FAIL', e.stack||String(e));process.exitCode=1;});
