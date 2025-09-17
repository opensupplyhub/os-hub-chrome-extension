import { test, expect } from './fixtures.js';
import { waitForExtensionLoad, getExtensionStorage, setExtensionStorage, clearExtensionStorage } from './fixtures.js';

test.describe('OS Hub Chrome Extension', () => {
  test.beforeEach(async ({ context }) => {
    // Clear storage before each test
    const pages = context.pages();
    if (pages.length > 0) {
      await clearExtensionStorage(pages[0]);
    }
  });

  test('extension loads successfully', async ({ context, extensionId }) => {
    expect(extensionId).toBeTruthy();
    expect(extensionId).toMatch(/^[a-z]{32}$/); // Chrome extension ID format

    // Verify service worker is running
    const serviceWorkers = context.serviceWorkers();
    expect(serviceWorkers.length).toBeGreaterThan(0);

    const serviceWorker = serviceWorkers[0];
    expect(serviceWorker.url()).toContain(extensionId);
  });

  test('popup page loads and displays correctly', async ({ extensionPage }) => {
    // Check that popup.html loads
    await expect(extensionPage).toHaveTitle(/OS Hub/i);

    // Verify main UI elements exist
    await expect(extensionPage.locator('#environment-select')).toBeVisible();
    await expect(extensionPage.locator('#api-key-input')).toBeVisible();
    await expect(extensionPage.locator('#submit-button')).toBeVisible();

    // Check for form fields
    await expect(extensionPage.locator('#facility-name')).toBeVisible();
    await expect(extensionPage.locator('#facility-address')).toBeVisible();
    await expect(extensionPage.locator('#country-select')).toBeVisible();
  });

  test('environment switcher works', async ({ extensionPage }) => {
    const environmentSelect = extensionPage.locator('#environment-select');

    // Should default to staging
    await expect(environmentSelect).toHaveValue('staging');

    // Switch to production
    await environmentSelect.selectOption('production');
    await expect(environmentSelect).toHaveValue('production');

    // API endpoint URL should update
    const apiUrlDisplay = extensionPage.locator('.api-endpoint');
    await expect(apiUrlDisplay).toContainText('opensupplyhub.org');
  });

  test('API key storage and retrieval', async ({ extensionPage }) => {
    const apiKeyInput = extensionPage.locator('#api-key-input');
    const testApiKey = 'test-api-key-12345';

    // Enter API key
    await apiKeyInput.fill(testApiKey);
    await extensionPage.locator('#save-api-key').click();

    // Reload popup and verify API key persists
    await extensionPage.reload();
    await expect(apiKeyInput).toHaveValue(testApiKey);
  });

  test('content script context menu integration', async ({ context, webPage }) => {
    // Navigate to a test page
    await webPage.goto('https://example.com');

    // Select some text
    await webPage.locator('h1').click();
    await webPage.keyboard.press('Control+A'); // Select all text in h1

    // Right-click to open context menu
    await webPage.locator('h1').click({ button: 'right' });

    // Context menu should contain OS Hub options
    // Note: Testing context menus in Playwright can be challenging
    // This is a placeholder for context menu testing logic
  });

  test('text highlighting functionality', async ({ context, webPage }) => {
    await webPage.goto('https://example.com');

    // Inject our content script manually for testing
    await webPage.addScriptTag({ path: './content.js' });

    // Select text and trigger highlighting
    const heading = webPage.locator('h1');
    await heading.selectText();

    // Simulate context menu action (this would normally come from background.js)
    await webPage.evaluate(() => {
      // Simulate the message that would come from context menu click
      window.postMessage({
        type: 'SAVE_SELECTED_TEXT',
        field: 'facility-name',
        text: document.getSelection().toString()
      }, '*');
    });

    // Verify text was highlighted
    await expect(webPage.locator('.os-hub-highlight')).toBeVisible();
  });

  test('form validation works correctly', async ({ extensionPage }) => {
    const submitButton = extensionPage.locator('#submit-button');

    // Try to submit empty form
    await submitButton.click();

    // Should show validation errors
    await expect(extensionPage.locator('.error-message')).toBeVisible();

    // Fill required fields
    await extensionPage.locator('#facility-name').fill('Test Facility');
    await extensionPage.locator('#facility-address').fill('123 Test St');
    await extensionPage.locator('#country-select').selectOption('US');

    // Validation errors should be gone
    await expect(extensionPage.locator('.error-message')).not.toBeVisible();
  });

  test('parent company autocomplete', async ({ extensionPage }) => {
    const parentCompanyInput = extensionPage.locator('#parent-company');

    // Type in parent company input
    await parentCompanyInput.fill('Nike');

    // Wait for autocomplete suggestions
    await expect(extensionPage.locator('.autocomplete-suggestion')).toBeVisible();

    // Click on a suggestion
    await extensionPage.locator('.autocomplete-suggestion').first().click();

    // Input should be filled with selected value
    expect(await parentCompanyInput.inputValue()).toBeTruthy();
  });

  test('storage persistence across extension sessions', async ({ context, extensionPage }) => {
    // Set some form data
    await extensionPage.locator('#facility-name').fill('Persistent Facility');
    await extensionPage.locator('#facility-address').fill('456 Persistent Ave');

    // Data should be saved to storage
    const storage = await getExtensionStorage(extensionPage);
    expect(storage['facility-name']).toBe('Persistent Facility');
    expect(storage['facility-address']).toBe('456 Persistent Ave');

    // Close and reopen popup
    await extensionPage.close();
    const newPage = await context.newPage();
    await newPage.goto(`chrome-extension://${context.serviceWorkers()[0].url().split('/')[2]}/popup.html`);

    // Data should be restored
    await expect(newPage.locator('#facility-name')).toHaveValue('Persistent Facility');
    await expect(newPage.locator('#facility-address')).toHaveValue('456 Persistent Ave');

    await newPage.close();
  });

  test('data submission workflow', async ({ extensionPage }) => {
    // Fill out complete form
    await extensionPage.locator('#facility-name').fill('Test Manufacturing Co');
    await extensionPage.locator('#facility-address').fill('789 Factory Rd, Industrial District');
    await extensionPage.locator('#country-select').selectOption('CN');
    await extensionPage.locator('#sector-select').selectOption('Apparel');
    await extensionPage.locator('#product-type-select').selectOption('Finished Goods');

    // Set API key
    await extensionPage.locator('#api-key-input').fill('test-key');

    // Mock the API response
    await extensionPage.route('**/api/v1/production-locations/', async route => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 12345,
          name: 'Test Manufacturing Co',
          status: 'CONFIRMED'
        })
      });
    });

    // Submit form
    await extensionPage.locator('#submit-button').click();

    // Should show success message
    await expect(extensionPage.locator('.success-message')).toBeVisible();
    await expect(extensionPage.locator('.success-message')).toContainText('successfully submitted');
  });
});