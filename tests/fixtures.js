import { test as base, chromium } from '@playwright/test';
import path from 'path';

/**
 * Custom fixtures for Chrome extension testing
 *
 * This fixture extends the base Playwright test to provide:
 * - A persistent browser context with the extension loaded
 * - Access to the extension ID for testing popup and background pages
 * - Proper handling of Manifest V3 service workers
 */
export const test = base.extend({
  context: async ({}, use) => {
    // Path to the extension directory (current directory)
    const pathToExtension = path.resolve('./');

    // Create a persistent context with the extension loaded
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
      ],
      devtools: process.env.PLAYWRIGHT_DEVTOOLS === 'true',
    });

    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    // For Manifest V3 (service worker)
    let serviceWorker = context.serviceWorkers()[0];
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }

    // Extract extension ID from the service worker URL
    const extensionId = serviceWorker.url().split('/')[2];
    await use(extensionId);
  },

  extensionPage: async ({ context, extensionId }, use) => {
    // Create a new page for extension testing
    const page = await context.newPage();

    // Navigate to the extension's popup page
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await use(page);
    await page.close();
  },

  webPage: async ({ context }, use) => {
    // Create a new page for web content testing
    const page = await context.newPage();
    await use(page);
    await page.close();
  },
});

export const expect = test.expect;

/**
 * Helper function to wait for extension to be fully loaded
 */
export async function waitForExtensionLoad(context) {
  // Wait for service worker to be available
  let serviceWorker = context.serviceWorkers()[0];
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker');
  }

  // Wait a bit for extension to initialize
  await new Promise(resolve => setTimeout(resolve, 1000));

  return serviceWorker;
}

/**
 * Helper function to access extension storage
 */
export async function getExtensionStorage(page, keys = null) {
  return await page.evaluate((storageKeys) => {
    return new Promise((resolve) => {
      chrome.storage.local.get(storageKeys, resolve);
    });
  }, keys);
}

/**
 * Helper function to set extension storage
 */
export async function setExtensionStorage(page, data) {
  return await page.evaluate((storageData) => {
    return new Promise((resolve) => {
      chrome.storage.local.set(storageData, resolve);
    });
  }, data);
}

/**
 * Helper function to clear extension storage
 */
export async function clearExtensionStorage(page) {
  return await page.evaluate(() => {
    return new Promise((resolve) => {
      chrome.storage.local.clear(resolve);
    });
  });
}