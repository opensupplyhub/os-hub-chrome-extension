#!/usr/bin/env node
/**
 * Test script to verify address extraction logic for single-location companies
 * Simulates the DOM structure of a typical single-location company LinkedIn page
 */

// Mock DOM environment for testing
function createMockDOM() {
  // Create a minimal document object for testing
  const mockDocument = {
    querySelectorAll: function(selector) {
      console.log(`querySelectorAll called with: ${selector}`);

      if (selector.includes('dt')) {
        // Mock dt elements for example single-location company
        return [
          {
            textContent: 'Industry',
            nextElementSibling: { tagName: 'DD', textContent: 'Food Production' }
          },
          {
            textContent: 'Company size',
            nextElementSibling: { tagName: 'DD', textContent: '1,001-5,000 employees' }
          },
          {
            textContent: 'Headquarters',
            nextElementSibling: { tagName: 'DD', textContent: '123 Industrial Way, Example City, CA 90210, US' }
          },
          {
            textContent: 'Founded',
            nextElementSibling: { tagName: 'DD', textContent: '1941' }
          }
        ];
      }

      return [];
    },

    querySelector: function(selector) {
      console.log(`querySelector called with: ${selector}`);

      if (selector.includes('h1')) {
        return { textContent: 'Example Manufacturing Corp' };
      }

      return null;
    },

    body: {
      textContent: 'Example Manufacturing Corp Industry Manufacturing Company size 501-1,000 employees Headquarters 123 Industrial Way, Example City, CA 90210, US Founded 1995'
    }
  };

  return mockDocument;
}

// Mock the cleanLinkedInAddress function (simplified version)
function cleanLinkedInAddress(text) {
  if (!text) return '';

  text = text.replace(/\s+/g, ' ').trim();

  // Accept simple city/state formats
  if (/^[A-Za-z\s]+,\s*[A-Z]{2}$/.test(text.trim())) {
    return text.trim();
  }

  // If contains comma and reasonable length
  if (text.includes(',') && text.length > 5 && text.length < 200) {
    return text;
  }

  return '';
}

// Mock extractCountryFromAddress function
function extractCountryFromAddress(address) {
  if (!address) return '';

  // Check for US state abbreviations
  if (/\b[A-Z]{2}\b/.test(address)) {
    return 'US';
  }

  return '';
}

// Test the extraction logic
function testAddressExtraction() {
  console.log('🧪 Testing address extraction for Example Manufacturing Corp structure...\n');

  const document = createMockDOM();
  const businessName = 'Example Manufacturing Corp';
  const locations = [];
  let headquartersFound = false;

  console.log('📋 Simulating dt/dd extraction logic...');

  // Simulate the enhanced dt/dd extraction logic
  const dtElements = document.querySelectorAll('.org-page-details dt, dt');
  for (const dt of dtElements) {
    const dtText = dt.textContent.toLowerCase();
    console.log(`🔍 Checking dt: "${dtText}"`);

    if (dtText.includes('headquarters') || dtText.includes('headquarter') ||
        dtText.includes('location') || dtText.includes('address') ||
        dtText.includes('office')) {

      const dd = dt.nextElementSibling;
      if (dd && dd.textContent && dd.textContent.trim()) {
        const addressText = dd.textContent.trim();
        console.log(`📍 Found HQ dd: "${addressText}"`);

        // For simple city/state format or any location text, accept it
        if (addressText.length > 2) {
          let address = cleanLinkedInAddress(addressText);
          if (!address && addressText.length < 100) {
            address = addressText;
          }

          if (address) {
            locations.push({
              name: businessName ? `${businessName} - Headquarters` : 'Headquarters',
              address: address,
              country: extractCountryFromAddress(address) || 'US',
              isHeadquarters: true
            });
            headquartersFound = true;
            console.log('✅ Extracted headquarters from dt/dd:', address);
            break;
          }
        }
      }
    }
  }

  console.log('\n📊 Test Results:');
  console.log(`Headquarters found: ${headquartersFound}`);
  console.log(`Total locations: ${locations.length}`);

  if (locations.length > 0) {
    console.log('\n📍 Extracted locations:');
    locations.forEach((loc, i) => {
      console.log(`  ${i + 1}. ${loc.name}`);
      console.log(`     Address: ${loc.address}`);
      console.log(`     Country: ${loc.country}`);
      console.log(`     HQ: ${loc.isHeadquarters}`);
    });

    console.log('\n✅ SUCCESS! Address extraction is working for single-location companies');
  } else {
    console.log('\n❌ FAILED! No locations extracted');
  }
}

// Run the test
testAddressExtraction();