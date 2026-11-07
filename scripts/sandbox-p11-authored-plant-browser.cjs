/** The product's success test, in a real browser: a student opens the simulator on an EMPTY floor and, with
 *  nothing but the library, the inspector, the terminals, the program editor and the instruments, builds a
 *  two-station industrial plant (17 devices, 32 wires, 2 PLCs, 2 supplies, 2 Structured Text programs),
 *  commissions it, sorts parcels, runs the interlocked tank, finds and repairs a fault with the multimeter,
 *  survives a short behind a breaker, and reloads it. No template, no example program, no pre-wired panel.
 *  Every value is read from worker-driven DOM.
 */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// In placement order: ids are assigned by the workbench as <kind>-<n>.
const PARTS = [
  ['supply', '24V supply', null], ['plc', 'Virtual PLC', null], ['start', 'START NO', null], ['stop', 'STOP NC', null],
  ['contactor', 'Contactor', null], ['conveyor', '3D conveyor belt', [610, 60]], ['photoeye', 'Mark photoeye', [690, 160]],
  ['diverter', '24V diverter', [750, 120]], ['lamp', '24V pilot lamp', null],
  ['supply', '24V supply', null], ['breaker', '24V branch breaker', null], ['plc', 'Virtual PLC', null], ['stop', 'STOP NC', null],
  ['tank', '3D process tank', [680, 300]], ['pump', '24V inlet pump', [525, 290]], ['levelprobe', 'High-level switch', [700, 370]],
  ['drainvalve', '24V drain valve', [840, 370]],
];
const ID = {}; // role -> workbench id
['ps1', 'plc1', 'start1', 'stop1', 'con1', 'belt1', 'eye1', 'gate1', 'lamp1', 'ps2', 'cb2', 'plc2', 'stop2', 'tank', 'pump', 'probe', 'drain']
  .forEach((role, i) => { ID[role] = `${PARTS[i][0]}-${i + 1}`; });
const t = s => s.replace(/^([a-z0-9]+)\./, (_, r) => `${ID[r]}.`);
const WIRING = [
  ['ps1.P24', 'plc1.L+'], ['ps1.M0', 'plc1.M'], ['ps1.P24', 'start1.A'], ['start1.B', 'plc1.I0.0'], ['ps1.P24', 'stop1.A'], ['stop1.B', 'plc1.I0.1'],
  ['ps1.P24', 'con1.13'], ['ps1.M0', 'con1.A2'], ['plc1.Q0.0', 'con1.A1'], ['con1.14', 'belt1.L+'], ['ps1.M0', 'belt1.M-'],
  ['ps1.P24', 'eye1.L+'], ['ps1.M0', 'eye1.M'], ['eye1.OUT', 'plc1.I0.2'], ['plc1.Q0.1', 'gate1.A1'], ['ps1.M0', 'gate1.A2'],
  ['con1.14', 'lamp1.L+'], ['lamp1.M-', 'ps1.M0'],
  ['ps2.P24', 'cb2.IN'], ['cb2.OUT', 'plc2.L+'], ['cb2.OUT', 'stop2.A'], ['cb2.OUT', 'probe.L+'],
  ['ps2.M0', 'plc2.M'], ['ps2.M0', 'probe.M'], ['ps2.M0', 'pump.M-'], ['ps2.M0', 'drain.A2'],
  ['stop2.B', 'plc2.I0.1'], ['probe.OUT', 'plc2.I0.3'], ['plc2.Q0.2', 'pump.L+'], ['plc2.Q0.3', 'drain.A1'],
  ['ps1.M0', 'ps2.M0'], ['plc1.Q0.0', 'plc2.I0.0'],
].map(([a, b]) => [t(a), t(b)]);
const PLC_A = ['VAR_INPUT', '  Start : BOOL;', '  StopOK : BOOL;', '  Photoeye : BOOL;', 'END_VAR', 'VAR_OUTPUT', '  Run : BOOL;', '  Sort : BOOL;', 'END_VAR',
  'Run := StopOK AND (Start OR Run);', 'Sort := Run AND Photoeye;'].join('\n');
