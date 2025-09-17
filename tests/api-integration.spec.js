import { test, expect } from './fixtures.js';
import { waitForExtensionLoad, getExtensionStorage, setExtensionStorage, clearExtensionStorage } from './fixtures.js';

test.describe('Open Supply Hub API Integration', () => {
  test.beforeEach(async ({ context }) => {
    // Clear storage before each test
    const pages = context.pages();
    if (pages.length > 0) {
      await clearExtensionStorage(pages[0]);
    }
  });

  test('successfully submits single location to staging API', async ({ webPage }) => {
    await webPage.goto('https://example.com');
    await webPage.addScriptTag({ path: './content.js' });
    await webPage.addStyleTag({ path: './content.css' });

    // Mock successful API response
    await webPage.route('**/api/v1/production-locations/', async route => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          moderation_id: 'TEST123',
          os_id: 'US2024001TEST',
          name: 'Test Facility',
          address: '123 Test St, Test City, TC 12345',
          country: 'US'
        })
      });
    });

    // Simulate Facebook extraction that triggers review popup
    await webPage.evaluate(() => {
      const testData = {
        name: 'Test Facility',
        address: '123 Test St, Test City, TC 12345',
        country: 'US'
      };
      showDataReviewPopup(testData);
    });

    const popup = await webPage.locator('#os-hub-data-review-popup');
    await expect(popup).toBeVisible({ timeout: 5000 });

    // Fill in API key and submit
    await popup.locator('#os-hub-api-key').fill('test-staging-key');
    await popup.locator('#os-hub-submit-btn').click();

    // Verify success message
    const statusElement = popup.locator('#os-hub-submit-status');
    await expect(statusElement).toContainText('successfully submitted', { timeout: 10000 });
    await expect(statusElement).toContainText('TEST123'); // Moderation ID
  });

  test('handles API validation errors correctly', async ({ webPage }) => {
    await webPage.goto('https://example.com');
    await webPage.addScriptTag({ path: './content.js' });
    await webPage.addStyleTag({ path: './content.css' });

    // Mock API validation error
    await webPage.route('**/api/v1/production-locations/', async route => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          detail: 'Country code is invalid',
          errors: {
            country: ['Invalid country code provided']
          }
        })
      });
    });

    await webPage.evaluate(() => {
      const testData = {
        name: 'Test Facility',
        address: '123 Test St, Test City, TC 12345',
        country: 'INVALID'
      };
      showDataReviewPopup(testData);
    });

    const popup = await webPage.locator('#os-hub-data-review-popup');
    await expect(popup).toBeVisible({ timeout: 5000 });

    await popup.locator('#os-hub-api-key').fill('test-staging-key');
    await popup.locator('#os-hub-submit-btn').click();

    const statusElement = popup.locator('#os-hub-submit-status');
    await expect(statusElement).toContainText('Country code is invalid', { timeout: 10000 });
  });

  test('handles authentication errors', async ({ webPage }) => {
    await webPage.goto('https://example.com');
    await webPage.addScriptTag({ path: './content.js' });
    await webPage.addStyleTag({ path: './content.css' });

    // Mock authentication error
    await webPage.route('**/api/v1/production-locations/', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          detail: 'Invalid authentication credentials'
        })
      });
    });

    await webPage.evaluate(() => {
      const testData = {
        name: 'Test Facility',
        address: '123 Test St, Test City, TC 12345',
        country: 'US'
      };
      showDataReviewPopup(testData);
    });

    const popup = await webPage.locator('#os-hub-data-review-popup');
    await expect(popup).toBeVisible({ timeout: 5000 });

    await popup.locator('#os-hub-api-key').fill('invalid-key');
    await popup.locator('#os-hub-submit-btn').click();

    const statusElement = popup.locator('#os-hub-submit-status');
    await expect(statusElement).toContainText('Invalid authentication credentials', { timeout: 10000 });
  });

  test('bulk submission works for multiple LinkedIn locations', async ({ webPage }) => {
    await webPage.goto('https://example.com');
    await webPage.addScriptTag({ path: './content.js' });
    await webPage.addStyleTag({ path: './content.css' });

    let submissionCount = 0;
    // Mock successful API responses for multiple submissions
    await webPage.route('**/api/v1/production-locations/', async route => {
      submissionCount++;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          moderation_id: `TEST${submissionCount}`,
          os_id: `US2024${submissionCount.toString().padStart(3, '0')}TEST`,
          name: `Test Location ${submissionCount}`,
          address: `${100 + submissionCount} Test St, Test City, TC 12345`,
          country: 'US'
        })
      });
    });

    // Create test LinkedIn locations
    const testLocations = [
      {
        name: 'Test Corp - Headquarters',
        address: '123 Main St, New York, NY 10001',
        country: 'US'
      },
      {
        name: 'Test Corp - Manufacturing',
        address: '456 Factory Rd, Detroit, MI 48201',
        country: 'US'
      },
      {
        name: 'Test Corp - R&D',
        address: '789 Innovation Blvd, Austin, TX 73301',
        country: 'US'
      }
    ];

    // Show LinkedIn bulk submission popup
    await webPage.evaluate((locations) => {
      showLinkedInBulkSubmissionPopup(locations);
    }, testLocations);

    const bulkPopup = await webPage.locator('#os-hub-linkedin-bulk-popup');
    await expect(bulkPopup).toBeVisible({ timeout: 5000 });

    // Verify all location forms are present
    const locationForms = bulkPopup.locator('.os-hub-location-form');
    await expect(locationForms).toHaveCount(3);

    // Fill in API key
    await bulkPopup.locator('#os-hub-bulk-api-key').fill('test-api-key');

    // Submit all locations
    await bulkPopup.locator('#os-hub-bulk-submit-btn').click();

    // Wait for bulk submission to complete
    const statusElement = bulkPopup.locator('#os-hub-bulk-submit-status');
    await expect(statusElement).toContainText('All 3 locations submitted successfully', { timeout: 15000 });

    // Verify progress completed
    const progressText = bulkPopup.locator('.os-hub-progress-text');
    await expect(progressText).toContainText('Completed: 3 successful, 0 errors');

    expect(submissionCount).toBe(3);
  });

  test('bulk submission handles partial failures', async ({ webPage }) => {
    await webPage.goto('https://example.com');
    await webPage.addScriptTag({ path: './content.js' });
    await webPage.addStyleTag({ path: './content.css' });

    let submissionCount = 0;
    // Mock mixed success/failure responses
    await webPage.route('**/api/v1/production-locations/', async route => {
      submissionCount++;

      if (submissionCount === 2) {
        // Second submission fails
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            detail: 'Address is required'
          })
        });
      } else {
        // Other submissions succeed
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            moderation_id: `TEST${submissionCount}`,
            os_id: `US2024${submissionCount.toString().padStart(3, '0')}TEST`,
            name: `Test Location ${submissionCount}`,
            address: `${100 + submissionCount} Test St, Test City, TC 12345`,
            country: 'US'
          })
        });
      }
    });

    const testLocations = [
      {
        name: 'Test Corp - Success 1',
        address: '123 Main St, New York, NY 10001',
        country: 'US'
      },
      {
        name: 'Test Corp - Will Fail',
        address: '', // Empty address will cause failure
        country: 'US'
      },
      {
        name: 'Test Corp - Success 2',
        address: '789 Innovation Blvd, Austin, TX 73301',
        country: 'US'
      }
    ];

    await webPage.evaluate((locations) => {
      showLinkedInBulkSubmissionPopup(locations);
    }, testLocations);

    const bulkPopup = await webPage.locator('#os-hub-linkedin-bulk-popup');
    await expect(bulkPopup).toBeVisible({ timeout: 5000 });

    await bulkPopup.locator('#os-hub-bulk-api-key').fill('test-api-key');
    await bulkPopup.locator('#os-hub-bulk-submit-btn').click();

    // Wait for completion with partial failures
    const statusElement = bulkPopup.locator('#os-hub-bulk-submit-status');
    await expect(statusElement).toContainText('2 successful, 1 failed', { timeout: 15000 });
  });

  test('parent company search works correctly', async ({ webPage }) => {
    await webPage.goto('https://example.com');
    await webPage.addScriptTag({ path: './content.js' });
    await webPage.addStyleTag({ path: './content.css' });

    // Mock parent company search API
    await webPage.route('**/api/v1/parent-companies/*', async route => {
      const url = new URL(route.request().url());
      const query = url.searchParams.get('name');

      let companies = [];
      if (query.toLowerCase().includes('nike')) {
        companies = [
          { name: 'Nike, Inc.' },
          { name: 'Nike International Ltd.' }
        ];
      } else if (query.toLowerCase().includes('apple')) {
        companies = [
          { name: 'Apple Inc.' },
          { name: 'Apple Operations International' }
        ];
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(companies)
      });
    });

    await webPage.evaluate(() => {
      const testData = {
        name: 'Test Facility',
        address: '123 Test St, Test City, TC 12345',
        country: 'US'
      };
      showDataReviewPopup(testData);
    });

    const popup = await webPage.locator('#os-hub-data-review-popup');
    await expect(popup).toBeVisible({ timeout: 5000 });

    // Test parent company search
    const parentCompanyInput = popup.locator('#os-hub-facility-parent-company');
    await parentCompanyInput.fill('Nike');

    // Wait for suggestions to appear
    const suggestions = popup.locator('#os-hub-parent-company-suggestions');
    await expect(suggestions).toBeVisible({ timeout: 5000 });

    // Verify suggestions contain Nike companies
    await expect(suggestions.locator('.os-hub-suggestion-item')).toContainText('Nike, Inc.');

    // Click on a suggestion
    await suggestions.locator('.os-hub-suggestion-item').first().click();

    // Verify the input was filled
    await expect(parentCompanyInput).toHaveValue('Nike, Inc.');
  });

  test('environment switching works correctly', async ({ webPage }) => {
    await webPage.goto('https://example.com');
    await webPage.addScriptTag({ path: './content.js' });
    await webPage.addStyleTag({ path: './content.css' });

    await webPage.evaluate(() => {
      const testData = {
        name: 'Test Facility',
        address: '123 Test St, Test City, TC 12345',
        country: 'US'
      };
      showDataReviewPopup(testData);
    });

    const popup = await webPage.locator('#os-hub-data-review-popup');
    await expect(popup).toBeVisible({ timeout: 5000 });

    // Should default to staging
    const environmentSelect = popup.locator('#os-hub-environment');
    await expect(environmentSelect).toHaveValue('staging');

    const banner = popup.locator('#os-hub-environment-banner');
    await expect(banner).toContainText('STAGING');

    // Switch to production
    await environmentSelect.selectOption('production');
    await expect(environmentSelect).toHaveValue('production');
    await expect(banner).toContainText('PRODUCTION');

    // Check that banner has production styling
    await expect(banner).toHaveClass(/os-hub-production/);
  });

  test('country validation works correctly', async ({ webPage }) => {
    await webPage.goto('https://example.com');
    await webPage.addScriptTag({ path: './content.js' });
    await webPage.addStyleTag({ path: './content.css' });

    await webPage.evaluate(() => {
      const testData = {
        name: 'Test Facility',
        address: '123 Test St, Test City, TC 12345',
        country: ''
      };
      showDataReviewPopup(testData);
    });

    const popup = await webPage.locator('#os-hub-data-review-popup');
    await expect(popup).toBeVisible({ timeout: 5000 });

    const countryInput = popup.locator('#os-hub-facility-country');

    // Test valid 2-letter code
    await countryInput.fill('US');
    await countryInput.blur();
    await expect(countryInput).toHaveValue('US');

    // Test full country name
    await countryInput.fill('United States');
    await countryInput.blur();
    await expect(countryInput).toHaveValue('US'); // Should convert to code

    // Test invalid country
    await countryInput.fill('INVALID');
    await countryInput.blur();
    // Should show validation error (implementation may vary)
  });
});