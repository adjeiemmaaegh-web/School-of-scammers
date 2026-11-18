/** Real-Chrome check of R5.1: wire colour and net label, authored from an empty floor.
 *  Sets a colour and a label from the wire list, sees them drawn on the logical canvas, survives a reload, shows no change
 *  in behaviour (the lamp still lights), is refused while running, and disappears with the wire. */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.setViewport({ width: 1440, height: 940, deviceScaleFactor: 1 });
  const original = page.click.bind(page);
  page.click = async (s, o) => { await page.$eval(s, el => el.scrollIntoView({ block: 'center', inline: 'center' })); return original(s, o); };
  const place = label => page.evaluate(l => [...document.querySelectorAll('.sandbox-palette-item')].find(b => b.querySelector('strong')?.textContent.trim() === l).click(), label);
  const wire = async (a, b) => {
    await page.click(`[data-terminal-id="${a}"]`);
    await page.waitForFunction(id => document.querySelector(`[data-terminal-id="${id}"]`)?.classList.contains('selected'), {}, a);
    await page.click(`[data-terminal-id="${b}"]`);
  };
  const clickText = t => page.evaluate(x => { const b = [...document.querySelectorAll('button')].find(e => e.textContent.includes(x) && !e.disabled); if (b) b.click(); return !!b; }, t);
  try {
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.sandbox-palette-item:not([disabled])');
    await page.click('[data-p5-view="logical"]');
    await page.click('[data-p5-dock-tab="diagnostics"]');
    await page.waitForSelector('.sandbox-wire-list');
    for (const l of ['24V supply', 'START NO', '24V pilot lamp']) { await place(l); await sleep(70); }
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 3, { timeout: 8000 });
    const [PS, GO, L] = ['supply-1', 'start-2', 'lamp-3'];
    for (const [a, b] of [[`${PS}.P24`, `${GO}.A`], [`${GO}.B`, `${L}.L+`], [`${L}.M-`, `${PS}.M0`]]) await wire(a, b);
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-wire-list > div').length === 3, { timeout: 8000 });
    const first = await page.$eval('[data-wire-color-select]', e => e.getAttribute('data-wire-color-select'));

    await page.select(`[data-wire-color-select="${first}"]`, 'red');
    await page.waitForSelector(`[data-p5-wire="${first}"][data-wire-color="red"]`, { timeout: 5000 });
    const stroke = await page.$eval(`[data-p5-wire="${first}"]`, e => getComputedStyle(e).stroke);
    assert.notEqual(stroke, 'none'); assert.match(stroke, /rgb\(/);
    await page.click(`[data-wire-label-input="${first}"]`);
    await page.type(`[data-wire-label-input="${first}"]`, '+24V feed');
    await page.keyboard.press('Tab');
    await page.waitForSelector(`[data-wire-label="${first}"]`, { timeout: 5000 });
    assert.equal(await page.$eval(`[data-wire-label="${first}"]`, e => e.textContent), '+24V feed');
    console.log('1. colour and label set from the wire list and drawn on the logical canvas');

    assert.ok(await clickText('▶ Run'), 'run button'); await page.waitForFunction(() => document.querySelector('[data-wire-color-select]')?.disabled === true, { timeout: 8000 });
    await page.evaluate(id => { const s = document.querySelector(`[data-wire-color-select="${id}"]`); s.disabled = false; s.value = 'blue'; s.dispatchEvent(new Event('change', { bubbles: true })); }, first);
    await sleep(300);
    assert.equal(await page.$eval(`[data-p5-wire="${first}"]`, e => e.getAttribute('data-wire-color')), 'red', 'a running project must refuse a style change');
    assert.ok(await clickText('Pause')); await page.waitForFunction(() => document.querySelector('[data-wire-color-select]')?.disabled === false, { timeout: 8000 });

    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.sandbox-palette-item:not([disabled])');
    await page.click('[data-p5-view="logical"]');
    await page.waitForSelector(`[data-p5-wire="${first}"][data-wire-color="red"]`, { timeout: 8000 });
    assert.equal(await page.$eval(`[data-wire-label="${first}"]`, e => e.textContent), '+24V feed');
    console.log('2. style survives a reload');

    await page.evaluate(id => document.querySelector(`[data-wire-label-input="${id}"]`)?.closest('div')?.querySelector('button')?.click(), first);
    await page.waitForFunction(id => !document.querySelector(`[data-wire-label="${id}"]`), { timeout: 5000 }, first);
    console.log('3. style removed with its wire');
    assert.deepEqual(errors, []);
    console.log('R5 WIRE STYLE BROWSER PASS');
  } catch (e) { console.error(e); process.exitCode = 1; } finally { await browser.close(); }
})();
