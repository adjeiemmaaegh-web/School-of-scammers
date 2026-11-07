/** Real-Chrome check of configurable PLC I/O: on an empty floor, place a 16/16 controller, wire a button to an
 *  input in the SECOND bank (I1.7) and lamps to outputs in both banks, name the terminals, write a Structured
 *  Text program in those names, and see it drive the plant. A rename that would break the program is refused
 *  and the field reverts. The Ladder editor offers this PLC's names and not the classic ones. Names persist
 *  across a reload. A classic PLC placed beside it keeps its fixed names and shows no tag editor.
 */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ST = ['VAR_INPUT', '  Door : BOOL;', 'END_VAR', 'VAR_OUTPUT', '  Beacon : BOOL;', 'END_VAR', 'Beacon := Door;'].join('\n');
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
  const rename = async (selector, name) => {
    await page.click(selector, { clickCount: 3 });
    await page.keyboard.type(name);
    await page.keyboard.press('Enter');
  };
  const fieldValue = sel => page.$eval(sel, e => e.value);
  const status = (id, want, t = 12000) => page.waitForFunction((d, w) => document.querySelector(`[data-device-id="${d}"] .sandbox-device-status`)?.textContent.trim() === w, { timeout: t }, id, want);
  const paused = () => page.waitForFunction(() => [...document.querySelectorAll('.sandbox-toolbar button')].some(b => b.textContent.trim() === '▶ Run' && !b.disabled), { timeout: 8000 });
  try {
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.sandbox-palette-item');

    // 1. Build from the library: supply, 16/16 PLC, a button and two lamps.
    for (const l of ['24V supply', 'Virtual PLC 16/16', 'START NO', '24V pilot lamp', '24V pilot lamp']) { await place(l); await sleep(80); }
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 5, { timeout: 8000 });
    const [PS, PLC, BTN, L1, L2] = ['supply-1', 'plc16-2', 'start-3', 'lamp-4', 'lamp-5'];
    assert.equal(await page.$$eval('.sandbox-device', n => n.length), 5);
    for (const [a, b] of [[`${PS}.P24`, `${PLC}.L+`], [`${PS}.M0`, `${PLC}.M`], [`${PS}.P24`, `${BTN}.A`], [`${BTN}.B`, `${PLC}.I1.7`],
      [`${PLC}.Q1.7`, `${L1}.L+`], [`${L1}.M-`, `${PS}.M0`], [`${PLC}.Q0.0`, `${L2}.L+`], [`${L2}.M-`, `${PS}.M0`]]) await wire(a, b);
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-wire-list > div').length === 8, { timeout: 8000 });

    // 2. The tag editor is there with 16 + 16 neutral names, in two banks.
    await page.waitForSelector(`[data-io-map="${PLC}"]`);
    assert.equal(await page.$$eval('[data-io-input]', n => n.length), 16);
    assert.equal(await page.$$eval('[data-io-output]', n => n.length), 16);
    assert.equal(await fieldValue('[data-io-input="I1.7"]'), 'In15');
    assert.equal(await fieldValue('[data-io-output="Q1.7"]'), 'Out15');

    // 3. Name the terminals the program will use.
    await rename('[data-io-input="I1.7"]', 'Door');
    await page.waitForFunction(() => document.querySelector('[data-io-input="I1.7"]').value === 'Door');
    await rename('[data-io-output="Q1.7"]', 'Beacon');
    await sleep(300);
    assert.equal(await fieldValue('[data-io-output="Q1.7"]'), 'Beacon');
    assert.ok(await page.evaluate(() => [...document.querySelectorAll('.sandbox-lamps span')].some(e => e.textContent.trim() === 'Door')), 'Live I/O shows the new names');

    // 4. Program it in those names (Structured Text).
    await clickText('Structured Text (ST)');
    await page.waitForSelector('#sandbox-st-source');
    assert.ok(/In0/.test(await fieldValue('#sandbox-st-source')), 'The ST placeholder is for this PLC, not the classic latch');
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('button')].some(b => /Use start\/stop sample/.test(b.textContent))), false);
    await page.click('#sandbox-st-source');
    await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
    await page.keyboard.type(ST);
    await page.waitForFunction(() => document.querySelector('.sandbox-st-status strong')?.textContent.trim() === 'Compiler OK');
    await clickText('Compile & activate ST');
    await sleep(300);

    // 5. A rename that would break that program is refused, and the field shows the real name again.
    await rename('[data-io-input="I1.7"]', 'Gate');
    await page.waitForFunction(() => /Renaming would break the program/.test(document.querySelector('[role="alert"].sandbox-alert')?.textContent ?? ''), { timeout: 5000 });
    await page.waitForFunction(() => document.querySelector('[data-io-input="I1.7"]').value === 'Door', { timeout: 5000 });
    // A bad name is refused too.
    await rename('[data-io-input="I0.0"]', '1bad name');
    await page.waitForFunction(() => /not a valid tag name/.test(document.querySelector('[role="alert"].sandbox-alert')?.textContent ?? ''), { timeout: 5000 });
    await page.waitForFunction(() => document.querySelector('[data-io-input="I0.0"]').value === 'In0', { timeout: 5000 });
    // A duplicate is refused.
    await rename('[data-io-input="I0.1"]', 'door');
    await page.waitForFunction(() => /used by both/.test(document.querySelector('[role="alert"].sandbox-alert')?.textContent ?? ''), { timeout: 5000 });

    // 6. Run: the button on I1.7 lights the lamp on Q1.7; the lamp on Q0.0 stays dark.
    await clickText('▶ Run');
    await page.evaluate(id => document.querySelector(`[data-device-id="${id}"] .sandbox-operate`).click(), BTN);
    await status(L1, 'ILLUMINATED');
    assert.equal(await page.$eval(`[data-device-id="${L2}"] .sandbox-device-status`, e => e.textContent.trim()), 'OFF');
    assert.ok(await page.evaluate(() => [...document.querySelectorAll('.sandbox-lamps span')].find(e => e.textContent.trim() === 'Beacon')?.classList.contains('lit')));
    await page.evaluate(id => document.querySelector(`[data-device-id="${id}"] .sandbox-operate`).click(), BTN);
    await status(L1, 'OFF');
    await clickText('Pause'); await paused();

    // 7. The Ladder editor offers this PLC's names, and none of the classic ones.
    await clickText('Ladder (LD)');
    await page.waitForSelector('select[aria-label="Contact tag"]');
    const options = await page.$$eval('select[aria-label="Contact tag"] option', o => o.map(x => x.value));
    assert.ok(options.includes('Door') && options.includes('In0') && options.includes('Beacon'), `Ladder tags: ${options}`);
    assert.ok(!options.includes('Start') && !options.includes('StopOK') && !options.includes('Run'), 'No classic names on a 16/16 PLC');
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('button')].some(b => /Load editable latch example/.test(b.textContent))), false);

    // 8. Names (and the program) survive a reload.
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector(`[data-io-map="${PLC}"]`);
    assert.equal(await fieldValue('[data-io-input="I1.7"]'), 'Door');
    assert.equal(await fieldValue('[data-io-output="Q1.7"]'), 'Beacon');

    // 9. A classic PLC beside it keeps its fixed names and has no tag editor.
    await place('Virtual PLC');
    await page.waitForFunction(() => document.querySelectorAll('[data-plc-tab]').length === 2, { timeout: 8000 });
    // (the workbench restarts its id counter after a reload, so look the new tab up instead of guessing its id)
    const classicTab = await page.$$eval('[data-plc-tab]', tabs => tabs.map(t => t.getAttribute('data-plc-tab')).find(id => !id.startsWith('plc16')));
    await page.click(`[data-plc-tab="${classicTab}"]`);
    await page.waitForFunction(() => !document.querySelector('[data-io-map]'), { timeout: 5000 });
    assert.ok(await page.evaluate(() => [...document.querySelectorAll('.sandbox-lamps span')].some(e => e.textContent.trim() === 'StopOK')));
    await page.click(`[data-plc-tab="${PLC}"]`);
    await page.waitForSelector(`[data-io-map="${PLC}"]`);

    // 10. Phone width: the tag editor causes no sideways scroll.
    await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 1 });
    await sleep(400);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false, 'no horizontal overflow at 390px');
    assert.deepEqual(errors.filter(e => !/favicon|WebGL|GPU stall|swiftshader/i.test(e)), [], 'No page errors');
    console.log('Configurable I/O browser E2E PASS');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