const PLC_B = ['VAR_INPUT', '  Start : BOOL;', '  StopOK : BOOL;', '  TankHigh : BOOL;', 'END_VAR', 'VAR_OUTPUT', '  Run : BOOL;', '  Fill : BOOL;', '  Drain : BOOL;', 'END_VAR',
  'Run := StopOK;', 'Fill := Start AND StopOK AND NOT TankHigh;', 'Drain := StopOK AND TankHigh;'].join('\n');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: [
    '--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--use-gl=angle',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.setViewport({ width: 1440, height: 940, deviceScaleFactor: 1 });
  // Scroll the target to the centre first, as a person would (a sticky toolbar covers a band of the page).
  const original = page.click.bind(page);
  page.click = async (selector, options) => { await page.$eval(selector, el => el.scrollIntoView({ block: 'center', inline: 'center' })); return original(selector, options); };
  const clickText = async (text, scope = 'document') => {
    const ok = await page.evaluate((label, sel) => {
      const root = sel === 'document' ? document : document.querySelector(sel);
      const b = [...root.querySelectorAll('button')].find(el => el.textContent.trim() === label);
      if (!b || b.disabled) return false; b.click(); return true;
    }, text, scope);
    assert.ok(ok, `Expected enabled button "${text}" in ${scope}`);
  };
  const status = (id, want, timeout = 15000) => page.waitForFunction((dev, expected) =>
    document.querySelector(`[data-device-id="${dev}"] .sandbox-device-status`)?.textContent.trim() === expected, { timeout }, id, want);
  const statusNow = id => page.$eval(`[data-device-id="${id}"] .sandbox-device-status`, e => e.textContent.trim());
  const press = id => page.evaluate(i => document.querySelector(`[data-device-id="${i}"] .sandbox-operate`).click(), id);
  const level = () => page.$eval(`[data-vessel="${ID.tank}"] [data-tank-level]`, e => Number(e.textContent.replace(/[^0-9.]/g, '')));
  const paused = () => page.waitForFunction(() => [...document.querySelectorAll('.sandbox-toolbar button')].some(b => b.textContent.trim() === '▶ Run' && !b.disabled), { timeout: 8000 });
  const counts = () => page.evaluate(() => ({ d: document.querySelectorAll('.sandbox-device').length, w: document.querySelectorAll('.sandbox-wire-list > div').length }));
  const setField = async (attr, value) => {
    await page.click(`[${attr}]`, { clickCount: 3 });
    await page.keyboard.type(String(value));
    await page.keyboard.press('Enter');
  };
  const typeProgram = async source => {
    await page.waitForSelector('#sandbox-st-source');
    await page.click('#sandbox-st-source');
    await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
    await page.keyboard.type(source);
    await page.waitForFunction(() => document.querySelector('.sandbox-st-status strong')?.textContent.trim() === 'Compiler OK');
    await clickText('Compile & activate ST');
    await sleep(250);
  };
  try {
    await page.goto(base + '/', { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => localStorage.clear());
    await page.click('[data-cta="simulator"]');
    await page.waitForSelector('.sandbox-toolbar', { timeout: 15000 });
    assert.deepEqual(await counts(), { d: 0, w: 0 }, 'An empty floor');

    // 1. Build: place every device from the library.
    for (const [, label] of PARTS) {
      await page.evaluate(l => [...document.querySelectorAll('.sandbox-palette-item')].find(b => b.querySelector('strong')?.textContent.trim() === l).click(), label);
      await sleep(80);
    }
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 17, { timeout: 10000 });
    // Geometry-sensitive devices are placed exactly with the inspector: sensors and the diverter beside the belt, pump/switch/valve beside the tank.
    PARTS.forEach(([, , at], i) => { if (at) PARTS[i].id = ID[Object.keys(ID)[i]]; });
    for (let i = 0; i < PARTS.length; i++) {
      const at = PARTS[i][2]; if (!at) continue;
      const id = Object.values(ID)[i];
      await page.click(`[data-device-id="${id}"] .sandbox-inspect-link`);
      await page.waitForSelector('[data-pos-x]');
      await setField('data-pos-x', at[0]); await sleep(120);
      await setField('data-pos-y', at[1]); await sleep(120);
    }

    // 2. Wire: 32 terminal-to-terminal connections.
    for (const [a, b] of WIRING) {
      await page.click(`[data-terminal-id="${a}"]`);
      await page.waitForFunction(id => document.querySelector(`[data-terminal-id="${id}"]`)?.classList.contains('selected'), {}, a);
      await page.click(`[data-terminal-id="${b}"]`);
    }
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-wire-list > div').length === 32, { timeout: 15000 });

    // 3. Program each PLC in Structured Text, written by hand in the editor.
    await page.click(`[data-plc-tab="${ID.plc1}"]`); await clickText('Structured Text (ST)'); await typeProgram(PLC_A);
    await page.click(`[data-plc-tab="${ID.plc2}"]`); await clickText('Structured Text (ST)'); await typeProgram(PLC_B);

    // 4. Check before running, with the multimeter: the second station is powered through its breaker.
    await page.select('select[aria-label="Red meter probe"]', `${ID.plc2}.L+`);
    await page.select('select[aria-label="Black meter probe"]', `${ID.plc2}.M`);
    await page.waitForFunction(() => document.querySelector('[data-meter-status]')?.textContent.trim() === '24 V DC', { timeout: 6000 });

    // 5. Commission. Nothing moves until the operator starts the line, and the tank waits for the belt.
    await clickText('▶ Run');
    await sleep(2500);
    assert.equal(await statusNow(ID.belt1), 'BELT STOPPED');
    assert.equal(await level(), 0, 'The tank is interlocked: line A is not running');
    await press(ID.start1); await sleep(300); await press(ID.start1);
    await status(ID.belt1, 'BELT MOVING');
    assert.equal(await statusNow(ID.lamp1), 'ILLUMINATED');
    await page.waitForFunction(() => Number(document.querySelector('[data-vessel] [data-tank-level]')?.textContent.replace(/[^0-9.]/g, '')) > 60, { timeout: 15000 });

    // 6. Sort parcels on line A while station B fills.
    await clickText('Feed marked parcel', `[data-lane="${ID.belt1}"]`);
    await page.waitForFunction(() => document.querySelector('[data-lane] [data-sort-rejected]')?.textContent.trim() === '1', { timeout: 25000 });
    await clickText('Feed plain parcel', `[data-lane="${ID.belt1}"]`);
    await page.waitForFunction(() => document.querySelector('[data-lane] [data-sort-accepted]')?.textContent.trim() === '1', { timeout: 25000 });

    // 7. Station B reaches HIGH and opens its drain on its own PLC.
    await page.waitForFunction(() => document.querySelector('[data-vessel] [data-tank-high]')?.textContent.trim() === 'HIGH', { timeout: 30000 });
    await page.waitForFunction(() => document.querySelector('[data-vessel] [data-tank-drain]')?.textContent.trim() === 'OPEN', { timeout: 8000 });

    // 8. A fault. The instructor panel injects a dead coil; the student sees the belt stop while the PLC still commands it.
    await page.select('[data-fault-kind]', 'contactor-coil-open');
    await page.select('[data-fault-target]', ID.con1);
    await page.click('[data-fault-inject]');
    await status(ID.belt1, 'BELT STOPPED');
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('.sandbox-lamps span')].find(e => e.textContent.trim() === 'Q0.0')?.classList.contains('lit')), true, 'The PLC still commands the belt');
    await page.select('select[aria-label="Red meter probe"]', `${ID.con1}.A1`);
    await page.select('select[aria-label="Black meter probe"]', `${ID.con1}.A2`);
    await page.waitForFunction(() => document.querySelector('[data-meter-status]')?.textContent.trim() === '24 V DC', { timeout: 6000 });
    await clickText('Pause'); await paused();
    await page.select('[data-repair-target]', ID.con1);
    await page.click('[data-repair-button]');
    await page.waitForFunction(() => document.querySelectorAll('[data-fault-item]').length === 0, { timeout: 6000 });
    await clickText('▶ Run');
    await status(ID.belt1, 'BELT MOVING');

    // 9. A short behind station B's breaker trips that breaker only; line A keeps running.
    await clickText('Pause'); await paused();
    await page.click(`[data-terminal-id="${ID.cb2}.OUT"]`);
    await page.click(`[data-terminal-id="${ID.ps2}.M0"]`);
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-wire-list > div').length === 33, { timeout: 6000 });
    await clickText('▶ Run');
    await page.waitForFunction(id => document.querySelector(`[data-device-id="${id}"] .sandbox-device-status`)?.textContent.trim() === 'TRIPPED', { timeout: 10000 }, ID.cb2);
    assert.equal(await statusNow(ID.belt1), 'BELT MOVING', 'Line A is unaffected by the short on station B');
    await clickText('Pause'); await paused();
    await page.evaluate(() => [...document.querySelectorAll('.sandbox-wire-list > div')].find(d => /breaker-11\.OUT → supply-10\.M0/.test(d.textContent)).querySelector('button').click());
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-wire-list > div').length === 32, { timeout: 6000 });
    await page.evaluate(id => document.querySelector(`[data-device-id="${id}"] .sandbox-operate`).click(), ID.cb2);
    await page.waitForFunction(id => document.querySelector(`[data-device-id="${id}"] .sandbox-device-status`)?.textContent.trim() === 'CLOSED', { timeout: 6000 }, ID.cb2);

    // 10. The whole plant is an ordinary saved project: reload and it is all still there.
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 17, { timeout: 10000 });
    assert.deepEqual(await counts(), { d: 17, w: 32 });
    await page.click(`[data-plc-tab="${ID.plc2}"]`);
    await page.waitForFunction(() => /Fill := Start AND StopOK AND NOT TankHigh/.test(document.querySelector('#sandbox-st-source')?.value ?? ''), { timeout: 6000 });
    await clickText('▶ Run');
    await press(ID.start1); await sleep(300); await press(ID.start1);
    await status(ID.belt1, 'BELT MOVING');
    assert.deepEqual(errors.filter(e => !/favicon|WebGL|GPU stall|swiftshader/i.test(e)), [], 'No page errors');
    console.log('Authored-from-empty multi-device plant E2E PASS');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
