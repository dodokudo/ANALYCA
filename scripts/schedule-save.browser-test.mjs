import assert from 'node:assert/strict';

// Run against a dev server or the canonical production URL. All API requests
// are intercepted: this test never creates a real reservation or Threads post.
// PLAYWRIGHT_MODULE may point to an existing Playwright installation.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SCHEDULE_TEST_BASE || 'http://localhost:3000';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let currentPage;

try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, timezoneId: 'Asia/Tokyo', serviceWorkers: 'block' });
    const page = await context.newPage();
    currentPage = page;
    await page.clock.setFixedTime(new Date('2026-11-06T00:00:00Z'));
    const userId = '33833959932919231';
    const records = new Map();
    const writes = [];
    const errors = [];
    let rejectNextUpdate = false;
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.dismiss());
    await context.route('**/*', async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const method = request.method();
      if (!path.startsWith('/api/')) {
        if (!['GET', 'HEAD'].includes(method)) return route.abort();
        return route.continue();
      }
      if (path === `/api/dashboard/${userId}`) {
        return route.fulfill({ json: {
          success: true,
          user: { user_id: userId, threads_user_id: userId, threads_username: 'schedule_verification', subscription_status: 'active', plan_id: 'standard' },
          channels: { instagram: false, threads: true },
          access: { allowed: true, state: 'allowed', status: 'active', expiresAt: null },
          threadsAccess: null,
          data: {
            instagramDailyContentStats: [], reels: [], stories: [], insights: [], lineData: [],
            threads: [], threadsComments: [], threadsDailyMetrics: [], threadsDailyPostStats: [],
            summary: { totalReelsViews: 0, totalStoriesViews: 0, currentFollowers: 0, lineFollowers: 0, totalThreadsViews: 0, threadsFollowersCount: 0 },
          },
        } });
      }
      if (/^\/api\/schedule\/threads(?:\/test-\d+)?$/.test(path)) {
        if (method === 'GET') {
          const id = path.split('/').at(-1);
          return route.fulfill({ json: id === 'threads' ? { items: [...records.values()] } : { item: records.get(id) } });
        }
        assert.ok(['POST', 'PUT'].includes(method), `Unexpected mutation: ${method} ${path}`);
        const body = request.postDataJSON();
        const id = method === 'POST' ? `test-${records.size + 1}` : path.split('/').at(-1);
        writes.push({ method, id, body });
        if (method === 'PUT' && rejectNextUpdate) {
          rejectNextUpdate = false;
          return route.fulfill({ status: 500, json: { error: 'テスト用の保存エラー' } });
        }
        if (method === 'PUT') assert.ok(records.has(id), 'Update must target the existing reservation');
        const item = {
          schedule_id: id, user_id: userId, status: body.status,
          scheduled_time: `${body.scheduledAt}:00+09:00`, scheduled_at_jst: `${body.scheduledAt}:00+09:00`,
          scheduled_date: body.scheduledAt.slice(0, 10), main_text: body.mainText,
          ...Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`comment${i + 1}`, body[`comment${i + 1}`] || ''])),
          main_media_urls: '[]', main_media_types: '[]',
        };
        records.set(id, item);
        return route.fulfill({ json: { item } });
      }
      // Includes access logging, immediate publishing, cron and all other APIs.
      return route.fulfill({ json: { success: true, items: [] } });
    });
    const url = `${base}/${userId}?tab=threads&threadsTab=schedule`;
    const main = page.getByLabel(/^メイン投稿（必須）/);
    const scheduleButton = () => page.getByRole('button', { name: /^(予約登録|予約を更新)$/ }).first();
    const save = async (button = scheduleButton()) => {
      const response = page.waitForResponse(r => /\/api\/schedule\/threads(?:\/test-\d+)?\?/.test(r.url()) && ['POST', 'PUT'].includes(r.request().method()));
      await button.click();
      await response;
      await page.getByRole('button', { name: /^(予約登録|予約を更新)$/ }).first().waitFor();
    };
    await page.goto(url);
    await main.waitFor({ timeout: 60000 });
    await page.getByLabel('予約日時（JST）', { exact: true }).fill('2026-11-06T18:00');
    await main.fill('保存後の修正を確認するテスト');
    await save();
    await main.fill('保存後に文章を修正');
    await save();
    assert.equal(records.size, 1, 'Editing immediately after creation must not create a second reservation');
    assert.deepEqual(writes.map(w => w.method), ['POST', 'PUT']);
    assert.equal(records.get('test-1').main_text, '保存後に文章を修正');
    await page.getByText('選択中の予約を編集', { exact: true }).waitFor();

    // Draft -> scheduled and time changes must keep the original ID, too.
    await save(page.getByRole('button', { name: '下書き保存', exact: true }));
    assert.equal(records.get('test-1').status, 'draft');
    await page.getByLabel('予約日時（JST）', { exact: true }).fill('2026-11-07T18:00');
    await save();
    assert.equal(records.size, 1);
    assert.equal(records.get('test-1').status, 'scheduled');
    assert.equal(records.get('test-1').scheduled_date, '2026-11-07');

    // Reopen a persisted reservation, then save and retry a failed update.
    await page.goto(`${url}&scheduleId=test-1`);
    await page.getByText('選択中の予約を編集', { exact: true }).waitFor();
    assert.equal(await main.inputValue(), '保存後に文章を修正');
    await main.fill('再読込後の修正');
    rejectNextUpdate = true;
    await save();
    assert.equal(await main.inputValue(), '再読込後の修正');
    await save();
    assert.equal(records.size, 1);
    assert.equal(records.get('test-1').main_text, '再読込後の修正');
    assert.equal(writes.filter(w => w.method === 'POST').length, 1);

    // Deliberate new creation still works; saving that draft again updates it.
    await page.goto(url);
    await page.getByText('新規予約を作成', { exact: true }).waitFor();
    await page.getByLabel('予約日時（JST）', { exact: true }).fill('2026-11-08T18:00');
    await main.fill('意図して追加する別の下書き');
    await save(page.getByRole('button', { name: '下書き保存', exact: true }));
    await main.fill('別の下書きも同じIDのまま修正');
    await save();
    assert.equal(records.size, 2);
    assert.equal(writes.filter(w => w.method === 'POST').length, 2);
    assert.equal(records.get('test-2').main_text, '別の下書きも同じIDのまま修正');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ base, width, result: 'PASS', newReservations: 2, creates: 2, updates: writes.filter(w => w.method === 'PUT').length, realApiWrites: 0 }));
    await context.close();
  }
} catch (error) {
  if (currentPage) console.error((await currentPage.locator('body').innerText()).slice(0,5000));
  throw error;
} finally {
  await browser.close();
}
