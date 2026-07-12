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

function type(file) {
  return ({ '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream';
}

async function openApp(page) {
  await page.route('https://cdn.jsdelivr.net/**', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.supabase={createClient(){return {};}};' }));
  await page.goto(baseURL);
  await page.waitForFunction(() => window.__appReady === true);
}

async function go(page, section) {
  await page.evaluate(name => window.navigate(name), section);
  await expect(page.locator(`#${section}`)).toHaveClass(/active/);
}

async function saveForm(page, formId) {
  await page.locator(`button[form="${formId}"]`).click({ force: true });
  await expect(page.locator('#modalBackdrop')).toBeHidden();
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
    response.writeHead(200, { 'Content-Type': type(file) });
    response.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseURL = `http://127.0.0.1:${server.address().port}`;
});

test.afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
});

test('el botón Guardar cliente ejecuta el guardado y actualiza la lista', async ({ page }) => {
  await openApp(page);
  await go(page, 'customers');
  await page.locator('#newCustomerButton').click({ force: true });
  await page.locator('#customerForm [name="name"]').fill('Cliente de prueba');
  await page.locator('#customerForm [name="phone"]').fill('7220000000');
  await saveForm(page, 'customerForm');
  await expect(page.locator('#customersGrid')).toContainText('Cliente de prueba');
  await expect(page).toHaveURL(baseURL + '/');
});
