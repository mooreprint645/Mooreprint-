const { test, expect } = require('@playwright/test');
const path = require('path');

test('el puente mantiene sincronizado el estado léxico y window.state', async ({ page }) => {
  await page.setContent('<!doctype html><html><body><script>let state = { value: 1 };</script></body></html>');
  await page.addScriptTag({ path: path.join(process.cwd(), 'state-bridge.js') });

  expect(await page.evaluate(() => window.state.value)).toBe(1);

  await page.evaluate(() => { window.state = { value: 2 }; });
  expect(await page.evaluate(() => state.value)).toBe(2);

  await page.evaluate(() => { state.value = 3; });
  expect(await page.evaluate(() => window.state.value)).toBe(3);
});

test('los upserts de clientes y cotizaciones pasan por RPC segura', async ({ page }) => {
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ path: path.join(process.cwd(), 'granular-sync-guard.js') });

  await page.evaluate(() => {
    window.__rpcCalls = [];
    window.__originalUpserts = [];

    window.supabase = {
      createClient() {
        const client = {
          rpc(name, params) {
            window.__rpcCalls.push({ name, params });
            return Promise.resolve({ data: 1, error: null });
          },
          from(table) {
            return {
              upsert(rows, options) {
                window.__originalUpserts.push({ table, rows, options });
                return Promise.resolve({ data: rows, error: null });
              }
            };
          }
        };
        return client;
      }
    };

    window.__guardClient = window.supabase.createClient('url', 'key');
  });

  await page.evaluate(async () => {
    await window.__guardClient.from('team_customers').upsert([{ customer_id: 'c-1' }], { onConflict: 'business_id,customer_id' });
    await window.__guardClient.from('team_quotes').upsert([{ quote_id: 'q-1' }], { onConflict: 'business_id,quote_id' });
    await window.__guardClient.from('other_table').upsert([{ id: 'x-1' }]);
  });

  const rpcCalls = await page.evaluate(() => window.__rpcCalls);
  expect(rpcCalls).toEqual([
    { name: 'sync_team_customers', params: { p_rows: [{ customer_id: 'c-1' }] } },
    { name: 'sync_team_quotes', params: { p_rows: [{ quote_id: 'q-1' }] } }
  ]);

  const originalUpserts = await page.evaluate(() => window.__originalUpserts);
  expect(originalUpserts).toHaveLength(1);
  expect(originalUpserts[0].table).toBe('other_table');
});
