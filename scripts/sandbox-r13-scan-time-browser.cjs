/** Real-Chrome acceptance for R09/R23: configurable scan period, simulation speed and scan diagnostics.
 *  Builds START -> on-delay relay (default 2000 ms) -> lamp from an empty floor, then proves in the real worker that:
 *   - the scan period and speed are chosen from the toolbar, the period is locked while running and saved with the project;
 *   - the relay's delayed contact closes after the same ~2 MODEL seconds at 20 ms/x1 and at 200 ms/x5 (logic is identical),
 *     while x5 really passes model time faster against the wall clock;
 *   - the status bar shows the scan period, the speed and the measured simulator load. */
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
  const statusOf = id => page.$eval(`[data-device-id="${id}"] .sandbox-device-status`, e => e.textContent.trim());
  const modelMs = () => page.$eval('[data-scan-diagnostics] b', e => Math.round(parseFloat(e.textContent) * 1000));
  const press = id => page.evaluate(i => document.querySelector(`[data-device-id="${i}"] .sandbox-operate`).click(), id);
  const paused = () => page.waitForFunction(() => /Paused/.test(document.body.textContent), { timeout: 8000 });
  try {
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.sandbox-palette-item:not([disabled])');
    await page.click('[data-p5-view="logical"]');
    for (const l of ['24V supply', 'START NO', '24V on-delay relay', '24V pilot lamp']) { await place(l); await sleep(70); }
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 4, { timeout: 8000 });
    const [PS, GO, T, LAMP] = ['supply-1', 'start-2', 'timerelay-3', 'lamp-4'];
    for (const [a, b] of [[`${PS}.P24`, `${GO}.A`], [`${GO}.B`, `${T}.A1`], [`${T}.A2`, `${PS}.M0`], [`${PS}.P24`, `${T}.13`], [`${T}.14`, `${LAMP}.L+`], [`${LAMP}.M-`, `${PS}.M0`]]) await wire(a, b);
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-wire-list > div').length === 6, { timeout: 8000 }).catch(() => {});

    assert.equal(await page.$eval('[data-scan-period]', e => e.value), '50', 'default scan period');
    assert.equal(await page.$eval('[data-time-scale]', e => e.value), '1', 'default speed');
    assert.match(await page.$eval('[data-scan-diagnostics]', e => e.textContent), /50 ms scans/);

    /** Runs START -> delayed contact at the given period and speed; returns {model, wall}. */
    const trial = async (period, speed) => {
      await page.select('[data-scan-period]', String(period));
      await page.waitForFunction(p => document.querySelector('[data-scan-diagnostics]')?.textContent.includes(`${p} ms scans`), { timeout: 5000 }, period);
      await page.select('[data-time-scale]', String(speed));
      assert.ok(await clickText('▶ Run'), 'run');
      await page.waitForFunction(() => document.querySelector('[data-scan-period]')?.disabled === true, { timeout: 8000 });
      await sleep(250);
      const t0 = await modelMs(), w0 = Date.now();
      await press(GO);
      await page.waitForFunction(id => /CONTACTS ON/.test(document.querySelector(`[data-device-id="${id}"] .sandbox-device-status`)?.textContent ?? ''), { timeout: 30000, polling: 20 }, T);
      const model = (await modelMs()) - t0, wall = Date.now() - w0;
      await page.waitForFunction(id => document.querySelector(`[data-device-id="${id}"] .sandbox-device-status`)?.textContent.trim() === 'ILLUMINATED', { timeout: 5000 }, LAMP); // lamp follows one scan later
      await press(GO);
      await clickText('Pause'); await paused();
      await page.waitForFunction(() => document.querySelector('[data-scan-period]')?.disabled === false, { timeout: 8000 });
      await clickText('Reset scan state');
      await sleep(300);
      return { model, wall };
    };
    const slow = await trial(20, 1);
    const fast = await trial(200, 5);
    console.log('trial 20 ms x1:', JSON.stringify(slow), '| 200 ms x5:', JSON.stringify(fast));
    // The relay's 2000 ms delay is model time: the same at both settings (observation lag and one scan of quantisation allowed).
    for (const [name, r, scan, speed] of [['20 ms x1', slow, 20, 1], ['200 ms x5', fast, 200, 5]])
      assert.ok(r.model >= 2000 - scan && r.model <= 2000 + 700, `${name}: delayed contact after ${r.model} model ms`);
    assert.ok(slow.wall >= 1700, `x1 takes about two wall seconds (${slow.wall} ms)`);
    assert.ok(fast.wall < slow.wall * 0.6, `x5 passes model time faster against the wall clock (${fast.wall} ms vs ${slow.wall} ms)`);
    console.log('1. the delayed contact closes after the same ~2 model seconds at 20 ms/x1 and 200 ms/x5; x5 is faster in real time');

    // Diagnostics while running at a fast speed and a short period.
    await page.select('[data-scan-period]', '10');
    await page.select('[data-time-scale]', '10');
    await clickText('▶ Run');
    await page.waitForSelector('[data-scan-load]', { timeout: 8000 });
    const load = await page.$eval('[data-scan-load]', e => e.textContent);
    assert.match(load, /Simulator load \d/);
    assert.match(await page.$eval('[data-scan-diagnostics]', e => e.textContent), /10 ms scans.*×10/);
    await clickText('Pause'); await paused();
    console.log('2. status bar shows period, speed and measured simulator load:', load.trim());

    // The scan period is project data: it survives a reload; the speed is a pacing choice and does not.
    await page.select('[data-scan-period]', '100');
    await sleep(700);
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 4, { timeout: 10000 });
    assert.equal(await page.$eval('[data-scan-period]', e => e.value), '100', 'scan period saved with the project');
    assert.equal(await page.$eval('[data-time-scale]', e => e.value), '1', 'speed is not saved');
    console.log('3. scan period saved with the project; speed resets to normal');
    assert.deepEqual(errors.filter(e => !/WebGL|GPU stall|favicon|swiftshader/i.test(e)), []);
    console.log('R13 SCAN TIME BROWSER PASS');
  } catch (e) { console.error(e); process.exitCode = 1; } finally { await browser.close(); }
})();
