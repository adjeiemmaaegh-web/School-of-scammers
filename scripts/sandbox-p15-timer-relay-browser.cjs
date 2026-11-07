/** Real-Chrome check of the on-delay relay and the device-settings mechanism, authored from an empty floor, no PLC.
 *  START feeds the timer coil. A "late" lamp is on its NO contact and an "early" lamp on its NC contact. The delay is set
 *  from the inspector (1000 ms), is refused while running, survives a reload, and the card moves COIL OFF -> TIMING n% ->
 *  CONTACTS ON while the lamps swap; releasing START resets everything at once.
 */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
const sleep = ms => new Promise(r => setTimeout(r, ms));
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
  const inspect = id => page.evaluate(i => document.querySelector(`[data-device-id="${i}"] .sandbox-inspect-link`).click(), id);
  try {
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.sandbox-palette-item');
    for (const l of ['24V supply', 'START NO', '24V on-delay relay', '24V pilot lamp', '24V pilot lamp']) { await place(l); await sleep(70); }
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 5, { timeout: 8000 });
    const [PS, GO, T, LATE, EARLY] = ['supply-1', 'start-2', 'timerelay-3', 'lamp-4', 'lamp-5'];
    for (const [a, b] of [[`${PS}.P24`, `${GO}.A`], [`${GO}.B`, `${T}.A1`], [`${T}.A2`, `${PS}.M0`], [`${PS}.P24`, `${T}.13`], [`${T}.14`, `${LATE}.L+`], [`${LATE}.M-`, `${PS}.M0`],
      [`${PS}.P24`, `${T}.21`], [`${T}.22`, `${EARLY}.L+`], [`${EARLY}.M-`, `${PS}.M0`]]) await wire(a, b);
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-wire-list > div').length === 9, { timeout: 8000 });
    assert.equal(await page.$$eval('[data-plc-tab]', n => n.length), 0, 'No PLC anywhere');

    // Set the delay from the inspector while paused.
    await inspect(T);
    await page.waitForSelector('[data-param="delayMs"]');
    assert.equal(await page.$eval('[data-param="delayMs"]', e => e.value), '2000', 'default dial');
    await page.click('[data-param="delayMs"]', { clickCount: 3 });
    await page.keyboard.type('1000');
    await page.keyboard.press('Enter');
    await sleep(300);

    await clickText('▶ Run');
    await status(T, 'COIL OFF');
    await status(EARLY, 'ILLUMINATED');
    assert.equal(await statusOf(LATE), 'OFF');
    // While running the dial is locked.
    assert.equal(await page.$eval('[data-param="delayMs"]', e => e.disabled), true, 'dial locked while running');
    await press(GO);
    await statusMatch(T, '^TIMING \\d+%$', 6000);
    assert.equal(await statusOf(LATE), 'OFF', 'late lamp still off while timing');
    await status(T, 'CONTACTS ON', 6000);
    await status(LATE, 'ILLUMINATED'); await status(EARLY, 'OFF');
    await press(GO); // release
    await status(T, 'COIL OFF', 6000);
    await status(LATE, 'OFF'); await status(EARLY, 'ILLUMINATED');
    // Re-press and release mid-delay: the timer resets, contacts never transfer.
    await press(GO);
    await statusMatch(T, '^TIMING \\d+%$', 6000);
    await press(GO);
    await status(T, 'COIL OFF', 6000);
    assert.equal(await statusOf(LATE), 'OFF');
    console.log('A. on-delay relay: delay set from the inspector, TIMING -> CONTACTS ON, instant release, reset on early release');

    // The setting persists in the project.
    await clickText('Pause'); await paused();
    await sleep(500);
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 5, { timeout: 8000 });
    await inspect(T);
    await page.waitForSelector('[data-param="delayMs"]');
    assert.equal(await page.$eval('[data-param="delayMs"]', e => e.value), '1000', 'delay survives reload');
    await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 1 });
    await sleep(400);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false, 'no horizontal overflow at 390px');
    assert.deepEqual(errors.filter(e => !/favicon|WebGL|GPU stall|swiftshader/i.test(e)), [], 'No page errors');
    console.log('On-delay relay browser E2E PASS');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
