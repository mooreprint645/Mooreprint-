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

async function installDiagnostics(page) {
  await page.addInitScript(() => {
    const key = '__mooreprintSubmitDiagnostics';
    const read = () => {
      try { return JSON.parse(sessionStorage.getItem(key) || '[]'); }
      catch (error) { return []; }
    };
    const write = entry => {
      const rows = read();
      rows.push({ time: Date.now(), ...entry });
      sessionStorage.setItem(key, JSON.stringify(rows.slice(-100)));
    };
    const formId = event => event.target?.getAttribute?.('id') || '';
    window.__readSubmitDiagnostics = read;
    window.addEventListener('error', event => write({ kind: 'page-error', message: event.message || String(event.error || '') }));
    window.addEventListener('unhandledrejection', event => write({ kind: 'rejection', message: String(event.reason?.stack || event.reason || '') }));

    const originalAdd = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (eventType, listener, options) {
      if (this === document && eventType === 'submit' && typeof listener === 'function') {
        const capture = options === true || Boolean(options && options.capture);
        const source = String(listener).slice(0, 700);
        write({ kind: 'registered', capture, source });
        const wrapped = function (event) {
          write({ kind: 'called-before', capture, formId: formId(event), defaultPrevented: event.defaultPrevented, source });
          try {
            return listener.call(this, event);
          } finally {
            write({ kind: 'called-after', capture, formId: formId(event), defaultPrevented: event.defaultPrevented, source });
          }
        };
        return originalAdd.call(this, eventType, wrapped, options);
      }
      return originalAdd.call(this, eventType, listener, options);
    };
  });
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

test('el guardado de cliente registra y ejecuta el manejador de formulario', async ({ page }) => {
  await installDiagnostics(page);
  await openApp(page);

  const registered = await page.evaluate(() => window.__readSubmitDiagnostics());
  console.log('DIAGNÓSTICO ANTES:', JSON.stringify(registered));
  expect(registered.some(row => row.kind === 'registered' && row.capture === false && row.source.includes('customerForm: saveCustomer'))).toBe(true);
  expect(registered.filter(row => row.kind === 'page-error' || row.kind === 'rejection')).toEqual([]);

  await go(page, 'customers');
  await page.locator('#newCustomerButton').click({ force: true });
  await page.locator('#customerForm [name="name"]').fill('Cliente de prueba');
  await page.locator('#customerForm [name="phone"]').fill('7220000000');
  const originalURL = page.url();
  await page.locator('button[form="customerForm"]').click({ force: true });
  await page.waitForTimeout(500);

  const diagnostics = await page.evaluate(() => window.__readSubmitDiagnostics());
  console.log('DIAGNÓSTICO DESPUÉS:', JSON.stringify(diagnostics));
  expect(diagnostics.some(row => row.kind === 'called-before' && row.formId === 'customerForm' && row.capture === false)).toBe(true);
  expect(diagnostics.some(row => row.kind === 'called-after' && row.formId === 'customerForm' && row.capture === false && row.defaultPrevented === true)).toBe(true);
  expect(page.url()).toBe(originalURL);
  await expect(page.locator('#customersGrid')).toContainText('Cliente de prueba');
});
