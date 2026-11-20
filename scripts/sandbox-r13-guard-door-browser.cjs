/** Real-Chrome acceptance for R20: an interlocked guard door in a conveyor line, built from an empty floor.
 *  START -> feeder + belt; OPEN button -> door coil; a collector at the end. With the door closed the cartons queue at it and the
 *  collector stays at zero; after the operator opens the door the line delivers all of them. The door card shows CLOSED then OPEN. */
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
  const operate = id => page.evaluate(i => document.querySelector(`[data-device-id="${i}"] .sandbox-operate`).click(), id);
  try {
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.sandbox-palette-item:not([disabled])');
    await page.click('[data-p5-view="logical"]');
    await page.click('[data-p5-dock-tab="diagnostics"]');
    await page.waitForSelector('.sandbox-wire-list');
    for (const l of ['24V supply', 'START NO', 'START NO', 'Seeded box feeder', 'Variable-speed belt conveyor', 'Interlocked guard door', 'Product collector (sink)']) { await place(l); await sleep(90); }
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 7, { timeout: 8000 });
    const [PS, GO, OPEN, FEED, BELT, DOOR, BIN] = ['supply-1', 'start-2', 'start-3', 'box-feeder-4', 'belt-conveyor-5', 'guard-door-6', 'collector-7'];
    for (const [a, b] of [[`${PS}.P24`, `${GO}.A`], [`${GO}.B`, `${FEED}.CMD_enable+`], [`${FEED}.M-`, `${PS}.M0`], [`${GO}.B`, `${BELT}.CMD_run+`], [`${BELT}.M-`, `${PS}.M0`],
      [`${PS}.P24`, `${OPEN}.A`], [`${OPEN}.B`, `${DOOR}.CMD_open+`], [`${DOOR}.M-`, `${PS}.M0`], [`${PS}.P24`, `${BIN}.CMD_enable+`], [`${BIN}.M-`, `${PS}.M0`]]) await wire(a, b);
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-wire-list > div').length === 10, { timeout: 8000 });
    await sleep(700);
    await page.evaluate((key, ids) => {
      const project = JSON.parse(localStorage.getItem(key));
      const at = { [ids.feed]: [425, 225], [ids.belt]: [455, 225], [ids.door]: [455, 225], [ids.bin]: [560, 225] };
      project.components = project.components.map(c => at[c.id] ? { ...c, x: at[c.id][0], y: at[c.id][1], ...(c.id === ids.door ? { yawDeg: 90 } : {}) } : c);
      project.params = { ...(project.params ?? {}),
        [ids.feed]: { materialId: 2, rateMs: 900, quantity: 3 },
        [ids.belt]: { lengthMm: 1200, speedMmS: 300 },
        [ids.door]: { travelMs: 1000 } };
      localStorage.setItem(key, JSON.stringify(project));
    }, KEY, { feed: FEED, belt: BELT, door: DOOR, bin: BIN });
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 7, { timeout: 10000 });
    assert.match(await statusOf(DOOR), /CLOSED/);
    assert.ok(await clickText('▶ Run'), 'run');
    await operate(GO);
    // The cartons queue at the closed door; the feeder cannot discharge onto its occupied exit, so it holds back the rest.
    await sleep(9000);
    const held = await statusOf(BIN), feederHeld = await statusOf(FEED);
    console.log('1. door closed:', await statusOf(DOOR), '| collector =', held, '| feeder =', feederHeld);
    assert.match(held, /count 0/, 'a closed door holds the line');
    assert.doesNotMatch(feederHeld, /EMPTY/, 'the feeder is held back by the queue, not finished');
    await operate(OPEN);
    await page.waitForFunction(d => /(^|\s)OPEN/.test(document.querySelector(`[data-device-id="${d}"] .sandbox-device-status`)?.textContent ?? ''), { timeout: 15000, polling: 100 }, DOOR);
    await page.waitForFunction(d => /count 3/.test(document.querySelector(`[data-device-id="${d}"] .sandbox-device-status`)?.textContent ?? ''), { timeout: 90000, polling: 100 }, BIN);
    console.log('2. operator opened the door: door =', await statusOf(DOOR), '| collector =', await statusOf(BIN));
    await clickText('Pause');
    assert.deepEqual(errors.filter(e => !/WebGL|GPU stall|favicon|swiftshader/i.test(e)), []);
    console.log('R13 GUARD DOOR BROWSER PASS');
  } catch (e) { console.error(e); process.exitCode = 1; } finally { await browser.close(); }
})();
