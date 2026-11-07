/** Real-Chrome P6 workflow: scenarios run on the actual sandbox worker and are graded by outcome.
 *  A. Practice: wire + program (Structured Text) the start/stop starter from /scenario, "Check my work",
 *     run it for real, submit, see it recorded on the trade ladder, and survive a reload frozen.
 *  B. Assessment: employer assignment -> candidate exam conditions (no answers, no instructor controls) ->
 *     meter diagnosis of the hidden coil fault -> replace the right part -> result code -> employer review.
 *  C. A guess-and-replace candidate (fresh browser profile) is graded as NOT passed by the same grader.
 */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
const MOTOR = [
  ['ps.P24', 'plc.L+'], ['ps.M0', 'plc.M'], ['ps.P24', 'start.A'], ['start.B', 'plc.I0.0'],
  ['ps.P24', 'stop.A'], ['stop.B', 'plc.I0.1'], ['plc.Q0.0', 'con.A1'], ['ps.M0', 'con.A2'],
  ['ps.P24', 'con.13'], ['con.14', 'motor.L+'], ['ps.M0', 'motor.M-'],
];
const ST = ['VAR_INPUT', '  Start : BOOL;', '  StopOK : BOOL;', 'END_VAR', 'VAR_OUTPUT', '  Run : BOOL;', 'END_VAR',
  'Run := StopOK AND (Start OR Run);'].join('\n');
