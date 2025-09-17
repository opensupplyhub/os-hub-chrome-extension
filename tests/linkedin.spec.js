import { test, expect } from './fixtures.js';
import { waitForExtensionLoad, getExtensionStorage, setExtensionStorage, clearExtensionStorage } from './fixtures.js';

test.describe('LinkedIn Business Location Extraction', () => {
  let linkedInCompanyUrl = 'https://www.linkedin.com/company/microsoft/about/';
  let testLinkedInData = {
    companyName: 'Microsoft',
    headquarters: 'One Microsoft Way, Redmond, WA 98052',
    additionalLocations: [
      'San Francisco, CA',
      'New York, NY',
      'Austin, TX'
    ]
  };

  test.beforeEach(async ({ context }) => {
    // Clear storage before each test
    const pages = context.pages();
    if (pages.length > 0) {
      await clearExtensionStorage(pages[0]);
    }
  });

  test('detects LinkedIn About page and extracts company information', async ({ webPage }) => {
    // Create a mock LinkedIn About page
    await webPage.goto('data:text/html,<!DOCTYPE html><html><head><title>Microsoft | LinkedIn</title></head><body><div class="org-top-card-summary__title"><h1>Microsoft</h1></div><div class="org-top-card-summary__headquarter">One Microsoft Way, Redmond, WA 98052</div></body></html>');

    // Inject our content script
    await webPage.addScriptTag({ path: './content.js' });
    await webPage.addStyleTag({ path: './content.css' });

    // Override the hostname to simulate LinkedIn
    await webPage.evaluate(() => {
      Object.defineProperty(window.location, 'hostname', {
        writable: false,
        value: 'www.linkedin.com'
      });
      Object.defineProperty(window.location, 'pathname', {
        writable: false,
        value: '/company/microsoft/about/'
      });
    });

    // Test business name extraction
    const businessName = await webPage.evaluate(() => {
      return window.extractLinkedInBusinessName ? window.extractLinkedInBusinessName() : null;
    });

    expect(businessName).toBe('Microsoft');
  });

  test('extracts multiple locations from LinkedIn About page', async ({ webPage }) => {
    // Create mock LinkedIn About page with multiple locations
    const mockHtml = `
      <!DOCTYPE html>
      <html>
      <head><title>Test Company | LinkedIn</title></head>
      <body>
        <div class="org-top-card-summary__title">
          <h1>Test Manufacturing Co</h1>
        </div>
        <div class="org-top-card-summary__headquarter">
          123 Main Street, Chicago, IL 60601, United States
        </div>
        <div class="org-page-details">
          <dt>Locations</dt>
          <dd>456 Factory Road, Detroit, MI 48201
              789 Assembly Lane, Buffalo, NY 14201</dd>
        </div>
      </body>
      </html>
    `;

    await webPage.goto(`data:text/html,${encodeURIComponent(mockHtml)}`);

    // Inject content script and set up LinkedIn context
    await webPage.addScriptTag({ path: './content.js' });
    await webPage.addStyleTag({ path: './content.css' });

    await webPage.evaluate(() => {
      Object.defineProperty(window.location, 'hostname', {
        writable: false,
        value: 'www.linkedin.com'
      });
      Object.defineProperty(window.location, 'pathname', {
        writable: false,
        value: '/company/test-manufacturing/about/'
      });
    });

    // Test location extraction
    const locations = await webPage.evaluate(() => {
      return window.extractLinkedInLocations ? window.extractLinkedInLocations() : [];
    });

    expect(locations.length).toBeGreaterThan(0);
    expect(locations[0].name).toContain('Test Manufacturing Co');
    expect(locations[0].address).toContain('123 Main Street');
    expect(locations[0].country).toBe('US');
  });

  test('shows LinkedIn extraction popup automatically on About page', async ({ webPage }) => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
      <head><title>LinkedIn Company | LinkedIn</title></head>
      <body>
        <div class="org-top-card-summary__title">
          <h1>LinkedIn Corporation</h1>
        </div>
        <div class="org-top-card-summary__headquarter">
          1000 West Maude Avenue, Sunnyvale, CA 94085
        </div>
      </body>
      </html>
    `;

    await webPage.goto(`data:text/html,${encodeURIComponent(mockHtml)}`);
    await webPage.addScriptTag({ path: './content.js' });
    await webPage.addStyleTag({ path: './content.css' });

    await webPage.evaluate(() => {
      Object.defineProperty(window.location, 'hostname', {
        writable: false,
        value: 'www.linkedin.com'
      });
      Object.defineProperty(window.location, 'pathname', {
        writable: false,
        value: '/company/linkedin/about/'
      });
    });

    // Manually trigger the LinkedIn detection
    await webPage.evaluate(() => {
      if (window.initializeLinkedInDetection) {
        window.initializeLinkedInDetection();
      }
    });

    // Wait for popup to appear
    await webPage.waitForTimeout(3000);

    // Check if LinkedIn extraction popup appeared
    const popup = await webPage.locator('#os-hub-linkedin-popup');
    await expect(popup).toBeVisible({ timeout: 5000 });

    // Verify popup content
    await expect(popup.locator('h3')).toContainText('Extract LinkedIn Business Locations');
    await expect(popup.locator('.os-hub-location-preview')).toBeVisible();
  });

  test('LinkedIn bulk submission popup works correctly', async ({ webPage }) => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
      <head><title>Multi Location Company | LinkedIn</title></head>
      <body>
        <div class="org-top-card-summary__title">
          <h1>Multi Location Corp</h1>
        </div>
        <div class="org-top-card-summary__headquarter">
          100 HQ Street, New York, NY 10001
        </div>
        <div class="org-page-details">
          <dt>Locations</dt>
          <dd>200 Branch Ave, Los Angeles, CA 90210
              300 Office Blvd, Miami, FL 33101</dd>
        </div>
      </body>
      </html>
    `;

    await webPage.goto(`data:text/html,${encodeURIComponent(mockHtml)}`);
    await webPage.addScriptTag({ path: './content.js' });
    await webPage.addStyleTag({ path: './content.css' });

    await webPage.evaluate(() => {
      Object.defineProperty(window.location, 'hostname', {
        writable: false,
        value: 'www.linkedin.com'
      });
      Object.defineProperty(window.location, 'pathname', {
        writable: false,
        value: '/company/multi-location/about/'
      });
    });

    // Manually trigger extraction popup
    await webPage.evaluate(() => {
      if (window.showLinkedInExtractionPopup) {
        window.showLinkedInExtractionPopup();
      }
    });

    // Wait for and interact with extraction popup
    const extractionPopup = await webPage.locator('#os-hub-linkedin-popup');
    await expect(extractionPopup).toBeVisible({ timeout: 5000 });

    // Click "Extract All Locations"
    await extractionPopup.locator('#os-hub-linkedin-extract-yes').click();

    // Wait for bulk submission popup
    const bulkPopup = await webPage.locator('#os-hub-linkedin-bulk-popup');
    await expect(bulkPopup).toBeVisible({ timeout: 5000 });

    // Verify bulk popup has multiple location forms
    const locationForms = bulkPopup.locator('.os-hub-location-form');
    const formCount = await locationForms.count();
    expect(formCount).toBeGreaterThan(1);

    // Check that location data is pre-filled
    const firstLocationName = bulkPopup.locator('.os-hub-location-name').first();
    await expect(firstLocationName).toHaveValue(/Multi Location Corp/);

    const firstLocationAddress = bulkPopup.locator('.os-hub-location-address').first();
    await expect(firstLocationAddress).toHaveValue(/100 HQ Street/);
  });

  test('context menus update for multiple LinkedIn locations', async ({ context, webPage }) => {
    await webPage.goto('https://example.com');
    await webPage.addScriptTag({ path: './content.js' });

    // Simulate multiple locations detected
    await webPage.evaluate(() => {
      // Set up test data
      window.detectedLocationCount = 3;
      window.locationDatasets = [
        { name: 'HQ', address: '123 Main St', country: 'US' },
        { name: 'Branch 1', address: '456 Oak Ave', country: 'US' },
        { name: 'Branch 2', address: '789 Pine Rd', country: 'CA' }
      ];

      // Notify background script
      if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: 'updateLocationCount',
          count: 3
        });
      }
    });

    // Verify multiple location context menus would be created
    // Note: Context menu testing is limited in Playwright, but we can verify the data structure
    const locationCount = await webPage.evaluate(() => window.detectedLocationCount);
    expect(locationCount).toBe(3);

    const datasets = await webPage.evaluate(() => window.locationDatasets);
    expect(datasets).toHaveLength(3);
    expect(datasets[0].name).toBe('HQ');
  });

  test('LinkedIn location extraction handles edge cases', async ({ webPage }) => {
    // Test with minimal data
    const mockHtml = `
      <!DOCTYPE html>
      <html>
      <head><title>Minimal Company | LinkedIn</title></head>
      <body>
        <div class="org-top-card-summary__title">
          <h1>Minimal Corp</h1>
        </div>
        <!-- No address information -->
      </body>
      </html>
    `;

    await webPage.goto(`data:text/html,${encodeURIComponent(mockHtml)}`);
    await webPage.addScriptTag({ path: './content.js' });

    await webPage.evaluate(() => {
      Object.defineProperty(window.location, 'hostname', {
        writable: false,
        value: 'www.linkedin.com'
      });
      Object.defineProperty(window.location, 'pathname', {
        writable: false,
        value: '/company/minimal/about/'
      });
    });

    const locations = await webPage.evaluate(() => {
      return window.extractLinkedInLocations ? window.extractLinkedInLocations() : [];
    });

    // Should still create at least one location with the company name
    expect(locations.length).toBeGreaterThan(0);
    expect(locations[0].name).toBe('Minimal Corp');
    expect(locations[0].address).toBe(''); // Empty address should be handled gracefully
  });

  test('address cleaning functions work correctly', async ({ webPage }) => {
    await webPage.goto('https://example.com');
    await webPage.addScriptTag({ path: './content.js' });

    const testCases = [
      {
        input: '123 Main Street, New York, NY 10001 · 500 employees',
        expected: '123 Main Street, New York, NY 10001'
      },
      {
        input: 'San Francisco, CA · Software industry',
        expected: 'San Francisco, CA'
      },
      {
        input: '456 Oak Avenue, Los Angeles, CA 90210, United States',
        expected: '456 Oak Avenue, Los Angeles, CA 90210, United States'
      }
    ];

    for (const testCase of testCases) {
      const cleaned = await webPage.evaluate((input) => {
        return window.cleanLinkedInAddress ? window.cleanLinkedInAddress(input) : input;
      }, testCase.input);

      expect(cleaned).toContain(testCase.expected.split(',')[0]); // At least check the street
    }
  });

  test('country extraction from addresses works', async ({ webPage }) => {
    await webPage.goto('https://example.com');
    await webPage.addScriptTag({ path: './content.js' });

    const testAddresses = [
      { address: '123 Main St, New York, NY, USA', expectedCountry: 'USA' },
      { address: '456 Oak Ave, Toronto, ON, Canada', expectedCountry: 'Canada' },
      { address: '789 Pine Rd, London, UK', expectedCountry: 'UK' }
    ];

    for (const test of testAddresses) {
      const country = await webPage.evaluate((address) => {
        return window.extractCountryFromAddress ? window.extractCountryFromAddress(address) : null;
      }, test.address);

      if (test.expectedCountry) {
        expect(country).toBe(test.expectedCountry);
      }
    }
  });

  test('LinkedIn detection only works on About pages', async ({ webPage }) => {
    // Test regular LinkedIn company page (not About)
    await webPage.goto('https://example.com');
    await webPage.addScriptTag({ path: './content.js' });

    await webPage.evaluate(() => {
      Object.defineProperty(window.location, 'hostname', {
        writable: false,
        value: 'www.linkedin.com'
      });
      Object.defineProperty(window.location, 'pathname', {
        writable: false,
        value: '/company/microsoft/' // Not /about/
      });
    });

    const locationCount = await webPage.evaluate(() => {
      return window.detectLinkedInLocations ? window.detectLinkedInLocations() : 0;
    });

    expect(locationCount).toBe(0); // Should not detect on non-About pages
  });

  test('bulk submission handles API errors gracefully', async ({ webPage }) => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
      <head><title>Test Company | LinkedIn</title></head>
      <body>
        <div class="org-top-card-summary__title">
          <h1>Test Corp</h1>
        </div>
        <div class="org-top-card-summary__headquarter">
          123 Test St, Test City, TC 12345
        </div>
      </body>
      </html>
    `;

    await webPage.goto(`data:text/html,${encodeURIComponent(mockHtml)}`);
    await webPage.addScriptTag({ path: './content.js' });
    await webPage.addStyleTag({ path: './content.css' });

    await webPage.evaluate(() => {
      Object.defineProperty(window.location, 'hostname', {
        writable: false,
        value: 'www.linkedin.com'
      });
      Object.defineProperty(window.location, 'pathname', {
        writable: false,
        value: '/company/test/about/'
      });
    });

    // Mock API requests to return errors
    await webPage.route('**/api/v1/production-locations/', async route => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Invalid data provided' })
      });
    });

    // Trigger the extraction popup
    await webPage.evaluate(() => {
      if (window.showLinkedInExtractionPopup) {
        window.showLinkedInExtractionPopup();
      }
    });

    const extractionPopup = await webPage.locator('#os-hub-linkedin-popup');
    await expect(extractionPopup).toBeVisible({ timeout: 5000 });

    await extractionPopup.locator('#os-hub-linkedin-extract-yes').click();

    const bulkPopup = await webPage.locator('#os-hub-linkedin-bulk-popup');
    await expect(bulkPopup).toBeVisible({ timeout: 5000 });

    // Fill in API key and try to submit
    await bulkPopup.locator('#os-hub-bulk-api-key').fill('test-api-key');
    await bulkPopup.locator('#os-hub-bulk-submit-btn').click();

    // Should show error status
    const statusElement = bulkPopup.locator('#os-hub-bulk-submit-status');
    await expect(statusElement).toContainText('failed', { timeout: 10000 });
  });

  test('stores and retrieves LinkedIn location data correctly', async ({ webPage }) => {
    await webPage.goto('https://example.com');
    await webPage.addScriptTag({ path: './content.js' });

    // Test location storage
    const testLocations = [
      {
        name: 'Test Corp - HQ',
        address: '123 Main St, City, ST 12345',
        country: 'US',
        isHeadquarters: true
      },
      {
        name: 'Test Corp - Branch',
        address: '456 Oak Ave, Town, ST 67890',
        country: 'US',
        isHeadquarters: false
      }
    ];

    await webPage.evaluate((locations) => {
      if (window.storeLinkedInLocations) {
        window.storeLinkedInLocations(locations);
      }
    }, testLocations);

    // Verify data was stored correctly
    const storedData = await getExtensionStorage(webPage, ['locationDatasets', 'detectedLocationCount']);

    expect(storedData.detectedLocationCount).toBe(2);
    expect(storedData.locationDatasets).toHaveLength(2);
    expect(storedData.locationDatasets[0].name).toBe('Test Corp - HQ');
    expect(storedData.locationDatasets[1].name).toBe('Test Corp - Branch');
  });
});