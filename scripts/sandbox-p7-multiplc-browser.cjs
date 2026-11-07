/** Real-Chrome P7 workflow on the real worker: two panels, each with its own supply, PLC, buttons,
 *  contactor and motor. PLC 1 runs a Ladder latch and PLC 2 a Structured Text latch; they run and stop
 *  independently; a signal wired from PLC 1's output to PLC 2's input (over a shared common) makes PLC 2
 *  act; the programs and both PLCs survive a reload. Every value is read from worker-driven DOM.
 */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
const panel = n => [
  [`supply-${n}.P24`, `plc-${n}.L+`], [`supply-${n}.M0`, `plc-${n}.M`],
  [`supply-${n}.P24`, `start-${n}.A`], [`start-${n}.B`, `plc-${n}.I0.0`],
  [`supply-${n}.P24`, `stop-${n}.A`], [`stop-${n}.B`, `plc-${n}.I0.1`],
  [`plc-${n}.Q0.0`, `contactor-${n}.A1`], [`supply-${n}.M0`, `contactor-${n}.A2`],
  [`supply-${n}.P24`, `contactor-${n}.13`], [`contactor-${n}.14`, `motor-${n}.L+`], [`supply-${n}.M0`, `motor-${n}.M-`],
];
const ST = ['VAR_INPUT', '  Start : BOOL;', '  StopOK : BOOL;', 'END_VAR', 'VAR_OUTPUT', '  Run : BOOL;', 'END_VAR',
  'Run := (Start OR Run) AND StopOK;'].join('\n');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: [
    '--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--use-gl=angle',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  // The ready-made starters live in a menu: open it, then choose, as a person would.
  const starter = async selector => { await page.click('[data-starters] > summary'); await page.waitForSelector(`${selector}`, { visible: true }); await page.click(selector); };
  const clickText = async text => {
    const ok = await page.evaluate(label => {
      const b = [...document.querySelectorAll('button')].find(el => el.textContent.trim() === label);
      if (!b || b.disabled) return false; b.click(); return true;
    }, text);
    assert.ok(ok, `Expected enabled button: ${text}`);
  };
  const wire = async (a, b) => {
    await page.click(`[data-terminal-id="${a}"]`);
    await page.waitForFunction(id => document.querySelector(`[data-terminal-id="${id}"]`)?.classList.contains('selected'), {}, a);
    await page.click(`[data-terminal-id="${b}"]`);
  };
  const status = (id, want, timeout = 9000) => page.waitForFunction((dev, expected) =>
    document.querySelector(`[data-device-id="${dev}"] .sandbox-device-status`)?.textContent.trim() === expected,
    { timeout }, id, want);
  const statusNow = id => page.$eval(`[data-device-id="${id}"] .sandbox-device-status`, e => e.textContent.trim());
  const toggle = id => page.click(`[data-device-id="${id}"] .sandbox-operate`);
  const lamp = name => page.evaluate(n => [...document.querySelectorAll('.sandbox-lamps span')]
    .find(e => e.textContent.trim() === n)?.classList.contains('lit') ?? null, name);
  const paused = () => page.waitForFunction(() => [...document.querySelectorAll('.sandbox-toolbar button')]
    .some(b => b.textContent.trim() === '▶ Run' && !b.disabled), { timeout: 7000 });
  try {
    await page.setViewport({ width: 1440, height: 940, deviceScaleFactor: 1 });
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0', timeout: 20000 });
    await page.waitForSelector('.sandbox-toolbar');
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-starters]');

    // 1. Two complete panels: two supplies, two PLCs, two of each device, all wired by clicking terminals.
    await starter('[data-layout-two-panels]');
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 12, { timeout: 8000 });
    for (const [a, b] of [...panel(1), ...panel(2)]) await wire(a, b);
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-wire-list > div').length === 22, { timeout: 8000 });
    await page.waitForSelector('[data-plc-tab="plc-2"]');
    assert.equal(await page.$$eval('[data-plc-tab]', n => n.length), 2, 'One program tab per PLC');

    // 2. PLC 1 gets the Ladder latch; PLC 2 gets a Structured Text latch. Separate programs, separate languages.
    await page.click('[data-plc-tab="plc-1"]');
    await clickText('Load editable latch example');
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-contact').length === 3);
    await page.click('[data-plc-tab="plc-2"]');
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-contact').length === 1, { timeout: 6000 }); // blank program
    await clickText('Structured Text (ST)');
    await page.waitForSelector('#sandbox-st-source');
    await page.click('#sandbox-st-source');
    await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
    await page.keyboard.type(ST);
    await page.waitForFunction(() => document.querySelector('.sandbox-st-status strong')?.textContent.trim() === 'Compiler OK');
    await clickText('Compile & activate ST');
    await page.waitForFunction(() => document.querySelector('[data-plc-tab="plc-2"]')?.classList.contains('active'));
    // Back on PLC 1 it is still Ladder with its latch.
    await page.click('[data-plc-tab="plc-1"]');
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-contact').length === 3, { timeout: 6000 });

    // 3. Run. Panel 1 starts and seals in; panel 2 is untouched.
    await clickText('▶ Run');
    await toggle('start-1');
    await status('motor-1', 'RUNNING');
    assert.equal(await statusNow('motor-2'), 'STOPPED', 'Panel 2 must not move when panel 1 starts');
    assert.equal(await statusNow('contactor-2'), 'COIL OFF');
    await toggle('start-1'); // release
    await sleep(700);
    assert.equal(await statusNow('motor-1'), 'RUNNING', 'PLC 1 latched the motor');

    // 4. Panel 2 (a different PLC, a different language) starts, seals in and stops on its own.
    await toggle('start-2');
    await status('motor-2', 'RUNNING');
    await toggle('start-2');
    await sleep(700);
    assert.equal(await statusNow('motor-2'), 'RUNNING', 'PLC 2 (Structured Text) latched its motor');
    // The live I/O lamps follow the selected PLC.
    await page.click('[data-plc-tab="plc-2"]');
    await page.waitForFunction(() => /Live I\/O · plc-2/.test(document.querySelector('.sandbox-status')?.textContent ?? ''));
    assert.equal(await lamp('PlcPowered'), true);
    assert.equal(await lamp('Run'), true);
    await toggle('stop-1');
    await status('motor-1', 'STOPPED');
    assert.equal(await statusNow('motor-2'), 'RUNNING', 'Stopping panel 1 must not stop panel 2');
    await toggle('stop-1');
    await toggle('stop-2');
    await status('motor-2', 'STOPPED');
    await toggle('stop-2');

    // 5. Signalling between PLCs over the netlist. With the supplies isolated nothing crosses; tie the two
    //    commons together and wire PLC 1's output to PLC 2's input, and PLC 2 now starts from PLC 1.
    await clickText('Pause'); await paused();
    await wire('plc-1.Q0.0', 'plc-2.I0.0');
    await clickText('Reset scan state');
    await clickText('▶ Run');
    await toggle('start-1');
    await status('motor-1', 'RUNNING');
    await sleep(900);
    assert.equal(await statusNow('motor-2'), 'STOPPED', 'No shared common yet: the supplies are isolated, nothing crosses');
    assert.equal(await lamp('Start'), false);
    await toggle('start-1'); await toggle('stop-1'); await sleep(500); await toggle('stop-1');
    await clickText('Pause'); await paused();
    await wire('supply-1.M0', 'supply-2.M0');
    await clickText('Reset scan state');
    await clickText('▶ Run');
    await toggle('start-1');
    await status('motor-1', 'RUNNING');
    await status('motor-2', 'RUNNING'); // PLC 2 started because PLC 1's Q0.0 reached its I0.0
    assert.equal(await lamp('Start'), true, 'PLC 2 sees its own Start input driven from PLC 1');

    // 6. Both PLCs and both programs are part of the project and survive a reload.
    await clickText('Pause'); await paused();
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-plc-tab="plc-2"]');
    assert.equal(await page.$$eval('.sandbox-device', n => n.length), 12);
    await page.click('[data-plc-tab="plc-2"]');
    await page.waitForFunction(() => /Compiler OK/.test(document.querySelector('.sandbox-st-status')?.textContent ?? ''), { timeout: 6000 });
    assert.ok((await page.$eval('#sandbox-st-source', e => e.value)).includes('(Start OR Run) AND StopOK'), 'PLC 2 ST survived reload');
    await page.click('[data-plc-tab="plc-1"]');
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-contact').length === 3, { timeout: 6000 });

    // 7. A phone-width screen keeps the PLC tabs usable with no horizontal scroll.
    await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 1 });
    await sleep(400);
    const overflow = await page.evaluate(() => {
      if (document.documentElement.scrollWidth <= window.innerWidth + 1) return null;
      return [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > window.innerWidth + 1 && !el.closest('[class*="sandbox-3d"]') && !el.closest('canvas'))
        .slice(0, 8).map(el => `${el.tagName}.${String(el.className).slice(0, 40)}`);
    });
    assert.equal(overflow, null, `no horizontal overflow at 390px: ${JSON.stringify(overflow)}`);
    assert.ok(await page.$('[data-plc-tab="plc-2"]'));
    assert.deepEqual(errors.filter(e => !/favicon|WebGL|GPU stall|swiftshader/i.test(e)), [], 'No page errors');
    console.log('P7 multi-PLC browser E2E PASS');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
