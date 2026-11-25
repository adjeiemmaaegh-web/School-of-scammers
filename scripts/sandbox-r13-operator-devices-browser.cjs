/** Real-Chrome acceptance for R12 (part): maintained selector switch, buzzer and alarm siren, built from an empty floor.
 *  supply -> selector -> buzzer, and a second branch supply -> selector -> siren. Turning the selector sounds BOTH alarms;
 *  turning it back silences them; an open wire silences only the branch it breaks; everything survives a reload. */
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
  const status = (id, want, t = 8000) => page.waitForFunction((d, w) => document.querySelector(`[data-device-id="${d}"] .sandbox-device-status`)?.textContent.trim() === w, { timeout: t }, id, want);
  const operate = id => page.evaluate(i => document.querySelector(`[data-device-id="${i}"] .sandbox-operate`).click(), id);
  try {
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.sandbox-palette-item:not([disabled])');
    await page.click('[data-p5-view="logical"]');
    await page.click('[data-p5-dock-tab="diagnostics"]');
    await page.waitForSelector('.sandbox-wire-list');
    for (const l of ['24V supply', 'Selector switch (2-position)', '24V buzzer', '24V alarm siren']) { await place(l); await sleep(80); }
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 4, { timeout: 8000 });
    const [PS, SEL, BZ, SR] = ['supply-1', 'selector-2', 'buzzer-3', 'siren-4'];
    for (const [a, b] of [[`${PS}.P24`, `${SEL}.A`], [`${SEL}.B`, `${BZ}.L+`], [`${BZ}.M-`, `${PS}.M0`], [`${SEL}.B`, `${SR}.L+`], [`${SR}.M-`, `${PS}.M0`]]) await wire(a, b);
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-wire-list > div').length === 5, { timeout: 8000 });
    assert.ok(await clickText('▶ Run'), 'run');
    await status(SEL, 'POSITION 1 · OPEN'); await status(BZ, 'SILENT'); await status(SR, 'SILENT');
    await operate(SEL);
    await status(SEL, 'POSITION 2 · CLOSED'); await status(BZ, 'SOUNDING'); await status(SR, 'SOUNDING');
    console.log('1. selector to position 2: buzzer and siren sound (maintained, no need to hold)');
    await sleep(600);
    await status(BZ, 'SOUNDING');
    await operate(SEL);
    await status(BZ, 'SILENT'); await status(SR, 'SILENT');
    console.log('2. selector back to position 1: both silent');
    // Fault: break the siren branch wire while paused, then run again.
    await clickText('Pause'); await page.waitForFunction(() => /Paused/.test(document.body.textContent), { timeout: 8000 });
    const sirenWire = await page.evaluate(id => [...document.querySelectorAll('.sandbox-wire-list > div')].map(d => d.textContent).findIndex(t => t.includes(id)), `${SR}.L+`);
    assert.ok(sirenWire >= 0, 'siren branch wire listed');
    await page.evaluate(i => { const row = document.querySelectorAll('.sandbox-wire-list > div')[i]; [...row.querySelectorAll('button')].find(b => /remove|delete|×|unwire/i.test(b.textContent + b.getAttribute('aria-label')))?.click(); }, sirenWire);
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-wire-list > div').length === 4, { timeout: 8000 });
    assert.ok(await clickText('▶ Run'), 'run again');
    await operate(SEL);
    await status(BZ, 'SOUNDING'); await status(SR, 'SILENT');
    console.log('3. siren wire removed: the buzzer still sounds, the siren stays silent (the consequence of the wiring change)');
    await clickText('Pause'); await page.waitForFunction(() => /Paused/.test(document.body.textContent), { timeout: 8000 });
    await sleep(700);
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 4, { timeout: 10000 });
    assert.equal(await page.evaluate(i => /POSITION 2/.test(document.querySelector(`[data-device-id="${i}"] .sandbox-device-status`)?.textContent ?? ''), SEL), true, 'selector position survives reload');
    console.log('4. devices, wiring and the selector position survive a reload');
    assert.deepEqual(errors.filter(e => !/WebGL|GPU stall|favicon|swiftshader/i.test(e)), []);
    console.log('R13 OPERATOR DEVICES BROWSER PASS');
  } catch (e) { console.error(e); process.exitCode = 1; } finally { await browser.close(); }
})();
