const { test, expect } = require('@playwright/test');
const http = require('http');
const fs = require('fs');
const path = require('path');

let server;
let baseURL;

const stubs = {
  'local-protection.js': '',
  'pwa.js': '',
  'advanced-fixes.js': 'window.MoorePrintAdvanced={init(){}};',
  'advanced-features.js': '',
  'performance-fixes.js': 'window.MoorePrintPerformance={init(){}};',
  'supabase-cloud.js': 'document.documentElement.classList.add("mooreprint-auth-ui-ready","mooreprint-access-granted");window.MoorePrintCloud={init:async()=>{window.__appReady=true;},hasAccess:()=>true,getClient:()=>null};',
  'team-workflow.js': 'window.MoorePrintTeamWorkflow={init(){}};',
  'state-bridge.js': '',
  'granular-sync-guard.js': 'window.MoorePrintGranularSync={install(){}};',
  'team-improvements.js': 'window.MoorePrintTeamImprovements={init(){},setStatus(){}};',
  'startup-query-limit.js': 'window.MoorePrintStartupLimit={install(){}};',
  'select-innerhtml-stability.js': '',
  'team-operations.js': 'window.MoorePrintOperations={init(){},sync(){return Promise.resolve();}};',
  'team-operations-ui-guard.js': '',
  'team-hardening.js': 'window.MoorePrintHardening={isReady:()=>false};',
  'branch-access.js': 'window.MoorePrintBranches={getContext:()=>({businessId:"",branchId:"",selectedBranchId:""}),getSelectedBranchId:()=>"",getProfile:()=>null,isAdmin:()=>true,can:()=>true};',
  'catalog-cloud.js': '',
  'overhead-cloud.js': '',
  'usability.js': '',
  'mobile-fixes.js': ''
};

function contentType(file) {
  return ({
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png'
  })[path.extname(file)] || 'application/octet-stream';
}

async function openApp(page) {
  await page.route('https://cdn.jsdelivr.net/**', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: 'window.supabase={createClient(){return {};}};'
  }));
  await page.goto(baseURL);
  await page.waitForFunction(() => window.__appReady === true);
}

async function navigate(page, section) {
  await page.evaluate(sectionName => window.navigate(sectionName), section);
  await expect(page.locator(`#${section}`)).toHaveClass(/active/);
}

async function saveForm(page, formId) {
  const url = page.url();
  const button = page.locator(`button[form="${formId}"]`);
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.locator('#modalBackdrop')).toBeHidden();
  expect(page.url()).toBe(url);
}

test.beforeAll(async () => {
  server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    const requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^\/+/, '');
    if (Object.prototype.hasOwnProperty.call(stubs, requested)) {
      response.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
      response.end(stubs[requested]);
      return;
    }
    const file = path.join(process.cwd(), requested);
    if (!file.startsWith(process.cwd()) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': contentType(file) });
    response.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseURL = `http://127.0.0.1:${server.address().port}`;
});

test.afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
});

test('crear y editar formularios consecutivos no pierde el guardado', async ({ page }) => {
  await openApp(page);

  await navigate(page, 'customers');
  await page.locator('#newCustomerButton').click();
  await page.locator('#customerForm [name="name"]').fill('Cliente de prueba');
  await page.locator('#customerForm [name="phone"]').fill('7220000000');
  await saveForm(page, 'customerForm');
  await expect(page.locator('#customersGrid')).toContainText('Cliente de prueba');

  await page.locator('#customersGrid [data-edit-customer]').click();
  await page.locator('#customerForm [name="phone"]').fill('7221111111');
  await saveForm(page, 'customerForm');
  await expect(page.locator('#customersGrid')).toContainText('7221111111');

  await navigate(page, 'suppliers');
  await page.locator('#newSupplierButton').click();
  await page.locator('#supplierForm [name="name"]').fill('Proveedor de prueba');
  await page.locator('#supplierForm [name="phone"]').fill('7222222222');
  await saveForm(page, 'supplierForm');
  await expect(page.locator('#suppliersGrid')).toContainText('Proveedor de prueba');
});
