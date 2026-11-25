/** Real-Chrome acceptance for R06: compressed-air supply, regulator and cylinder, built from an empty floor.
 *  Pump button -> compressor motor coil; air line compressor -> regulator -> cylinder; EXT button -> cylinder solenoid.
 *  Case A: regulator 4 bar. The receiver builds pressure, the cylinder extends and reports its 4 bar working pressure.
 *  Case B: regulator 1 bar (below the minimum working pressure). The same wiring cannot move the rod: LOW AIR PRESSURE. */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function runCase(browser, setpoint, outcome) {
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
  const statusOf = id => page.$eval(`[data-device-id="${id}"] .sandbox-device-status`, e => e.textContent.trim());
  const operate = id => page.evaluate(i => document.querySelector(`[data-device-id="${i}"] .sandbox-operate`).click(), id);
  try {
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.sandbox-palette-item:not([disabled])');
    await page.click('[data-p5-view="logical"]');
    await page.click('[data-p5-dock-tab="diagnostics"]');
    await page.waitForSelector('.sandbox-wire-list');
    for (const l of ['24V supply', 'START NO', 'START NO', 'Air compressor with receiver', 'Air pressure regulator', 'Pneumatic cylinder']) { await place(l); await sleep(90); }
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 6, { timeout: 8000 });
    const [PS, PUMP, EXT, COMP, REG, CYL] = ['supply-1', 'start-2', 'start-3', 'compressor-4', 'air-regulator-5', 'cylinder-6'];
    for (const [a, b] of [[`${PS}.P24`, `${PUMP}.A`], [`${PUMP}.B`, `${COMP}.A1`], [`${COMP}.A2`, `${PS}.M0`], [`${PS}.P24`, `${EXT}.A`], [`${EXT}.B`, `${CYL}.EXT+`], [`${CYL}.M-`, `${PS}.M0`],
      [`${COMP}.AIR`, `${REG}.AIR_IN`], [`${REG}.AIR_OUT`, `${CYL}.AIR`]]) await wire(a, b);
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-wire-list > div').length === 8, { timeout: 8000 });
    // Regulator setting through the real inspector.
    if (await page.$eval('.p5-panel-toggles button:nth-child(2)', e => e.getAttribute('aria-pressed') !== 'true')) await page.click('.p5-panel-toggles button:nth-child(2)');
    await page.evaluate(i => document.querySelector(`[data-device-id="${i}"] .sandbox-inspect-link`).click(), REG);
    await page.waitForSelector('[data-param="setpointBar"]');
    await page.click('[data-param="setpointBar"]', { clickCount: 3 });
    await page.keyboard.type(String(setpoint)); await page.keyboard.press('Enter');
    await sleep(500);
    assert.equal(await page.$eval('[data-param="setpointBar"]', e => e.value), String(setpoint));
    assert.ok(await clickText('▶ Run'), 'run');
    // Without the pump running there is no air at all.
    assert.match(await statusOf(COMP), /^0\.0 bar/);
    await operate(PUMP);
    await page.waitForFunction(d => /PUMPING/.test(document.querySelector(`[data-device-id="${d}"] .sandbox-device-status`)?.textContent ?? ''), { timeout: 20000, polling: 100 }, COMP);
    await page.waitForFunction(d => { const m = /([\d.]+) bar/.exec(document.querySelector(`[data-device-id="${d}"] .sandbox-device-status`)?.textContent ?? ''); return m && Number(m[1]) >= 5; }, { timeout: 30000, polling: 100 }, COMP);
    console.log('  receiver built up:', await statusOf(COMP), '| regulator:', await statusOf(REG));
    await operate(EXT);
    if (outcome === 'extends') {
      await page.waitForFunction(d => /EXTENDED/.test(document.querySelector(`[data-device-id="${d}"] .sandbox-device-status`)?.textContent ?? ''), { timeout: 15000, polling: 100 }, CYL);
      const s = await statusOf(CYL);
      assert.match(s, new RegExp(`${setpoint}\\.0 bar`), 'cylinder reports the regulated pressure: ' + s);
      return s;
    }
    await page.waitForFunction(d => /LOW AIR PRESSURE/.test(document.querySelector(`[data-device-id="${d}"] .sandbox-device-status`)?.textContent ?? ''), { timeout: 15000, polling: 100 }, CYL);
    const s = await statusOf(CYL);
    assert.match(s, /RETRACTED/); assert.match(s, /LOW AIR PRESSURE/);
    return s;
  } finally {
    assert.deepEqual(errors.filter(e => !/WebGL|GPU stall|favicon|swiftshader/i.test(e)), []);
    await page.close();
  }
}
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    console.log('A. regulator 4 bar:');
    console.log('   cylinder =', await runCase(browser, 4, 'extends'));
    console.log('B. regulator 1 bar (below the 1.5 bar minimum):');
    console.log('   cylinder =', await runCase(browser, 1, 'blocked'));
    console.log('R13 PNEUMATICS BROWSER PASS');
  } catch (e) { console.error(e); process.exitCode = 1; } finally { await browser.close(); }
})();
