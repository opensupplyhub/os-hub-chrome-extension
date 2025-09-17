#!/usr/bin/env node
/**
 * Test script to verify clean address extraction without surrounding text
 * Tests extraction of clean addresses from text with surrounding content
 */

function testCleanAddressExtraction() {
  console.log('🧪 Testing clean address extraction (removing "Get directions" etc.)...\n');

  // Simulate the actual LinkedIn content that includes extra text
  const mockLinkedInText = `
    Example Manufacturing Corp
    Primary 123 Industrial Way, Example City, CA 90210, US Get directions
    Get directions to 123 Industrial Way, Example City, CA 90210, US
    You're getting more information than the address.
    Contact information and other details...
  `;

  console.log('📄 Mock LinkedIn content with extra text:');
  console.log(mockLinkedInText);
  console.log('\n🔍 Testing improved address pattern...');

  // Test the improved pattern with lookahead to stop at boundaries
  const improvedPattern = /(\d+\s+[A-Za-z\s]+(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Way|Place|Pl|Circle|Cir|Court|Ct)[^,]*,\s*[A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?(?:,\s*[A-Z]{2,})?(?=\s|$|[^A-Za-z0-9,\s-]))/gi;

  const matches = [...mockLinkedInText.matchAll(improvedPattern)];
  const cleanAddresses = matches.map(match => match[1].trim());

  console.log(`📊 Pattern matches found: ${cleanAddresses.length}`);

  if (cleanAddresses.length > 0) {
    console.log('\n✅ SUCCESS! Clean addresses extracted:');
    cleanAddresses.forEach((address, index) => {
      console.log(`  ${index + 1}. "${address}"`);
    });

    const selectedAddress = cleanAddresses[0];
    console.log(`\n📍 Selected clean address: "${selectedAddress}"`);

    // Verify it's actually clean (no "Get directions" etc.)
    const isClean = !selectedAddress.includes('Get directions') &&
                   !selectedAddress.includes('Primary') &&
                   !selectedAddress.includes('You\'re getting');

    if (isClean) {
      console.log('✅ Address is clean - no surrounding text captured!');
    } else {
      console.log('❌ Address still contains surrounding text');
    }

    // Test country extraction
    function extractCountryFromAddress(address) {
      const countryMatch = address.match(/,\s*([A-Z]{2,})$/);
      if (countryMatch) {
        return countryMatch[1];
      }
      if (/\b[A-Z]{2}\s*\d{5}/.test(address)) {
        return 'US';
      }
      return '';
    }

    const country = extractCountryFromAddress(selectedAddress);
    console.log(`🌍 Detected country: "${country}"`);

    console.log('\n📋 Final location object:');
    console.log(JSON.stringify({
      name: 'Example Manufacturing Corp - Headquarters',
      address: selectedAddress,
      country: country,
      isHeadquarters: true
    }, null, 2));

  } else {
    console.log('\n❌ FAILED! No addresses extracted');
  }

  // Test edge cases
  console.log('\n🧪 Testing edge cases...');

  const edgeCases = [
    "123 Industrial Way, Example City, CA 90210, US",
    "123 Industrial Way, Example City, CA 90210, US Get directions",
    "Primary 123 Industrial Way, Example City, CA 90210, US Get directions",
    "Visit us at 123 Industrial Way, Example City, CA 90210, US for more info"
  ];

  edgeCases.forEach((testCase, index) => {
    const edgeMatches = [...testCase.matchAll(improvedPattern)];
    const edgeAddress = edgeMatches.length > 0 ? edgeMatches[0][1].trim() : 'No match';
    console.log(`  Case ${index + 1}: "${edgeAddress}"`);
  });

  console.log('\n🎉 Clean address extraction test complete!');
}

// Run the test
testCleanAddressExtraction();