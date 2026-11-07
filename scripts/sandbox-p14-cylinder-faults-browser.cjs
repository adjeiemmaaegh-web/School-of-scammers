/** Real-Chrome check of cylinder faults and the stack light, authored from an empty floor through the UI.
 *  A 16/16 PLC (Go/Extended/Retracted -> Ext/Ret/Green/Red) runs a cylinder and a stack light. The stack light shows RED
 *  while idle and GREEN while the button is held. An instructor injects "Cylinder: no air supply": the rod does not move
 *  and the card shows the alarm. Replacing the cylinder (paused) clears it and the station works again. Then a dead
 *  EXTENDED limit switch is injected: the rod reaches the end but the card never reports EXTENDED (the card shows a travel alarm).
 */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ST = ['VAR_INPUT', '  Go : BOOL;', '  Extended : BOOL;', '  Retracted : BOOL;', 'END_VAR', 'VAR_OUTPUT', '  Ext : BOOL;', '  Ret : BOOL;', '  Green : BOOL;', '  Red : BOOL;', 'END_VAR',
  'Ext := Go AND NOT Extended;', 'Ret := NOT Go AND NOT Retracted;', 'Green := Go;', 'Red := NOT Go;'].join('\n');
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
  const statusMatch = (id, re, t = 12000) => page.waitForFunction((d, src) => new RegExp(src).test(document.querySelector(`[data-device-id="${d}"] .sandbox-device-status`)?.textContent.trim() ?? ''), { timeout: t }, id, re);
  const press = id => page.evaluate(i => document.querySelector(`[data-device-id="${i}"] .sandbox-operate`).click(), id);
  const paused = () => page.waitForFunction(() => [...document.querySelectorAll('.sandbox-toolbar button')].some(b => b.textContent.trim() === '▶ Run' && !b.disabled), { timeout: 8000 });
  const rename = async (selector, name) => { await page.click(selector, { clickCount: 3 }); await page.keyboard.type(name); await page.keyboard.press('Enter'); };
  const inject = async (kind, target) => {
    await page.select('[data-fault-kind]', kind);
    await page.waitForFunction(t => [...document.querySelectorAll('[data-fault-target] option')].some(o => o.value === t), {}, target);
    await page.select('[data-fault-target]', target);
    await page.click('[data-fault-inject]');
    await page.waitForFunction(() => document.querySelectorAll('[data-fault-item]').length === 1, { timeout: 6000 });
  };
  try {
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.sandbox-palette-item');
    for (const l of ['24V supply', 'Virtual PLC 16/16', 'START NO', 'Pneumatic cylinder', 'Stack light (R/Y/G)']) { await place(l); await sleep(70); }
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 5, { timeout: 8000 });
    const [S, P, GO, C, L] = ['supply-1', 'plc16-2', 'start-3', 'cylinder-4', 'stacklight-5'];
    for (const [a, b] of [[`${S}.P24`, `${P}.L+`], [`${S}.M0`, `${P}.M`], [`${S}.P24`, `${GO}.A`], [`${GO}.B`, `${P}.I0.0`], [`${S}.P24`, `${C}.L+`],
      [`${C}.EXT_LS`, `${P}.I0.1`], [`${C}.RET_LS`, `${P}.I0.2`], [`${P}.Q0.0`, `${C}.EXT+`], [`${P}.Q0.1`, `${C}.RET+`], [`${S}.M0`, `${C}.M-`],
      [`${P}.Q0.2`, `${L}.G`], [`${P}.Q0.3`, `${L}.R`], [`${S}.M0`, `${L}.M-`]]) await wire(a, b);
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-wire-list > div').length === 13, { timeout: 8000 });
    for (const [sel, name] of [['[data-io-input="I0.0"]', 'Go'], ['[data-io-input="I0.1"]', 'Extended'], ['[data-io-input="I0.2"]', 'Retracted'],
      ['[data-io-output="Q0.0"]', 'Ext'], ['[data-io-output="Q0.1"]', 'Ret'], ['[data-io-output="Q0.2"]', 'Green'], ['[data-io-output="Q0.3"]', 'Red']]) {
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

    /* ---- healthy station + stack light ---- */
    await clickText('▶ Run');
    await status(C, 'RETRACTED');
    await status(L, 'R');
    await press(GO);
    await status(L, 'G');
    await status(C, 'EXTENDED');
    await press(GO);
    await status(C, 'RETRACTED');
    await status(L, 'R');
    console.log('A. PLC-driven cylinder + stack light (red idle, green while held)');

    /* ---- no air ---- */
    await inject('cylinder-no-air', C);
    await press(GO);
    await statusMatch(C, '^RETRACTED · AIR PRESSURE UNAVAILABLE$', 8000);
    await sleep(1500);
    assert.match(await statusOf(C), /^RETRACTED · /, 'The rod never moved');
    await press(GO);
    await clickText('Pause'); await paused();
    await page.select('[data-repair-target]', C);
    await page.click('[data-repair-button]');
    await page.waitForFunction(() => document.querySelectorAll('[data-fault-item]').length === 0, { timeout: 6000 });
    await clickText('▶ Run');
    await status(C, 'RETRACTED'); // the latched alarm was cleared by the repair
    await press(GO);
    await status(C, 'EXTENDED');
    await press(GO);
    await status(C, 'RETRACTED');
    console.log('B. no-air fault: alarm shown, rod stays put, replacing the cylinder clears fault and alarm');

    /* ---- dead EXTENDED limit switch ---- */
    await inject('cylinder-ext-switch-dead', C);
    await press(GO);
    await statusMatch(C, 'TRAVEL TIMEOUT', 10000);
    assert.doesNotMatch(await statusOf(C), /^EXTENDED/, 'The dead switch never reports EXTENDED');
    console.log('C. dead EXTENDED switch: travel-timeout alarm, never reports EXTENDED');

    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 5, { timeout: 8000 });
    await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 1 });
    await sleep(400);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false, 'no horizontal overflow at 390px');
    assert.deepEqual(errors.filter(e => !/favicon|WebGL|GPU stall|swiftshader/i.test(e)), [], 'No page errors');
    console.log('Cylinder faults and stack light browser E2E PASS');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
