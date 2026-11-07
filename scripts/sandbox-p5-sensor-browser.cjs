/** Actual Chrome P5 sensor troubleshooting on the real worker. A hidden stuck-ON photoeye is injected
 * into the running sorting line. The learner sees the PLC input lamp lit with no part present and a
 * plain parcel wrongly rejected, proves the lie with the on-screen multimeter at the PLC terminal,
 * then replaces the sensor and sees correct sorting restored. Every value is read from worker-driven
 * DOM; nothing is injected into the page.
 */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
const connections = [
  ['supply-1.P24', 'plc-2.L+'], ['supply-1.M0', 'plc-2.M'],
  ['supply-1.P24', 'start-5.A'], ['start-5.B', 'plc-2.I0.0'],
  ['supply-1.P24', 'stop-6.A'], ['stop-6.B', 'plc-2.I0.1'],
  ['supply-1.P24', 'contactor-3.13'], ['supply-1.M0', 'contactor-3.A2'],
  ['plc-2.Q0.0', 'contactor-3.A1'], ['contactor-3.14', 'conveyor-4.L+'],
  ['supply-1.M0', 'conveyor-4.M-'],
  ['supply-1.P24', 'photoeye-7.L+'], ['supply-1.M0', 'photoeye-7.M'],
  ['photoeye-7.OUT', 'plc-2.I0.2'],
  ['plc-2.Q0.1', 'diverter-8.A1'], ['supply-1.M0', 'diverter-8.A2'],
];
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: [
    '--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--use-gl=angle',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const clickText = async text => {
    const ok = await page.evaluate(label => {
      const b = [...document.querySelectorAll('button')].find(el => el.textContent.trim() === label);
      if (!b || b.disabled) return false;
      b.click();
      return true;
    }, text);
    assert.ok(ok, `Expected enabled button: ${text}`);
  };
  const paused = () => page.waitForFunction(() => [...document.querySelectorAll('.sandbox-toolbar button')]
    .some(b => b.textContent.trim() === '▶ Run' && !b.disabled), { timeout: 7000 });
  const lampLit = (name, lit, timeout = 8000) => page.waitForFunction((n, want) =>
    [...document.querySelectorAll('.sandbox-lamps span')].some(e => e.textContent.trim() === n) &&
    [...document.querySelectorAll('.sandbox-lamps span')].find(e => e.textContent.trim() === n)
      .classList.contains('lit') === want, { timeout }, name, lit);
  const counter = (sel, value, timeout = 14000) => page.waitForFunction((s, v) =>
    document.querySelector(s)?.textContent === v, { timeout }, sel, value);
  const idle = () => page.waitForFunction(() => document.querySelector('.sandbox-sort-metrics')
    ?.textContent.includes('Current: empty'), { timeout: 14000 });
  try {
    await page.setViewport({ width: 1440, height: 940, deviceScaleFactor: 1 });
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0', timeout: 20000 });
    await page.waitForSelector('.sandbox-toolbar');
    await clickText('Place 3D sorting layout');
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device-list .sandbox-device').length === 8);
    for (const [from, to] of connections) {
      await page.click(`[data-terminal-id="${from}"]`);
      await page.waitForFunction(id => document.querySelector(`[data-terminal-id="${id}"]`)
        ?.classList.contains('selected'), {}, from);
      await page.click(`[data-terminal-id="${to}"]`);
    }
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-wire-list > div').length === 16);
    await clickText('Load sorting program example');
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-rung').length === 2);
    await clickText('▶ Run');
    await page.click('[data-device-id="start-5"] .sandbox-operate');
    await page.waitForFunction(() => document.querySelector('[data-device-id="conveyor-4"] .sandbox-device-status')
      ?.textContent === 'BELT MOVING', { timeout: 9000 });

    // 1. Control: a healthy line accepts a plain parcel, and the Photoeye lamp is dark when idle.
    await lampLit('Photoeye', false);
    await clickText('Feed plain parcel');
    await counter('[data-sort-accepted]', '1');
    assert.equal(await page.$eval('[data-sort-rejected]', e => e.textContent), '0');
    await idle();

    // 2. Instructor injects a HIDDEN stuck-ON photoeye while the line is running.
    await page.select('[data-fault-kind]', 'sensor-stuck');
    assert.equal(await page.$eval('[data-fault-target]', e => e.value), 'photoeye-7');
    assert.equal(await page.$eval('[data-fault-stuck-active]', e => e.value), 'on');
    await page.click('[data-fault-hidden]');
    await page.click('[data-fault-inject]');
    await page.waitForFunction(() => document.querySelectorAll('[data-fault-item]').length === 1, { timeout: 6000 });
    assert.equal(await page.$eval('[data-fault-item] > span:first-child', e => e.textContent.trim()), 'Hidden fault 1');

    // 3. The symptom: the PLC input lamp is lit with NO part present, and a plain parcel is rejected.
    await lampLit('Photoeye', true);
    assert.ok((await page.$eval('.sandbox-sort-metrics', e => e.textContent)).includes('Current: empty'),
      'No parcel is at the sensor, yet its input is lit');
    await clickText('Feed plain parcel');
    await counter('[data-sort-rejected]', '1');
    assert.equal(await page.$eval('[data-sort-accepted]', e => e.textContent), '1',
      'The plain parcel must not have been accepted');
    await idle();

    // 4. Prove the lie with the on-screen multimeter: 24 V at PLC input I0.2 with nothing at the eye.
    await page.select('select[aria-label="Red meter probe"]', 'plc-2.I0.2');
    await page.select('select[aria-label="Black meter probe"]', 'supply-1.M0');
    await page.waitForFunction(() => document.querySelector('[data-meter-status]')?.textContent.trim() === '24 V DC',
      { timeout: 6000 });

    // 5. Reveal confirms the diagnosis.
    await page.click('[data-fault-reveal]');
    await page.waitForFunction(() => document.querySelector('[data-fault-item] > span:first-child')
      ?.textContent.trim() === 'Sensor photoeye-7 output stuck ON', { timeout: 5000 });

    // 6. Replace the sensor with the plant isolated. Sorting is correct again.
    await clickText('Pause');
    await paused();
    await page.select('[data-repair-target]', 'photoeye-7');
    await page.click('[data-repair-button]');
    await page.waitForFunction(() => document.querySelectorAll('[data-fault-item]').length === 0, { timeout: 6000 });
    await clickText('▶ Run');
    await lampLit('Photoeye', false);
    await clickText('Feed plain parcel');
    await counter('[data-sort-accepted]', '2');
    assert.equal(await page.$eval('[data-sort-rejected]', e => e.textContent), '1');
    await idle();
    await clickText('Feed marked parcel');
    await counter('[data-sort-rejected]', '2');
    assert.equal(await page.$eval('[data-sort-accepted]', e => e.textContent), '2');

    assert.deepEqual(errors, [], 'Browser console/page errors');
    console.log('P5 SENSOR BROWSER PASS: hidden stuck-ON photoeye injected while running → lamp lit with no part → ' +
      'plain parcel wrongly rejected → multimeter shows 24 V at I0.2 → reveal → replace → correct sorting restored');
  } finally { await browser.close(); }
})().catch(e => { console.error('P5 SENSOR BROWSER FAIL', e.stack || String(e)); process.exitCode = 1; });