const b64url = obj => Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = s => JSON.parse(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function newPage(browser, errors) {
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setViewport({ width: 1440, height: 940, deviceScaleFactor: 1 });
  return page;
}
const tools = page => ({
  clickText: async text => {
    const ok = await page.evaluate(label => {
      const b = [...document.querySelectorAll('button')].find(el => el.textContent.trim() === label);
      if (!b || b.disabled) return false; b.click(); return true;
    }, text);
    assert.ok(ok, `Expected enabled button: ${text}`);
  },
  hasButton: text => page.evaluate(label => [...document.querySelectorAll('button')]
    .some(el => el.textContent.trim().includes(label)), text),
  wire: async (a, b) => {
    await page.click(`[data-terminal-id="${a}"]`);
    await page.waitForFunction(id => document.querySelector(`[data-terminal-id="${id}"]`)?.classList.contains('selected'), {}, a);
    await page.click(`[data-terminal-id="${b}"]`);
  },
  status: (id, timeout = 9000, want) => page.waitForFunction((dev, expected) =>
    document.querySelector(`[data-device-id="${dev}"] .sandbox-device-status`)?.textContent.trim() === expected,
    { timeout }, id, want),
  paused: () => page.waitForFunction(() => [...document.querySelectorAll('.sandbox-toolbar button')]
    .some(b => b.textContent.trim() === '▶ Run' && !b.disabled), { timeout: 7000 }),
  objective: id => page.$eval(`[data-objective="${id}"]`, e => e.getAttribute('data-objective-state')),
});
const resultText = page => page.$eval('[data-scenario-result]', e => e.textContent);
const waitResult = page => page.waitForSelector('[data-scenario-result]', { timeout: 8000 });

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: [
    '--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--use-gl=angle',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  try {
    /* ---------------- A. practice on the real sandbox ---------------- */
    {
      const page = await newPage(browser, errors); const t = tools(page);
      await page.goto(base + '/trade/plc', { waitUntil: 'networkidle0', timeout: 20000 });
      await page.waitForSelector('[data-scenario-card="plc-sbx-startstop"]');
      assert.equal(await page.$$eval('[data-scenario-card]', n => n.length), 4, 'The ladder lists four sandbox scenarios');
      await page.goto(base + '/scenario/plc-sbx-startstop?seed=1', { waitUntil: 'networkidle0', timeout: 20000 });
      await page.waitForSelector('[data-scenario="plc-sbx-startstop"][data-scenario-mode="learning"]');
      await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 6, { timeout: 8000 });
      assert.equal(await page.$$eval('.sandbox-wire-list > div', n => n.length), 0, 'Starter is unwired');
      assert.equal(await page.$$eval('[data-objective]', n => n.length), 6);
      for (const label of ['Place starter layout', 'Import JSON', 'Load editable latch example', 'Load tank control example', 'New blank project'])
        assert.equal(await t.hasButton(label), false, `${label} must be hidden in a scenario (it would hand over the answer)`);
      assert.equal(await page.$('[data-fault-inject]'), null, 'No instructor controls in a scenario');
      assert.equal(await page.$('details.sandbox-fault-instructor'), null);

      await t.clickText('Check my work');
      await page.waitForFunction(() => document.querySelector('[data-objective="starts"]')?.getAttribute('data-objective-state') === 'fail');
      assert.equal(await t.objective('powered'), 'fail');
      const reason = await page.$eval('[data-objective="starts"]', e => e.textContent);
      assert.ok(/START did not make the motor run|could not|not powered|did not/i.test(reason), `Reason shown: ${reason}`);

      for (const [a, b] of MOTOR) await t.wire(a, b);
      await page.waitForFunction(() => document.querySelectorAll('.sandbox-wire-list > div').length === 11);
      // The ST tab must not offer the finished latch as a starting point.
      await t.clickText('Structured Text (ST)');
      await page.waitForSelector('#sandbox-st-source');
      const initialSt = await page.$eval('#sandbox-st-source', e => e.value);
      assert.ok(!/StopOK AND/.test(initialSt), `ST starter must not contain the answer: ${initialSt}`);
      assert.equal(await t.hasButton('Use start/stop sample'), false);
      await page.click('#sandbox-st-source');
      await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
      await page.keyboard.type(ST);
      await page.waitForFunction(() => document.querySelector('.sandbox-st-status strong')?.textContent.trim() === 'Compiler OK');
      await t.clickText('Compile & activate ST');
      await sleep(300);

      // Grading is by outcome: ST is a different solution from the Ladder reference, and it passes.
      await t.clickText('Check my work');
      await page.waitForFunction(() => [...document.querySelectorAll('[data-objective]')]
        .every(e => e.getAttribute('data-objective-state') === 'pass'), { timeout: 12000 });

      // And the real thing agrees with the grader.
      await t.clickText('▶ Run');
      await page.click('[data-device-id="start"] .sandbox-operate');
      await t.status('motor', 9000, 'RUNNING');
      await page.click('[data-device-id="start"] .sandbox-operate'); // release
      await sleep(700);
      assert.equal(await page.$eval('[data-device-id="motor"] .sandbox-device-status', e => e.textContent.trim()), 'RUNNING', 'sealed in');
      await page.click('[data-device-id="stop"] .sandbox-operate');
      await t.status('motor', 9000, 'STOPPED');

      await t.clickText('Submit attempt →');
      await waitResult(page);
      assert.ok(/Passed/.test(await resultText(page)), await resultText(page));
      assert.ok(/100/.test(await resultText(page)));

      // Frozen after submit, and the result survives a reload.
      await page.reload({ waitUntil: 'networkidle0' });
      await waitResult(page);
      assert.ok(/Passed/.test(await resultText(page)));
      // Recorded on the ladder.
      await page.goto(base + '/trade/plc', { waitUntil: 'networkidle0' });
      await page.waitForFunction(() => /Passed/.test(document.querySelector('[data-scenario-card="plc-sbx-startstop"]')?.textContent ?? ''));
      await page.close();
      console.log('A. practice scenario: wired + programmed in ST, graded by outcome, recorded');
    }

    /* ---------------- B. employer -> candidate assessment ---------------- */
    const assignment = { kind: 'skills-lab-assignment', formatVersion: 1, trade: 'plc', exerciseId: 'plc-sbx-find-fault',
      exerciseVersion: '1.0', mode: 'assessment', seed: 1, label: 'E2E candidate', createdAt: '2026-01-01T00:00:00.000Z' };
    let returned;
    {
      const emp = await newPage(browser, errors);
      await emp.goto(base + '/employer', { waitUntil: 'networkidle0' });
      const options = await emp.$$eval('select option', o => o.map(x => x.value));
      assert.ok(options.includes('plc-sbx-find-fault') && options.includes('plc-sbx-sorting'), 'Employer can assign scenarios');
      await emp.select('select', 'plc-sbx-find-fault');
      await emp.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Generate assignment').click());
      await emp.waitForSelector('textarea');
      const code = await emp.$eval('textarea', e => e.value);
      assert.equal(unb64url(code).exerciseId, 'plc-sbx-find-fault');
      await emp.close();

      const page = await newPage(browser, errors); const t = tools(page);
      await page.goto(`${base}/take#a=${b64url(assignment)}`, { waitUntil: 'networkidle0' });
      await page.waitForFunction(() => /Before you begin/.test(document.body.textContent));
      await t.clickText('Begin assessment →');
      await page.waitForSelector('[data-scenario="plc-sbx-find-fault"][data-scenario-mode="assessment"]');
      await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 6, { timeout: 8000 });
      assert.equal(await page.$$eval('.sandbox-wire-list > div', n => n.length), 11, 'Fault scenario starts fully wired');
      assert.equal(await page.$('[data-fault-inject]'), null, 'Candidate has no instructor controls');
      assert.equal(await page.$('[data-fault-reveal]'), null);
      assert.equal(await page.$('[data-fault-item]'), null, 'The hidden fault is not listed anywhere');
      assert.equal(await t.hasButton('Check my work'), false, 'No live feedback under exam conditions');
      assert.equal(await t.hasButton('Show hints'), false, 'No hints under exam conditions');
      assert.equal(await t.hasButton('Start over'), false, 'No restarts under exam conditions');
      assert.equal(await t.objective('starts'), 'unchecked');

      // Reproduce the symptom.
      await t.clickText('▶ Run');
      await page.click('[data-device-id="start"] .sandbox-operate');
      await page.waitForFunction(() => [...document.querySelectorAll('.sandbox-lamps span')]
        .some(e => e.textContent.trim() === 'Run' && e.classList.contains('lit')), { timeout: 6000 });
      await t.status('motor', 3000, 'STOPPED');
      await page.waitForSelector('[data-alarm-item][data-alarm-code="START_FAILURE"][data-alarm-active="true"]', { timeout: 12000 });
      // Diagnose with the meter: 24 V across a coil that has not pulled in.
      await page.select('select[aria-label="Red meter probe"]', 'con.A1');
      await page.select('select[aria-label="Black meter probe"]', 'con.A2');
      await page.waitForFunction(() => document.querySelector('[data-meter-status]')?.textContent.trim() === '24 V DC', { timeout: 6000 });
      // Replace the part the evidence points at.
      assert.equal(await page.$eval('[data-repair-button]', e => e.disabled), true);
      await t.clickText('Pause'); await t.paused();
      await page.select('[data-repair-target]', 'con');
      await page.click('[data-repair-button]');
      await page.waitForFunction(() => document.querySelector('.sandbox-event-list')?.textContent.includes('Replaced con with the simulation isolated'), { timeout: 6000 });
      await t.clickText('▶ Run');
      await page.click('[data-device-id="start"] .sandbox-operate'); // release, then press again
      await page.click('[data-device-id="start"] .sandbox-operate');
      await t.status('motor', 9000, 'RUNNING');
      await page.click('[data-device-id="start"] .sandbox-operate');
      await sleep(500);
      await page.click('[data-device-id="stop"] .sandbox-operate');
      await t.status('motor', 9000, 'STOPPED');
      await t.clickText('Submit for assessment →');
      await waitResult(page);
      const text = await resultText(page);
      assert.ok(/Passed/.test(text), text);
      await page.waitForSelector('.return-code textarea');
      const rc = await page.$eval('.return-code textarea', e => e.value);
      returned = unb64url(rc);
      assert.equal(returned.kind, 'skills-lab-result');
      assert.equal(returned.assignment.exerciseId, 'plc-sbx-find-fault');
      assert.equal(returned.assignment.label, 'E2E candidate', 'The employer assignment is echoed back');
      assert.equal(returned.rubric.passed, true);
      assert.equal(returned.rubric.score, returned.rubric.max);
      assert.ok(returned.evidence.some(e => e.action === 'repair' && /Replaced con /.test(e.detail)), 'Repair recorded from the worker');
      assert.ok(returned.evidence.filter(e => e.action === 'setMeterProbe').length >= 2, 'Meter use recorded');
      assert.ok(JSON.stringify(returned).indexOf('contactor-coil-open') < 0, 'The result code must not leak the hidden fault');
      await page.close();

      // Employer reviews the returned code.
      const rev = await newPage(browser, errors);
      await rev.goto(base + '/employer', { waitUntil: 'networkidle0' });
      await rev.evaluate(rc2 => { /* filled below */ }, rc);
      const areas = await rev.$$('textarea');
      await areas[areas.length - 1].type(rc, { delay: 0 });
      await rev.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Review result').click());
      await rev.waitForSelector('.review-out');
      const reviewText = await rev.$eval('.review-out', e => e.textContent);
      assert.ok(/Passed/.test(reviewText) && /E2E candidate/.test(reviewText), reviewText);
      await rev.close();
      console.log('B. assessment: no answers/instructor controls, diagnosed by meter, repaired, code reviewed by employer');
    }

    /* ---------------- C. guess-and-replace in a fresh profile ---------------- */
    {
      const ctx = await browser.createBrowserContext();
      const page = await ctx.newPage();
      page.on('pageerror', e => errors.push(String(e)));
      await page.setViewport({ width: 1440, height: 940, deviceScaleFactor: 1 });
      const t = tools(page);
      await page.goto(`${base}/take#a=${b64url(assignment)}`, { waitUntil: 'networkidle0' });
      await t.clickText('Begin assessment →');
      await page.waitForSelector('[data-scenario-mode="assessment"]');
      await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 6, { timeout: 8000 });
      // Each replacement is confirmed by the worker's own event before the next action (a person cannot
      // click faster than the worker answers, and the grader reads what the worker confirmed).
      for (const part of ['motor', 'plc', 'con']) {
        await page.select('[data-repair-target]', part);
        await page.click('[data-repair-button]');
        await page.waitForFunction(p => document.querySelector('.sandbox-event-list')
          ?.textContent.includes(`Replaced ${p} with the simulation isolated`), { timeout: 6000 }, part);
      }
      await t.clickText('Submit for assessment →');
      await waitResult(page);
      const text = await resultText(page);
      assert.ok(/Not passed/.test(text), `Shotgun replacement must not pass: ${text}`);
      const rc = await page.$eval('.return-code textarea', e => e.value);
      const r = unb64url(rc);
      assert.equal(r.rubric.passed, false);
      const byId = Object.fromEntries(r.rubric.criteria.map(c => [c.id, c.earned]));
      assert.equal(byId['fault-gone'], 1, 'The fault was removed... ' + JSON.stringify(r.evidence.map(e => e.action + ':' + e.detail)));
      assert.equal(byId.precise, 0, '...but healthy parts were replaced');
      assert.equal(byId.diagnosed, 0, '...without measuring first');
      await ctx.close();
      console.log('C. guess-and-replace candidate graded NOT passed');
    }
    assert.deepEqual(errors.filter(e => !/favicon|WebGL|GPU stall|swiftshader/i.test(e)), [], 'No page errors');
    console.log('P6 scenario browser E2E PASS');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
