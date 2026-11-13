/**
 * SOURCE-ONLY P1 browser acceptance recipe for the integration developer.
 * Mandatory combined-branch browser regression: place, group select, duplicate,
 * undo/redo, rotate, in-app copy/paste and persistence. Physical device and
 * production acceptance remain separate.
 */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
const STORAGE = 'efo-open-sandbox-project-v1';
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: [
    '--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  ] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  const clickText = async label => {
    const found = await page.evaluate(value => {
      const button = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === value);
      if (!button || button.disabled) return false;
      button.click();
      return true;
    }, label);
    assert.ok(found, 'Expected enabled command: ' + label);
  };
  const count = expected => page.waitForFunction(target =>
    document.querySelectorAll('.sandbox-device').length === target, { timeout: 12000 }, expected);
  const saved = async () => page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), STORAGE);
  try {
    await page.setViewport({ width: 1440, height: 940, deviceScaleFactor: 1 });
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.sandbox-palette-item');

    // P1 authoring without selecting a lesson, question or grading screen.
    const place = async label => {
      const found = await page.evaluate(value => {
        const button = [...document.querySelectorAll('.sandbox-palette-item')]
          .find(b => b.querySelector('strong')?.textContent.trim() === value);
        if (!button || button.disabled) return false;
        button.click();
        return true;
      }, label);
      assert.ok(found, 'Equipment available in catalogue: ' + label);
    };
    await place('24V supply');
    await count(1);
    await place('24V pilot lamp');
    await count(2);
    await page.click('[data-workspace-selection] summary');
    await clickText('Select all');
    await page.waitForFunction(() =>
      document.querySelectorAll('[data-workspace-selection] input:checked').length === 2);

    const originalIds = (await saved()).components.map(c => c.id);
    await page.click('[data-duplicate]');
    await count(4);
    await page.click('[data-undo]');
    await count(2);
    await page.click('[data-redo]');
    await count(4);
    // Undo/redo intentionally clears selection to prevent stale IDs controlling
    // a replaced project. Re-select the original two devices through real
    // workspace checkboxes before rotating, copying and pasting them.
    await page.waitForFunction(() =>
      document.querySelectorAll('[data-workspace-selection] input[type="checkbox"]:checked').length === 0);
    const selectedAgain = await page.evaluate(ids => {
      let count = 0;
      for (const label of document.querySelectorAll('[data-workspace-selection] .workspace-selection-list label')) {
        const id = label.querySelector('small')?.textContent?.split(' · ')[0];
        const input = label.querySelector('input[type="checkbox"]');
        if (input && ids.includes(id) && !input.checked) { input.click(); count++; }
      }
      return count;
    }, originalIds);
    assert.equal(selectedAgain, 2, 'Original devices must be selectable after redo');
    await page.waitForFunction(() =>
      document.querySelectorAll('[data-workspace-selection] input[type="checkbox"]:checked').length === 2);

    await clickText('↷ 90°');
    await page.waitForFunction(key => {
      const data = JSON.parse(localStorage.getItem(key) || 'null');
      return data?.components?.filter(c => c.yawDeg === 90).length === 2;
    }, { timeout: 12000 }, STORAGE);

    await clickText('Copy');
    await clickText('Paste');
    await count(6);
    assert.equal((await saved()).components.length, 6);
    await page.reload({ waitUntil: 'networkidle0' });
    await count(6);
    assert.equal((await saved()).components.filter(c => c.yawDeg === 90).length, 4);
    // The copied units receive fresh IDs and no hidden previously connected external wires.
    const project = await saved();
    assert.equal(new Set(project.components.map(c => c.id)).size, 6);
    assert.equal(project.wires.length, 0);
    assert.deepEqual(errors.filter(e => !/WebGL|favicon|GPU stall/i.test(e)), []);
    console.log('P1 SOURCE ACCEPTANCE PASS: select/duplicate/undo/redo/rotate/copy/paste/save');
  } finally { await browser.close(); }
})().catch(error => {
  console.error('P1 SOURCE ACCEPTANCE FAIL', error.stack || String(error));
  process.exitCode = 1;
});
