/** Real-Chrome check that plant devices are per-instance: two conveyor lanes (own PLC, photoeye, diverter,
 *  parcel and counters) and two tanks (own PLC, pump, level switch and valve) in one project each, all
 *  inside the real 1080 x 580 floor. Each PLC is programmed through its tab in the UI; every number
 *  below is read from worker-driven DOM.
 */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
const KEY = 'efo-open-sandbox-project-v1';
const rename = (n, id) => id.replace(/^([a-z]+)\./, (_, p) => `${p}${n}.`);
const wires = (n, pairs) => pairs.map(([a, b], i) => ({ id: `w${n}-${i}`, from: rename(n, a), to: rename(n, b) }));
const part = (id, kind, x, y) => ({ id, kind, x, y, pressed: false });
const blank = { id: 'sandbox-program', version: '1.0', rungs: [{ id: 'rung-1', elements: [{ type: 'contact', tag: 'Start' }], coil: 'Run' }] };
const project = (components, w) => ({ formatVersion: 1, components, wires: w, program: blank, language: 'ladder', plcPrograms: { plc2: { program: blank, language: 'ladder' } } });
const lineParts = (n, y) => [part(`ps${n}`, 'supply', 25, y), part(`plc${n}`, 'plc', 315, y), part(`con${n}`, 'contactor', 555, y),
  part(`belt${n}`, 'conveyor', 610, y + 20), part(`start${n}`, 'start', 60, y + 100), part(`stop${n}`, 'stop', 325, y + 100),
  part(`eye${n}`, 'photoeye', 690, y + 120), part(`gate${n}`, 'diverter', 750, y + 80)];
const lineWires = n => wires(n, [['ps.P24', 'plc.L+'], ['ps.M0', 'plc.M'], ['ps.P24', 'start.A'], ['start.B', 'plc.I0.0'], ['ps.P24', 'stop.A'], ['stop.B', 'plc.I0.1'],
  ['ps.P24', 'con.13'], ['ps.M0', 'con.A2'], ['plc.Q0.0', 'con.A1'], ['con.14', 'belt.L+'], ['ps.M0', 'belt.M-'],
  ['ps.P24', 'eye.L+'], ['ps.M0', 'eye.M'], ['eye.OUT', 'plc.I0.2'], ['plc.Q0.1', 'gate.A1'], ['ps.M0', 'gate.A2']]);
const tankParts = (n, y) => [part(`supply${n}`, 'supply', 25, y), part(`plc${n}`, 'plc', 310, y), part(`stop${n}`, 'stop', 225, y + 150),
  part(`tank${n}`, 'tank', 680, y), part(`pump${n}`, 'pump', 525, y - 10), part(`probe${n}`, 'levelprobe', 700, y + 70), part(`drain${n}`, 'drainvalve', 840, y + 70)];
