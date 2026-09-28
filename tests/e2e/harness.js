// Browser test harness: serves the repo root statically, launches Chromium,
// and blocks the vega CDN so runs are deterministic and offline-safe (the app
// falls back to its built-in preview when vega-embed is absent).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

function candidateBrowsers() {
  return [
    process.env.CHROMIUM_PATH,
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome'
  ].filter(Boolean);
}

export async function startApp() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  const executablePath = candidateBrowsers().find((candidate) => fs.existsSync(candidate));
  const browser = await chromium.launch({
    ...(executablePath ? { executablePath } : {}),
    args: ['--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });

  const errors = [];
  await page.route(/cdn\.jsdelivr\.net/, (route) => route.abort());
  page.on('console', (message) => {
    const text = message.text();
    if (['error', 'warning'].includes(message.type()) && !/ERR_FAILED|ERR_BLOCKED|favicon|Failed to load resource/.test(text)) {
      errors.push(`${message.type()}: ${text}`);
    }
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

  // Record spoken text without needing real speech output.
  await page.addInitScript(() => {
    window.__spoken = [];
    const synth = window.speechSynthesis;
    if (synth) {
      const speak = synth.speak.bind(synth);
      synth.speak = (utterance) => {
        window.__spoken.push(utterance.text);
        try { speak(utterance); } catch (error) { /* no audio backend */ }
      };
    }
  });

  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForSelector('#scale-controls .scale-card');

  const app = {
    page,
    errors,
    spec: async () => JSON.parse(await page.textContent('#spec-json')),
    text: async (selector) => (await page.textContent(selector)).trim(),
    tableRows: () => page.$$eval('.data-table-shell tbody tr', (rows) => rows.length),
    wait: (ms) => page.waitForTimeout(ms),
    // The app writes the live region on the next animation frame, so poll.
    announced: async (pattern, timeout = 3000) => {
      const deadline = Date.now() + timeout;
      let last = '';
      while (Date.now() < deadline) {
        last = (await page.textContent('#announcer')).trim();
        if (pattern.test(last)) return last;
        await page.waitForTimeout(40);
      }
      throw new Error(`Announcement ${pattern} not seen; last was "${last}"`);
    },
    addTransform: async (type, fill) => {
      await page.selectOption('#transform-type', type);
      await fill(page);
      await page.click('#transform-form button[type=submit]');
      await page.waitForTimeout(100);
    },
    close: async () => {
      await browser.close();
      await new Promise((resolve) => server.close(resolve));
    }
  };
  return app;
}
