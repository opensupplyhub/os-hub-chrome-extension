#!/usr/bin/env node
/**
 * Test script to verify full address extraction for single-location companies
 * Tests extraction of complete address patterns with street, city, state, zip, country
 */

function testFullAddressExtraction() {
  console.log('🧪 Testing full address extraction for Example Manufacturing Corp...\n');

  // Simulate page content that includes the full address
  const mockPageText = `
    About Example Manufacturing Corp
    Industry: Manufacturing
    Company size: 501-1,000 employees
    Headquarters: 123 Industrial Way, Example City, CA 90210, US
    Founded: 1995
    Specialties: Industrial manufacturing, quality assurance, and supply chain management
    Contact information and additional details...
  `;

  console.log('📄 Mock page content:');
  console.log(mockPageText);
  console.log('\n🔍 Testing full address pattern matching...');

  // Test the full address pattern from the enhanced extraction logic
  const fullAddressPattern = /(?:^|\s)(\d+\s+[A-Za-z\s]+(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Way|Place|Pl|Circle|Cir|Court|Ct)[^,]*,\s*[A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?(?:,\s*[A-Z]{2,})?)/gi;

  const fullMatches = [...mockPageText.matchAll(fullAddressPattern)];
  const matches = fullMatches.map(match => match[1]); // Extract the capture group

  console.log(`📊 Pattern matches found: ${matches ? matches.length : 0}`);

  if (matches && matches.length > 0) {
    console.log('\n✅ SUCCESS! Full address patterns detected:');
    matches.forEach((match, index) => {
      console.log(`  ${index + 1}. "${match.trim()}"`);
    });

    const extractedAddress = matches[0].trim();
    console.log(`\n📍 Selected address: "${extractedAddress}"`);

    // Test country extraction
    function extractCountryFromAddress(address) {
      if (!address) return '';

      // Look for country codes at the end
      const countryMatch = address.match(/,\s*([A-Z]{2,})$/);
      if (countryMatch) {
        return countryMatch[1];
      }

      // Check for US state abbreviations
      if (/\b[A-Z]{2}\s*\d{5}/.test(address)) {
        return 'US';
      }

      return '';
    }

    const country = extractCountryFromAddress(extractedAddress);
    console.log(`🌍 Detected country: "${country}"`);

    // Create the location object
    const location = {
      name: 'Example Manufacturing Corp - Headquarters',
      address: extractedAddress,
      country: country,
      isHeadquarters: true
    };

    console.log('\n📋 Generated location object:');
    console.log(JSON.stringify(location, null, 2));

    console.log('\n🎉 VALIDATION COMPLETE!');
    console.log('✅ The enhanced address extraction should now work for single-location companies');

  } else {
    console.log('\n❌ FAILED! No full address patterns detected');
    console.log('⚠️  The regex pattern may need adjustment');
  }

  // Also test the specific address format
  console.log('\n🔧 Testing specific example address format...');
  const specificAddress = "123 Industrial Way, Example City, CA 90210, US";
  const specificMatch = specificAddress.match(fullAddressPattern);

  if (specificMatch) {
    console.log(`✅ Specific address pattern matches: "${specificMatch[0]}"`);
  } else {
    console.log(`❌ Specific address pattern does not match: "${specificAddress}"`);

    // Try a more permissive pattern for testing
    const permissivePattern = /\d+\s+[A-Za-z\s]+Dr[^,]*,\s*[A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5}/gi;
    const permissiveMatch = specificAddress.match(permissivePattern);

    if (permissiveMatch) {
      console.log(`✅ Permissive pattern matches: "${permissiveMatch[0]}"`);
      console.log('💡 Consider using a more flexible address pattern');
    }
  }
}

// Run the test
testFullAddressExtraction();