const tankWires = n => wires(n, [['supply.P24', 'plc.L+'], ['supply.M0', 'plc.M'], ['supply.P24', 'stop.A'], ['stop.B', 'plc.I0.1'],
  ['supply.P24', 'probe.L+'], ['supply.M0', 'probe.M'], ['probe.OUT', 'plc.I0.3'],
  ['plc.Q0.2', 'pump.L+'], ['supply.M0', 'pump.M-'], ['plc.Q0.3', 'drain.A1'], ['supply.M0', 'drain.A2']]);
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: [
    '--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--use-gl=angle',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.setViewport({ width: 1440, height: 940, deviceScaleFactor: 1 });
  const clickText = async (text, scope = 'document') => {
    const ok = await page.evaluate((label, sel) => {
      const root = sel === 'document' ? document : document.querySelector(sel);
      const b = [...root.querySelectorAll('button')].find(el => el.textContent.trim() === label);
      if (!b || b.disabled) return false; b.click(); return true;
    }, text, scope);
    assert.ok(ok, `Expected enabled button "${text}" in ${scope}`);
  };
  const load = async p => {
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate((k, v) => { localStorage.clear(); localStorage.setItem(k, JSON.stringify(v)); }, KEY, p);
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-plc-tab="plc2"]', { timeout: 10000 });
  };
  const status = (id, want, timeout = 12000) => page.waitForFunction((dev, expected) =>
    document.querySelector(`[data-device-id="${dev}"] .sandbox-device-status`)?.textContent.trim() === expected, { timeout }, id, want);
  const statusNow = id => page.$eval(`[data-device-id="${id}"] .sandbox-device-status`, e => e.textContent.trim());
  const toggle = id => page.evaluate(i => document.querySelector(`[data-device-id="${i}"] .sandbox-operate`).click(), id);
  const num = (scope, attr) => page.$eval(`${scope} [${attr}]`, e => Number(e.textContent.trim().replace(/[^0-9.]/g, '')));
  const program = async (tab, example) => { await page.evaluate(t => document.querySelector(`[data-plc-tab="${t}"]`).click(), tab); await sleep(150); await clickText(example); await sleep(200); };
  try {
    /* ---- two conveyor lanes ---- */
    await load(project([...lineParts(1, 20), ...lineParts(2, 300)], [...lineWires(1), ...lineWires(2)]));
    assert.equal(await page.$$eval('.sandbox-device', n => n.length), 16);
    assert.equal(await page.$$eval('[data-lane]', n => n.length), 2, 'One sorting panel per conveyor');
    await program('plc1', 'Load sorting program example');
    await program('plc2', 'Load sorting program example');
    await clickText('▶ Run');
    await toggle('start1'); await sleep(200); await toggle('start1');
    await toggle('start2'); await sleep(200); await toggle('start2');
    await status('belt1', 'BELT MOVING'); await status('belt2', 'BELT MOVING');
    await clickText('Feed marked parcel', '[data-lane="belt1"]');
    await clickText('Feed plain parcel', '[data-lane="belt2"]');
    await page.waitForFunction(() => document.querySelector('[data-lane="belt1"] [data-sort-rejected]')?.textContent.trim() === '1' &&
      document.querySelector('[data-lane="belt2"] [data-sort-accepted]')?.textContent.trim() === '1', { timeout: 20000 });
    assert.equal(await num('[data-lane="belt1"]', 'data-sort-accepted'), 0, 'lane 1 accepted nothing');
    assert.equal(await num('[data-lane="belt2"]', 'data-sort-rejected'), 0, 'lane 2 rejected nothing');
    // Stop line 2 only; line 1 keeps running.
    await toggle('stop2'); await status('belt2', 'BELT STOPPED');
    assert.equal(await statusNow('belt1'), 'BELT MOVING');
    console.log('A. two lanes: own parcel, own counters, own PLC, own belt');

    /* ---- two tanks ---- */
    await load(project([...tankParts(1, 20), ...tankParts(2, 300)], [...tankWires(1), ...tankWires(2)]));
    assert.equal(await page.$$eval('[data-vessel]', n => n.length), 2, 'One tank panel per tank');
    await program('plc1', 'Load tank control example');
    await program('plc2', 'Load tank control example');
    await clickText('▶ Run');
    await page.waitForFunction(() => ['tank1', 'tank2'].every(t => {
      const lvl = Number(document.querySelector(`[data-vessel="${t}"] [data-tank-level]`)?.textContent.replace(/[^0-9.]/g, '') ?? 0);
      return lvl > 100;
    }), { timeout: 15000 });
    await page.waitForFunction(() => ['tank1', 'tank2'].every(t => document.querySelector(`[data-vessel="${t}"] [data-tank-high]`)?.textContent.trim() === 'HIGH'), { timeout: 20000 });
    // Stop tank 1's PLC: its pump and drain go quiet; tank 2 keeps cycling on its own.
    await toggle('stop1');
    await page.waitForFunction(() => document.querySelector('[data-vessel="tank1"] [data-tank-pump]')?.textContent.trim() === 'OFF' &&
      document.querySelector('[data-vessel="tank1"] [data-tank-drain]')?.textContent.trim() === 'CLOSED', { timeout: 8000 });
    const before = await num('[data-vessel="tank1"]', 'data-tank-level');
    await sleep(1500);
    const after = await num('[data-vessel="tank1"]', 'data-tank-level');
    assert.equal(after, before, 'Tank 1 holds its level once its PLC is stopped');
    await page.waitForFunction(() => {
      const lvl = Number(document.querySelector('[data-vessel="tank2"] [data-tank-level]')?.textContent.replace(/[^0-9.]/g, '') ?? 0);
      return lvl < 740; // tank 2 is draining on its own PLC while tank 1 stands still
    }, { timeout: 10000 });
    console.log('B. two tanks: own pump, own level switch, own valve, own PLC');
    assert.deepEqual(errors.filter(e => !/favicon|WebGL|GPU stall|swiftshader/i.test(e)), [], 'No page errors');
    console.log('Per-instance plant E2E PASS');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
