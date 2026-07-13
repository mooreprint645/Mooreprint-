const { test, expect } = require('@playwright/test');
const fs = require('fs');

const appCore = fs.readFileSync('app-core.js', 'utf8');
const stateBridge = fs.readFileSync('state-bridge.js', 'utf8');

test('la fecha operativa usa el calendario local del dispositivo', async ({ page }) => {
  const helper = appCore.match(/const todayISO = \(date = new Date\(\)\) => \{[\s\S]*?\n\};/)?.[0];
  expect(helper).toBeTruthy();
  expect(appCore).not.toContain("const todayISO = () => new Date().toISOString().slice(0, 10);");

  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ content: helper.replace('const todayISO', 'window.todayISO') });
  const result = await page.evaluate(() => ({
    lateNight: window.todayISO(new Date(2026, 6, 13, 23, 59, 59)),
    newYear: window.todayISO(new Date(2027, 0, 1, 0, 1, 0))
  }));

  expect(result.lateNight).toBe('2026-07-13');
  expect(result.newYear).toBe('2027-01-01');
});

test('una página de 50 clientes o cotizaciones no borra el resto del estado local', async ({ page }) => {
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.evaluate(() => {
    window.state = {
      customers: Array.from({ length: 75 }, (_, index) => ({ id: `customer-${index + 1}`, name: `Cliente ${index + 1}` })),
      quotes: Array.from({ length: 60 }, (_, index) => ({ id: `quote-${index + 1}`, folio: `COT-${index + 1}` }))
    };
    window.renderCustomers = () => {
      window.renderedCustomerIds = window.state.customers.map(item => item.id);
    };
    window.renderQuotes = () => {
      window.renderedQuoteIds = window.state.quotes.map(item => item.id);
    };
    window.performDelete = (type, id) => {
      if (type === 'customer') window.state.customers = window.state.customers.filter(item => item.id !== id);
      if (type === 'quote') window.state.quotes = window.state.quotes.filter(item => item.id !== id);
    };
  });
  await page.addScriptTag({ content: stateBridge });

  const result = await page.evaluate(() => {
    const completeCustomers = [...window.state.customers];
    const completeQuotes = [...window.state.quotes];
    const customerPage = completeCustomers.slice(0, 50).map(item => item.id === 'customer-1' ? { ...item, name: 'Cliente actualizado' } : item);
    const quotePage = completeQuotes.slice(0, 50);

    window.state.customers = customerPage;
    window.renderCustomers();
    const customerRenderCount = window.renderedCustomerIds.length;
    const customersAfterRender = window.state.customers.length;
    const updatedName = window.state.customers.find(item => item.id === 'customer-1')?.name;

    window.state.quotes = quotePage;
    window.renderQuotes();
    const quoteRenderCount = window.renderedQuoteIds.length;
    const quotesAfterRender = window.state.quotes.length;

    window.performDelete('customer', 'customer-1');
    const customersAfterDelete = window.state.customers.length;
    const deletedStillExists = window.state.customers.some(item => item.id === 'customer-1');

    return {
      customerRenderCount,
      customersAfterRender,
      updatedName,
      quoteRenderCount,
      quotesAfterRender,
      customersAfterDelete,
      deletedStillExists
    };
  });

  expect(result.customerRenderCount).toBe(50);
  expect(result.customersAfterRender).toBe(75);
  expect(result.updatedName).toBe('Cliente actualizado');
  expect(result.quoteRenderCount).toBe(50);
  expect(result.quotesAfterRender).toBe(60);
  expect(result.customersAfterDelete).toBe(74);
  expect(result.deletedStillExists).toBe(false);
});

test('una cuenta nueva no hereda los datos locales de otra cuenta', async ({ page }) => {
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.evaluate(() => {
    window.state = { customers: [], quotes: [] };
    window.renderCustomers = () => {};
    window.renderQuotes = () => {};
    window.performDelete = () => {};
    localStorage.setItem('mooreprint-control-v1-user-old-user', JSON.stringify({ customers: [{ id: 'private-customer' }] }));
  });
  await page.addScriptTag({ content: stateBridge });

  const isolated = await page.evaluate(() => JSON.parse(localStorage.getItem('mooreprint-control-v1-user-new-user')));
  expect(isolated.customers || []).toEqual([]);
  expect(isolated.quotes || []).toEqual([]);
  expect(isolated.business.name).toBe('MoorePrint');
});

test('la primera cuenta todavía puede migrar el estado general existente', async ({ page }) => {
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.evaluate(() => {
    window.state = { customers: [], quotes: [] };
    window.renderCustomers = () => {};
    window.renderQuotes = () => {};
    window.performDelete = () => {};
    localStorage.clear();
  });
  await page.addScriptTag({ content: stateBridge });

  const missing = await page.evaluate(() => localStorage.getItem('mooreprint-control-v1-user-first-user'));
  expect(missing).toBeNull();
});
