/** Real-Chrome check of the two new device types, each authored from an empty floor through the UI.
 *  A. A hard-wired start/stop seal-in on a control relay with NO PLC on the page: START latches the relay, its NO
 *     contact lights RUN, its NC contact drops IDLE, STOP releases it.
 *  B. A pneumatic station: a 16/16 PLC (tags renamed Go/Extended/Retracted/Ext/Ret) drives a cylinder's two solenoids from
 *     a Structured Text program that reads its limit switches; the card shows RETRACTED, then MOVING n%, then EXTENDED
 *     while a button is held, and RETRACTED again after release. Everything is read from worker-driven DOM.
 */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ST = ['VAR_INPUT', '  Go : BOOL;', '  Extended : BOOL;', '  Retracted : BOOL;', 'END_VAR', 'VAR_OUTPUT', '  Ext : BOOL;', '  Ret : BOOL;', 'END_VAR',
  'Ext := Go AND NOT Extended;', 'Ret := NOT Go AND NOT Retracted;'].join('\n');
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: [
    '--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--use-gl=angle',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.setViewport({ width: 1440, height: 940, deviceScaleFactor: 1 });
  const original = page.click.bind(page);
  page.click = async (selector, options) => { await page.$eval(selector, el => el.scrollIntoView({ block: 'center', inline: 'center' })); return original(selector, options); };
  const clickText = async text => {
    const ok = await page.evaluate(label => {
      const b = [...document.querySelectorAll('button')].find(el => el.textContent.trim() === label);
      if (!b || b.disabled) return false; b.click(); return true;
    }, text);
    assert.ok(ok, `Expected enabled button "${text}"`);
  };
  const place = label => page.evaluate(l => [...document.querySelectorAll('.sandbox-palette-item')].find(b => b.querySelector('strong')?.textContent.trim() === l).click(), label);
  const wire = async (a, b) => {
    await page.click(`[data-terminal-id="${a}"]`);
    await page.waitForFunction(id => document.querySelector(`[data-terminal-id="${id}"]`)?.classList.contains('selected'), {}, a);
    await page.click(`[data-terminal-id="${b}"]`);
  };
  const statusOf = id => page.$eval(`[data-device-id="${id}"] .sandbox-device-status`, e => e.textContent.trim());
  const status = (id, want, t = 12000) => page.waitForFunction((d, w) => document.querySelector(`[data-device-id="${d}"] .sandbox-device-status`)?.textContent.trim() === w, { timeout: t }, id, want);
  const press = id => page.evaluate(i => document.querySelector(`[data-device-id="${i}"] .sandbox-operate`).click(), id);
  const paused = () => page.waitForFunction(() => [...document.querySelectorAll('.sandbox-toolbar button')].some(b => b.textContent.trim() === '▶ Run' && !b.disabled), { timeout: 8000 });
  const rename = async (selector, name) => { await page.click(selector, { clickCount: 3 }); await page.keyboard.type(name); await page.keyboard.press('Enter'); };
  try {
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.sandbox-palette-item');

    /* ---- A. hard-wired relay latch, no PLC ---- */
    for (const l of ['24V supply', 'START NO', 'STOP NC', '24V control relay', '24V pilot lamp', '24V pilot lamp']) { await place(l); await sleep(70); }
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 6, { timeout: 8000 });
    const [PS, START, STOP, K, RUN, IDLE] = ['supply-1', 'start-2', 'stop-3', 'relay-4', 'lamp-5', 'lamp-6'];
    for (const [a, b] of [[`${PS}.P24`, `${STOP}.A`], [`${STOP}.B`, `${START}.A`], [`${STOP}.B`, `${K}.13`], [`${START}.B`, `${K}.A1`], [`${K}.14`, `${K}.A1`], [`${K}.A2`, `${PS}.M0`],
      [`${PS}.P24`, `${K}.23`], [`${K}.24`, `${RUN}.L+`], [`${RUN}.M-`, `${PS}.M0`], [`${PS}.P24`, `${K}.21`], [`${K}.22`, `${IDLE}.L+`], [`${IDLE}.M-`, `${PS}.M0`]]) await wire(a, b);
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-wire-list > div').length === 12, { timeout: 8000 });
    assert.equal(await page.$$eval('[data-plc-tab]', n => n.length), 0, 'No PLC anywhere');
    assert.equal(await page.evaluate(() => /Virtual PLC/.test([...document.querySelectorAll('.sandbox-device')].map(d => d.textContent).join(' '))), false);
    await clickText('▶ Run');
    await status(IDLE, 'ILLUMINATED');
    assert.equal(await statusOf(K), 'COIL OFF');
    await press(START); await status(K, 'COIL ON');
    await status(RUN, 'ILLUMINATED'); await status(IDLE, 'OFF'); // NO contact closed, NC contact open
    await press(START); await sleep(700);
    assert.equal(await statusOf(K), 'COIL ON', 'Sealed in by its own 13-14 contact');
    await press(STOP); await status(K, 'COIL OFF');
    await status(RUN, 'OFF'); await status(IDLE, 'ILLUMINATED');
    await press(STOP); await sleep(600);
    assert.equal(await statusOf(K), 'COIL OFF', 'Releasing STOP does not restart it');
    console.log('A. hard-wired relay seal-in with no PLC');

    /* ---- B. pneumatic station on a 16/16 PLC ---- */
    await clickText('Pause'); await paused();
    await clickText('New blank project');
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 0, { timeout: 6000 });
    await sleep(500); // let the cleared project be saved before reloading (reloading also restarts the id counter)
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 0, { timeout: 6000 });
    await page.waitForSelector('.sandbox-palette-item');
    for (const l of ['24V supply', 'Virtual PLC 16/16', 'START NO', 'Pneumatic cylinder']) { await place(l); await sleep(70); }
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 4, { timeout: 8000 });
    const [S2, P, GO, C] = ['supply-1', 'plc16-2', 'start-3', 'cylinder-4'];
    for (const [a, b] of [[`${S2}.P24`, `${P}.L+`], [`${S2}.M0`, `${P}.M`], [`${S2}.P24`, `${GO}.A`], [`${GO}.B`, `${P}.I0.0`], [`${S2}.P24`, `${C}.L+`],
      [`${C}.EXT_LS`, `${P}.I0.1`], [`${C}.RET_LS`, `${P}.I0.2`], [`${P}.Q0.0`, `${C}.EXT+`], [`${P}.Q0.1`, `${C}.RET+`], [`${S2}.M0`, `${C}.M-`]]) await wire(a, b);
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-wire-list > div').length === 10, { timeout: 8000 });
    // Name the terminals. The untouched placeholder program follows the rename, so even I0.0 and Q0.0 can be named at once.
    for (const [sel, name] of [['[data-io-input="I0.0"]', 'Go'], ['[data-io-input="I0.1"]', 'Extended'], ['[data-io-input="I0.2"]', 'Retracted'],
      ['[data-io-output="Q0.0"]', 'Ext'], ['[data-io-output="Q0.1"]', 'Ret']]) {
      await rename(sel, name);
      await page.waitForFunction((s, n) => document.querySelector(s).value === n && !/Renaming would break/.test(document.querySelector('[role="alert"].sandbox-alert')?.textContent ?? ''), { timeout: 6000 }, sel, name);
    }
    await clickText('Structured Text (ST)');
    await page.waitForSelector('#sandbox-st-source');
    await page.click('#sandbox-st-source');
    await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
    await page.keyboard.type(ST);
    await page.waitForFunction(() => document.querySelector('.sandbox-st-status strong')?.textContent.trim() === 'Compiler OK');
    await clickText('Compile & activate ST');
    await sleep(300);
    await clickText('▶ Run');
    await status(C, 'RETRACTED');
    await press(GO);
    // The rod really travels: the card shows a moving percentage before it reaches EXTENDED.
    await page.waitForFunction(id => /^MOVING \d+%$/.test(document.querySelector(`[data-device-id="${id}"] .sandbox-device-status`)?.textContent.trim() ?? ''), { timeout: 8000 }, C);
    await status(C, 'EXTENDED');
    // The PLC sees the limit switch one or two scans after the rod arrives (the same scan lag a real controller has).
    await page.waitForFunction(() => [...document.querySelectorAll('.sandbox-lamps span')].find(e => e.textContent.trim() === 'Extended')?.classList.contains('lit'), { timeout: 3000 });
    await page.waitForFunction(() => ![...document.querySelectorAll('.sandbox-lamps span')].find(e => e.textContent.trim() === 'Ext')?.classList.contains('lit'), { timeout: 3000 });
    await press(GO);
    await status(C, 'RETRACTED');
    console.log('B. PLC-driven pneumatic cylinder with limit switches');

    // Both devices are ordinary project parts: the station survives a reload.
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 4, { timeout: 8000 });
    assert.equal(await statusOf(C), 'RETRACTED');
    await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 1 });
    await sleep(400);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false, 'no horizontal overflow at 390px');
    assert.deepEqual(errors.filter(e => !/favicon|WebGL|GPU stall|swiftshader/i.test(e)), [], 'No page errors');
    console.log('Relay and cylinder browser E2E PASS');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
