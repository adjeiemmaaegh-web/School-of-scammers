/** Real-Chrome acceptance for R03 (inclined belt) with R02 (material friction): the same cell sorts by friction.
 *  START -> feeder -> belt (incline set to 15 degrees in the inspector) -> collector at the top.
 *  Small cartons (mu 0.45) climb and are collected; glass bottles (mu 0.25 < tan 15) slide back and the collector stays empty. */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const KEY = 'efo-open-sandbox-project-v1';
async function runCell(browser, materialId, expectCollected) {
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
    // Incline through the real inspector.
    if (await page.$eval('.p5-panel-toggles button:nth-child(2)', e => e.getAttribute('aria-pressed') !== 'true')) await page.click('.p5-panel-toggles button:nth-child(2)');
    await page.evaluate(i => document.querySelector(`[data-device-id="${i}"] .sandbox-inspect-link`).click(), BELT);
    await page.waitForSelector('[data-param="inclineDeg"]');
    await page.click('[data-param="inclineDeg"]', { clickCount: 3 });
    await page.keyboard.type('15'); await page.keyboard.press('Enter');
    await sleep(500);
    assert.equal(await page.$eval('[data-param="inclineDeg"]', e => e.value), '15', 'incline set from the inspector');
    await sleep(700);
    await page.evaluate((key, ids, material) => {
      const project = JSON.parse(localStorage.getItem(key));
      const at = { [ids.feed]: [425, 225], [ids.belt]: [455, 225], [ids.bin]: [525, 225] };
      project.components = project.components.map(c => at[c.id] ? { ...c, x: at[c.id][0], y: at[c.id][1] } : c);
      project.params = { ...(project.params ?? {}),
        [ids.feed]: { materialId: material, rateMs: 900, quantity: 4 },
        [ids.belt]: { ...(project.params?.[ids.belt] ?? {}), lengthMm: 800, speedMmS: 300 } };
      localStorage.setItem(key, JSON.stringify(project));
    }, KEY, { feed: FEED, belt: BELT, bin: BIN }, materialId);
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 5, { timeout: 10000 });
    assert.ok(await clickText('▶ Run'), 'run');
    await page.evaluate(i => document.querySelector(`[data-device-id="${i}"] .sandbox-operate`).click(), GO);
    await page.waitForFunction(d => /EMPTY/.test(document.querySelector(`[data-device-id="${d}"] .sandbox-device-status`)?.textContent ?? ''), { timeout: 60000, polling: 100 }, FEED);
    await sleep(expectCollected ? 12000 : 6000);
    const bin = await statusOf(BIN);
    if (expectCollected) assert.match(bin, /count 4/, 'cartons climbed into the collector: ' + bin);
    else assert.doesNotMatch(bin, /count [1-9]/, 'bottles slid back, nothing collected: ' + bin);
    await clickText('Pause');
    assert.deepEqual(errors.filter(e => !/WebGL|GPU stall|favicon|swiftshader/i.test(e)), []);
    return bin;
  } finally { await page.close(); }
}
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const bottles = await runCell(browser, 3, false);
    console.log('1. glass bottles on a 15 degree incline: collector =', bottles);
    const cartons = await runCell(browser, 2, true);
    console.log('2. small cartons on the same incline: collector =', cartons);
    console.log('R13 INCLINE BROWSER PASS');
  } catch (e) { console.error(e); process.exitCode = 1; } finally { await browser.close(); }
})();
