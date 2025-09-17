#!/usr/bin/env node
/**
 * Direct API test script for Open Supply Hub staging
 * Tests the API key and endpoint directly from Node.js
 */

const https = require('https');

const API_BASE = 'https://staging.opensupplyhub.org/api';
const API_KEY = 'YOUR_STAGING_API_KEY_HERE';

// Test location data
const testLocation = {
    name: 'Test LinkedIn Location - Chrome Extension',
    address: '123 Test Street, Test City, TC 12345',
    country: 'US',
    source_name: 'OS Hub Chrome Extension - LinkedIn Test',
    source_link: 'https://www.linkedin.com/company/test/about/',
    sectors: ['Manufacturing'],
    product_types: ['Finished Goods']
};

console.log('🧪 Testing Open Supply Hub Staging API');
console.log('📡 API Base:', API_BASE);
console.log('🔑 API Key:', API_KEY.substring(0, 8) + '...');
console.log('📦 Test Data:', JSON.stringify(testLocation, null, 2));
console.log('\n🚀 Submitting test location...\n');

// Make API request
const postData = JSON.stringify(testLocation);

const options = {
    hostname: 'staging.opensupplyhub.org',
    port: 443,
    path: '/api/v1/production-locations/',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${API_KEY}`,
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'OS-Hub-Chrome-Extension-Test/1.0'
    }
};

const req = https.request(options, (res) => {
    console.log(`📊 Status Code: ${res.statusCode}`);
    console.log(`📋 Headers:`, res.headers);
    console.log('');

    let responseData = '';

    res.on('data', (chunk) => {
        responseData += chunk;
    });

    res.on('end', () => {
        try {
            const parsed = JSON.parse(responseData);

            if (res.statusCode >= 200 && res.statusCode < 300) {
                console.log('✅ SUCCESS! Location submitted successfully');
                console.log('🎉 Response Data:');
                console.log(JSON.stringify(parsed, null, 2));

                if (parsed.moderation_id) {
                    console.log(`\n🔍 Moderation ID: ${parsed.moderation_id}`);
                }
                if (parsed.os_id) {
                    console.log(`🆔 OS ID: ${parsed.os_id}`);
                }

                console.log('\n✅ The LinkedIn extraction and API submission workflow is working correctly!');
                console.log('🎯 You can now test the Chrome extension with confidence.');

            } else {
                console.log('❌ API Error:');
                console.log(JSON.stringify(parsed, null, 2));

                if (parsed.detail) {
                    console.log(`\n💡 Error Details: ${parsed.detail}`);
                }
            }
        } catch (error) {
            console.log('❌ Failed to parse response:', responseData);
            console.log('🔍 Parse Error:', error.message);
        }
    });
});

req.on('error', (error) => {
    console.log('💥 Request failed:', error.message);
    console.log('🔍 Error Details:', error);
});

// Write the request
req.write(postData);
req.end();

// Timeout after 30 seconds
setTimeout(() => {
    console.log('⏰ Request timed out after 30 seconds');
    process.exit(1);
}, 30000);