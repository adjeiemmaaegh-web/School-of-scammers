/** Real-Chrome acceptance for R02/R16/R26: a production cell built from an empty floor.
 *  START -> feeder (catalogue material, quantity set in the inspector) + belt -> product collector.
 *  The run stops at its quantity (feeder reports EMPTY), the collector counts every body (no body left on the floor),
 *  and the live status text shows the real signals. Positions and the remaining settings are written through the app's own
 *  saved-project format because the 3D drag path is covered elsewhere. */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const KEY = 'efo-open-sandbox-project-v1';
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
  const waitStatus = (id, re, t = 60000) => page.waitForFunction((d, src) => new RegExp(src).test(document.querySelector(`[data-device-id="${d}"] .sandbox-device-status`)?.textContent ?? ''), { timeout: t, polling: 100 }, id, re);
  try {
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.sandbox-palette-item:not([disabled])');
    await page.click('[data-p5-view="logical"]');
    await page.click('[data-p5-dock-tab="diagnostics"]');
    await page.waitForSelector('.sandbox-wire-list');
    for (const l of ['24V supply', 'START NO', 'Seeded box feeder', 'Variable-speed belt conveyor', 'Product collector (sink)']) { await place(l); await sleep(90); }
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 5, { timeout: 8000 });
    const [PS, GO, FEED, BELT, BIN] = ['supply-1', 'start-2', 'box-feeder-3', 'belt-conveyor-4', 'collector-5'];
    for (const [a, b] of [[`${PS}.P24`, `${GO}.A`], [`${GO}.B`, `${FEED}.CMD_enable+`], [`${FEED}.M-`, `${PS}.M0`], [`${GO}.B`, `${BELT}.CMD_run+`], [`${BELT}.M-`, `${PS}.M0`], [`${PS}.P24`, `${BIN}.CMD_enable+`], [`${BIN}.M-`, `${PS}.M0`]]) await wire(a, b);
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-wire-list > div').length === 7, { timeout: 8000 });
    console.log('1. cell built from an empty floor; idle statuses:', await statusOf(FEED), '|', await statusOf(BIN));
    assert.match(await statusOf(BIN), /IDLE|count 0/);

    // Production quantity through the real inspector.
    if (await page.$eval('.p5-panel-toggles button:nth-child(2)', e => e.getAttribute('aria-pressed') !== 'true')) await page.click('.p5-panel-toggles button:nth-child(2)');
    await page.evaluate(i => document.querySelector(`[data-device-id="${i}"] .sandbox-inspect-link`).click(), FEED);
    await page.waitForSelector('[data-param="quantity"]');
    await page.click('[data-param="quantity"]', { clickCount: 3 });
    await page.keyboard.type('3'); await page.keyboard.press('Enter');
    await sleep(500);
    assert.equal(await page.$eval('[data-param="quantity"]', e => e.value), '3');
    console.log('2. production quantity 3 set from the inspector');

    // Layout and the remaining settings, through the app's saved format (plant mm = (x - 455) x 10).
    await sleep(700);
    await page.evaluate((key, ids) => {
      const project = JSON.parse(localStorage.getItem(key));
      const at = { [ids.feed]: [465, 225], [ids.belt]: [455, 225], [ids.bin]: [560, 225] };
      project.components = project.components.map(c => at[c.id] ? { ...c, x: at[c.id][0], y: at[c.id][1] } : c);
      project.params = { ...(project.params ?? {}),
        [ids.feed]: { ...(project.params?.[ids.feed] ?? {}), materialId: 2, rateMs: 700 },
        [ids.belt]: { lengthMm: 800, speedMmS: 500 } };
      localStorage.setItem(key, JSON.stringify(project));
    }, KEY, { feed: FEED, belt: BELT, bin: BIN });
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 5, { timeout: 10000 });

    assert.ok(await clickText('▶ Run'), 'run');
    await page.evaluate(i => document.querySelector(`[data-device-id="${i}"] .sandbox-operate`).click(), GO);
    await waitStatus(FEED, 'EMPTY', 60000);
    await waitStatus(BIN, 'count 3', 60000);
    const feedStatus = await statusOf(FEED), binStatus = await statusOf(BIN);
    console.log('3. production run finished: feeder =', feedStatus, '| collector =', binStatus);
    assert.match(binStatus, /count 3/); assert.match(binStatus, /weightKg 6/);
    // Nothing is left lying on the floor: hold for another second and the collector count stays 3 (conservation).
    await sleep(1200);
    assert.match(await statusOf(BIN), /count 3/);
    await clickText('Pause');
    assert.deepEqual(errors.filter(e => !/WebGL|GPU stall|favicon|swiftshader/i.test(e)), []);
    console.log('R13 MATERIAL FLOW BROWSER PASS');
  } catch (e) { console.error(e); process.exitCode = 1; } finally { await browser.close(); }
})();
