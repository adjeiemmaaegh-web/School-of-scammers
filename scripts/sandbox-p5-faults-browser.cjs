/** Actual Chrome P5 troubleshooting workflow on the real worker: an instructor injects a hidden fault,
 * the learner sees only the symptom and an alarm, diagnoses with the on-screen multimeter, replaces a
 * healthy part (no fix), then the faulty part (fixed). Also proves seeded faults repeat and that hidden
 * faults survive a reload. No fake UI state: every value below is read from worker-driven DOM.
 */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
const pairs = [
  ['supply-1.P24', 'plc-2.L+'], ['supply-1.M0', 'plc-2.M'],
  ['supply-1.P24', 'start-5.A'], ['start-5.B', 'plc-2.I0.0'],
  ['supply-1.P24', 'stop-6.A'], ['stop-6.B', 'plc-2.I0.1'],
  ['plc-2.Q0.0', 'contactor-3.A1'], ['supply-1.M0', 'contactor-3.A2'],
  ['supply-1.P24', 'contactor-3.13'], ['contactor-3.14', 'motor-4.L+'], ['supply-1.M0', 'motor-4.M-'],
];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
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
  const wire = async (a, b) => {
    await page.click(`[data-terminal-id="${a}"]`);
    await page.waitForFunction(id => document.querySelector(`[data-terminal-id="${id}"]`)
      ?.classList.contains('selected'), {}, a);
    await page.click(`[data-terminal-id="${b}"]`);
  };
  const paused = () => page.waitForFunction(() => [...document.querySelectorAll('.sandbox-toolbar button')]
    .some(b => b.textContent.trim() === '▶ Run' && !b.disabled), { timeout: 7000 });
  const motorIs = (running, timeout = 8000) => page.waitForFunction(expected =>
    document.querySelector('[data-device-id="motor-4"] .sandbox-device-status')?.textContent.trim() === expected,
    { timeout }, running ? 'RUNNING' : 'STOPPED');
  const faultCount = n => page.waitForFunction(count =>
    document.querySelectorAll('[data-fault-item]').length === count, { timeout: 6000 }, n);
  const faultLabel = () => page.$eval('[data-fault-item] > span:first-child', e => e.textContent.trim());
  const setSeed = async value => {
    await page.click('[data-fault-seed]', { clickCount: 3 });
    await page.keyboard.type(String(value));
  };
  try {
    await page.setViewport({ width: 1440, height: 940, deviceScaleFactor: 1 });
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0', timeout: 20000 });
    await page.waitForSelector('.sandbox-toolbar');
    await clickText('Place starter layout');
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 6);
    for (const [a, b] of pairs) await wire(a, b);
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-wire-list > div').length === 11);
    await clickText('Load editable latch example');
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-contact').length === 3);

    // 1. Instructor injects a HIDDEN contactor-coil fault. The learner-facing list names nothing.
    await page.waitForSelector('[data-fault-inject]');
    assert.equal(await page.$eval('[data-fault-kind]', e => e.value), 'contactor-coil-open');
    assert.equal(await page.$eval('[data-fault-target]', e => e.value), 'contactor-3');
    await page.click('[data-fault-hidden]');
    await page.click('[data-fault-inject]');
    await faultCount(1);
    assert.equal(await faultLabel(), 'Hidden fault 1');
    assert.equal(await page.$eval('[data-fault-item]', e => e.getAttribute('data-fault-state')), 'hidden');

    // 2. The learner runs it. The PLC commands Run but the motor never starts: a real, silent symptom.
    await clickText('▶ Run');
    await page.click('[data-device-id="start-5"] .sandbox-operate'); // press START
    await page.waitForFunction(() => [...document.querySelectorAll('.sandbox-lamps span')]
      .some(e => e.textContent.trim() === 'Run' && e.classList.contains('lit')), { timeout: 6000 });
    await motorIs(false);
    assert.equal(await page.$eval('[data-device-id="contactor-3"] .sandbox-device-status', e => e.textContent.trim()),
      'COIL OFF', 'The contactor must not pull in with an open coil, even though Q0.0 is on');

    // 3. After one second of commanded run without motion, a supervisory alarm names the SYMPTOM only.
    await page.waitForSelector('[data-alarm-item][data-alarm-code="START_FAILURE"][data-alarm-active="true"]',
      { timeout: 12000 });
    const alarmText = await page.$eval('[data-alarm-item][data-alarm-code="START_FAILURE"]', e => e.textContent);
    assert.ok(/not energized/i.test(alarmText), 'Alarm should state the symptom');
    assert.ok(!/open coil|winding|welded|stuck|broken|fault-\d|contactor-3/i.test(alarmText),
      `Alarm must not reveal the hidden cause: ${alarmText}`);

    // 4. Diagnose with the on-screen two-probe multimeter: 24 V is present across the coil terminals,
    //    yet the contactor did not pull in, so the coil itself is dead.
    await page.select('select[aria-label="Red meter probe"]', 'contactor-3.A1');
    await page.select('select[aria-label="Black meter probe"]', 'contactor-3.A2');
    await page.waitForFunction(() => document.querySelector('[data-meter-status]')?.textContent.trim() === '24 V DC',
      { timeout: 6000 });

    // 5. Reveal confirms the diagnosis.
    await page.click('[data-fault-reveal]');
    await page.waitForFunction(() => document.querySelector('[data-fault-item] > span:first-child')
      ?.textContent.trim() === 'Open coil in contactor-3', { timeout: 5000 });

    // 6. Parts can only be replaced with the plant isolated (paused).
    assert.equal(await page.$eval('[data-repair-button]', e => e.disabled), true, 'Replace is disabled while running');
    await clickText('Pause');
    await paused();
    assert.equal(await page.$eval('[data-repair-button]', e => e.disabled), false);

    // 7. Replacing a HEALTHY part does not fix anything (guess-and-replace is not rewarded).
    await page.select('[data-repair-target]', 'motor-4');
    await page.click('[data-repair-button]');
    await clickText('▶ Run');
    await sleep(900);
    assert.equal(await page.$eval('[data-device-id="motor-4"] .sandbox-device-status', e => e.textContent.trim()), 'STOPPED');
    assert.equal(await page.$$eval('[data-fault-item]', n => n.length), 1, 'Fault must remain after replacing a healthy part');

    // 8. Replacing the faulty contactor restores operation and the alarm clears.
    await clickText('Pause');
    await paused();
    await page.select('[data-repair-target]', 'contactor-3');
    await page.click('[data-repair-button]');
    await faultCount(0);
    await clickText('▶ Run');
    await motorIs(true);
    await page.waitForSelector('[data-alarm-item][data-alarm-code="START_FAILURE"][data-alarm-active="false"]',
      { timeout: 8000 });

    // 9. A seeded mystery fault is reproducible: same seed, same circuit, same fault.
    await setSeed(7);
    await page.click('[data-fault-mystery]');
    await faultCount(1);
    assert.equal(await faultLabel(), 'Hidden fault 1');
    await page.click('[data-fault-reveal]');
    await page.waitForFunction(() => !/^Hidden fault/.test(
      document.querySelector('[data-fault-item] > span:first-child')?.textContent.trim() ?? 'Hidden fault'));
    const first = await faultLabel();
    await page.click('[data-fault-clear]');
    await faultCount(0);
    await page.click('[data-fault-mystery]');
    await faultCount(1);
    await page.click('[data-fault-reveal]');
    await page.waitForFunction(() => !/^Hidden fault/.test(
      document.querySelector('[data-fault-item] > span:first-child')?.textContent.trim() ?? 'Hidden fault'));
    assert.equal(await faultLabel(), first, 'Same seed must inject the same fault');
    await page.click('[data-fault-clear]');
    await faultCount(0);

    // 10. A hidden fault is part of the project and survives a reload, still hidden.
    await clickText('Pause');
    await paused();
    // "Hide the cause" was ticked in step 1 and stays ticked; make sure rather than assume.
    if (!(await page.$eval('[data-fault-hidden]', e => e.checked))) await page.click('[data-fault-hidden]');
    await page.select('[data-fault-kind]', 'motor-open-winding');
    await page.click('[data-fault-inject]');
    await faultCount(1);
    await sleep(400); // let the project persist to browser storage
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-fault-item]', { timeout: 8000 });
    assert.equal(await page.$eval('[data-fault-item]', e => e.getAttribute('data-fault-state')), 'hidden');
    assert.equal(await faultLabel(), 'Hidden fault 1');

    assert.deepEqual(errors, [], 'Browser console/page errors');
    console.log('P5 FAULTS BROWSER PASS: hidden fault → silent symptom → alarm (symptom only) → meter diagnosis → ' +
      'healthy replace does nothing → correct replace restores + clears → seeded repeatability → persists across reload');
  } finally { await browser.close(); }
})().catch(e => { console.error('P5 FAULTS BROWSER FAIL', e.stack || String(e)); process.exitCode = 1; });
