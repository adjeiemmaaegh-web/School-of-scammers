/** Real-Chrome acceptance for R04/R17: RFID reader and machine-vision sensor on a live line.
 *  Feeder (small cartons, sequential RFID tags, quantity 3) -> belt, with a vision sensor (expected length 160 mm) and an RFID
 *  reader over the belt. The live device cards must show the real signals: the vision length/class/pass and the tag numbers read. */
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
  try {
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.sandbox-palette-item:not([disabled])');
    await page.click('[data-p5-view="logical"]');
    await page.click('[data-p5-dock-tab="diagnostics"]');
    await page.waitForSelector('.sandbox-wire-list');
    for (const l of ['24V supply', 'START NO', 'Seeded box feeder', 'Variable-speed belt conveyor', 'Machine-vision inspection sensor', 'RFID reader']) { await place(l); await sleep(90); }
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 6, { timeout: 8000 });
    const [PS, GO, FEED, BELT, CAM, RFID] = ['supply-1', 'start-2', 'box-feeder-3', 'belt-conveyor-4', 'vision-sensor-5', 'rfid-reader-6'];
    for (const [a, b] of [[`${PS}.P24`, `${GO}.A`], [`${GO}.B`, `${FEED}.CMD_enable+`], [`${FEED}.M-`, `${PS}.M0`], [`${GO}.B`, `${BELT}.CMD_run+`], [`${BELT}.M-`, `${PS}.M0`],
      [`${PS}.P24`, `${CAM}.L+`], [`${PS}.M0`, `${CAM}.M`], [`${PS}.P24`, `${RFID}.L+`], [`${PS}.M0`, `${RFID}.M`]]) await wire(a, b);
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-wire-list > div').length === 9, { timeout: 8000 });
    console.log('1. line built from an empty floor; idle:', await statusOf(CAM), '|', await statusOf(RFID));
    await sleep(700);
    await page.evaluate((key, ids) => {
      const project = JSON.parse(localStorage.getItem(key));
      const at = { [ids.feed]: [425, 225], [ids.belt]: [455, 225], [ids.cam]: [455, 225], [ids.rfid]: [455, 225] };
      project.components = project.components.map(c => at[c.id] ? { ...c, x: at[c.id][0], y: at[c.id][1] } : c);
      project.params = { ...(project.params ?? {}),
        [ids.feed]: { materialId: 2, rateMs: 900, quantity: 3, rfidTags: 1 },
        [ids.belt]: { lengthMm: 800, speedMmS: 300 },
        [ids.cam]: { fieldMm: 100, expectedLengthMm: 160, toleranceMm: 10 },
        [ids.rfid]: { rangeMm: 150 } };
      localStorage.setItem(key, JSON.stringify(project));
    }, KEY, { feed: FEED, belt: BELT, cam: CAM, rfid: RFID });
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 6, { timeout: 10000 });
    assert.ok(await clickText('▶ Run'), 'run');
    await page.evaluate(i => document.querySelector(`[data-device-id="${i}"] .sandbox-operate`).click(), GO);
    // The vision sensor measures a 160 mm carton and passes it; the RFID reader reads tags 1, 2 and 3 in turn.
    await page.waitForFunction(d => /PRESENT/.test(document.querySelector(`[data-device-id="${d}"] .sandbox-device-status`)?.textContent ?? ''), { timeout: 30000, polling: 50 }, CAM);
    const seenCam = await statusOf(CAM);
    console.log('2. vision sensor live status:', seenCam);
    assert.match(seenCam, /PASS/); assert.match(seenCam, /lengthMm 160/); assert.match(seenCam, /classId 1/);
    // Sample the reader continuously while the run is in progress and stop at the third counted read.
    const tags = new Set();
    let final = '';
    for (let i = 0; i < 1500; i++) {
      final = await statusOf(RFID);
      const m = /tagId (\d+)/.exec(final);
      if (m && Number(m[1]) > 0) tags.add(Number(m[1]));
      if (/readCount 3/.test(final)) break;
      await sleep(30);
    }
    console.log('3. RFID reader saw tags:', [...tags].sort().join(','), '| final:', final);
    assert.match(final, /readCount 3/, 'every tag was counted exactly once');
    assert.ok(tags.size >= 2 && [...tags].every(t => t >= 1 && t <= 3), 'tag numbers are the feeder\'s sequence');
    await clickText('Pause');
    assert.deepEqual(errors.filter(e => !/WebGL|GPU stall|favicon|swiftshader/i.test(e)), []);
    console.log('R13 SENSORS BROWSER PASS');
  } catch (e) { console.error(e); process.exitCode = 1; } finally { await browser.close(); }
})();
