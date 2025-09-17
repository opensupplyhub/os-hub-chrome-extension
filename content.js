// Global variables to store production location data
let facilityData = {
  name: '',
  address: '',
  country: '',
  productType: '',
  sector: '',
  parentCompany: ''
};

// Multi-location support
let locationDatasets = [];
let currentLocationIndex = 0;
let detectedLocationCount = 0;

// Facebook detection and extraction
let facebookPopupShown = false;

// Listen for messages from the background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'getSelection') {
    const selection = window.getSelection().toString().trim();
    sendResponse({selection: selection});
  } else if (request.action === 'highlightText') {
    highlightSelectedText();
    sendResponse({success: true});
  } else if (request.action === 'saveFacilityData') {
    const field = request.field;
    const selection = window.getSelection().toString().trim();
    const locationIndex = request.locationIndex || 0;
    
    // Initialize location datasets if not already done
    if (locationDatasets.length === 0 && detectedLocationCount > 1) {
      initializeLocationDatasets();
    }
    
    // Save the selected text to the appropriate field
    if (field && selection) {
      // Handle multiple locations
      if (locationDatasets.length > 0) {
        // Ensure we have enough location slots
        while (locationDatasets.length <= locationIndex) {
          locationDatasets.push({
            name: '',
            address: '',
            country: '',
            productType: '',
            sector: '',
            parentCompany: ''
          });
        }
        
        // Update the specific location dataset
        locationDatasets[locationIndex][field] = selection;
        
        // Also update main facilityData for backward compatibility (location 0)
        if (locationIndex === 0) {
          facilityData[field] = selection;
        }
        
        // Save to local storage
        chrome.storage.local.set({
          facilityData: facilityData,
          locationDatasets: locationDatasets,
          currentLocationIndex: locationIndex,
          detectedLocationCount: detectedLocationCount
        });
        
        console.log(`[OS-Hub] Saved ${field} = "${selection}" to location ${locationIndex}`);
      } else {
        // Single location - use existing behavior
        facilityData[field] = selection;
        chrome.storage.local.set({facilityData: facilityData});
      }
      
      // Provide visual feedback
      highlightSelectedText(field, locationIndex);
      sendResponse({success: true, field: field, value: selection, locationIndex: locationIndex});
    } else {
      sendResponse({success: false, error: 'No selection or invalid field'});
    }
  }
  return true; // Keep the message channel open for async response
});

// Function to highlight selected text
function highlightSelectedText(field, locationIndex = 0) {
  const selection = window.getSelection();
  
  if (selection.rangeCount > 0) {
    // Create a new range to avoid modifying the original selection
    const range = selection.getRangeAt(0).cloneRange();
    
    // Create a span element for highlighting
    const highlightSpan = document.createElement('span');
    highlightSpan.className = 'os-hub-highlight';
    
    // Add specific class based on the field type and location
    if (field) {
      highlightSpan.classList.add(`os-hub-${field}`);
      if (locationIndex > 0) {
        highlightSpan.classList.add(`os-hub-location-${locationIndex}`);
      }
    }
    
    // Apply the highlighting
    range.surroundContents(highlightSpan);
    
    // Clear the selection to avoid confusion
    selection.removeAllRanges();
    
    // Remove highlight after a delay
    setTimeout(() => {
      // Keep the styling but remove the span wrapper
      const parent = highlightSpan.parentNode;
      while (highlightSpan.firstChild) {
        parent.insertBefore(highlightSpan.firstChild, highlightSpan);
      }
      parent.removeChild(highlightSpan);
    }, 3000);
  }
}

// Facebook business page detection and data extraction
function isFacebookBusinessPage() {
  console.log('[OS-Hub] Checking if Facebook business page...');
  console.log('[OS-Hub] Current URL:', window.location.href);
  console.log('[OS-Hub] Hostname:', window.location.hostname);
  
  if (!window.location.hostname.includes('facebook.com')) {
    console.log('[OS-Hub] Not a Facebook page');
    return false;
  }
  
  // Check for business page indicators
  const businessPageIndicators = [
    () => {
      const el = document.querySelector('h1[data-testid="page-title"]');
      console.log('[OS-Hub] page-title element:', el);
      return el;
    },
    () => {
      const el = document.querySelector('[data-testid="page-location"]');
      console.log('[OS-Hub] page-location element:', el);
      return el;
    },
    () => {
      const el = document.querySelector('[data-testid="page-contact-info"]');
      console.log('[OS-Hub] page-contact-info element:', el);
      return el;
    },
    () => {
      const el = document.querySelector('div[aria-label*="Business"]');
      console.log('[OS-Hub] Business aria-label element:', el);
      return el;
    },
    () => {
      const el = document.querySelector('div[aria-label*="Company"]');
      console.log('[OS-Hub] Company aria-label element:', el);
      return el;
    },
    () => {
      const titleCheck = document.title.includes('Facebook') && document.title !== 'Facebook';
      console.log('[OS-Hub] Title check - Title:', document.title, 'Valid:', titleCheck);
      return titleCheck;
    },
    () => {
      // Check for any h1 element that might be the page title
      const h1Elements = document.querySelectorAll('h1');
      console.log('[OS-Hub] Found h1 elements:', h1Elements.length);
      h1Elements.forEach((h1, index) => {
        console.log(`[OS-Hub] h1[${index}]:`, h1.textContent, h1);
      });
      return h1Elements.length > 0;
    },
    () => {
      // Check URL pattern for Facebook pages
      const isFacebookPage = window.location.pathname !== '/' && 
                           (window.location.pathname.includes('/') || 
                            window.location.search.includes('id='));
      console.log('[OS-Hub] URL pattern check:', isFacebookPage);
      return isFacebookPage;
    }
  ];
  
  const results = businessPageIndicators.map(indicator => indicator());
  console.log('[OS-Hub] Business page indicator results:', results);
  
  const isBusinessPage = results.some(result => result);
  console.log('[OS-Hub] Is business page:', isBusinessPage);
  
  return isBusinessPage;
}

function extractBusinessName() {
  console.log('[OS-Hub] Extracting business name...');
  
  const businessNameSelectors = [
    'h1[data-testid="page-title"]',
    'h1[role="heading"]',
    '[data-testid="page-title"] h1',
    'h1[dir="ltr"]',
    'span[dir="ltr"] h1',
    'meta[property="og:title"]',
    // More Facebook-specific selectors
    'h1',
    'h1 span',
    '[role="main"] h1',
    '[data-pagelet="ProfileCover"] h1',
    'div[data-testid="page-header"] h1',
    // Try to find any text that looks like a business name
    'div[role="main"] div:first-child h1',
    'span[dir="auto"]'
  ];
  
  for (const selector of businessNameSelectors) {
    console.log(`[OS-Hub] Trying selector: ${selector}`);
    const element = document.querySelector(selector);
    console.log(`[OS-Hub] Found element:`, element);
    
    if (element) {
      let text = '';
      if (element.tagName === 'META') {
        text = element.getAttribute('content');
      } else if (element.textContent && element.textContent.trim()) {
        text = element.textContent.trim();
      }
      
      console.log(`[OS-Hub] Extracted text: "${text}"`);
      
      // Clean up the text - remove extra info that might be concatenated
      text = cleanBusinessNameText(text);
      
      // Filter out common non-business-name text
      if (text && 
          text.length > 0 && 
          text.length < 100 && // Reduced from 200 to be more strict
          !text.includes('Facebook') &&
          !text.includes('Log in') &&
          !text.includes('Sign up') &&
          !text.includes('Home') &&
          !text.includes('Photos') &&
          !text.includes('About') &&
          !text.includes('Posts') &&
          !text.includes('Page ·') &&
          !text.includes('Local business') &&
          !text.includes('@') && // Remove email addresses
          !text.includes('(') && // Remove phone numbers
          !text.includes('$') && // Remove price info
          !text.includes('Rating') &&
          !text.includes('Review')) {
        console.log(`[OS-Hub] Business name found: "${text}"`);
        return text;
      }
    }
  }
  
  // Fallback to page title
  const title = document.title;
  console.log(`[OS-Hub] Fallback to title: "${title}"`);
  if (title && title !== 'Facebook' && !title.includes('Log in')) {
    let cleanTitle = title.replace(' | Facebook', '').replace(' - Facebook', '').trim();
    cleanTitle = cleanBusinessNameText(cleanTitle);
    console.log(`[OS-Hub] Cleaned title: "${cleanTitle}"`);
    return cleanTitle;
  }
  
  console.log('[OS-Hub] No business name found');
  return null;
}

function cleanBusinessNameText(text) {
  if (!text) return text;
  
  // Split by common separators and take the first clean part
  const separators = ['Page ·', 'Local business', '·', '\n', 'Rating', 'Review', '@', '(', '$'];
  
  for (const separator of separators) {
    if (text.includes(separator)) {
      const parts = text.split(separator);
      if (parts[0] && parts[0].trim().length > 0) {
        text = parts[0].trim();
        break;
      }
    }
  }
  
  // Remove leading/trailing punctuation and numbers if they look like metadata
  text = text.replace(/^[·\s\d\-]+/, '').replace(/[·\s\d\-]+$/, '').trim();
  
  return text;
}

function extractAddress() {
  console.log('[OS-Hub] Extracting address...');
  
  const addressSelectors = [
    '[data-testid="page-location"]',
    '[data-testid="address-section"]',
    'div[aria-label*="Address"]',
    'div[aria-label*="Location"]',
    'a[href*="maps.google.com"]',
    'a[href*="maps.app.goo.gl"]',
    // More Facebook-specific selectors
    '[data-testid="page_info_item"]:has-text("Address")',
    'div:contains("Address")',
    'div:contains("Location")',
    'span:contains("Address")',
    'span:contains("Location")',
    // Look for text patterns that look like addresses
    'div[role="main"] div:contains(",")',
    'span:contains(",")',
    // Try to find map links or location indicators
    'a[href*="place"]',
    'a[href*="location"]',
    '[data-testid="page_info"] div'
  ];
  
  for (const selector of addressSelectors) {
    console.log(`[OS-Hub] Trying address selector: ${selector}`);
    
    let elements;
    if (selector.includes(':contains(') || selector.includes(':has-text(')) {
      // Handle special selectors manually
      const baseSelector = selector.split(':')[0];
      elements = document.querySelectorAll(baseSelector);
      const searchText = selector.includes('Address') ? 'Address' : 'Location';
      elements = Array.from(elements).filter(el => 
        el.textContent && el.textContent.includes(searchText)
      );
    } else {
      elements = [document.querySelector(selector)].filter(el => el);
    }
    
    for (const element of elements) {
      console.log(`[OS-Hub] Found address element:`, element);
      
      if (element && element.textContent && element.textContent.trim()) {
        let address = element.textContent.trim();
        
        console.log(`[OS-Hub] Address text: "${address}"`);
        
        // If it's a Google Maps link, try to extract address from href
        if (element.tagName === 'A' && element.href && element.href.includes('maps')) {
          try {
            const url = new URL(element.href);
            const query = url.searchParams.get('q') || url.searchParams.get('query');
            if (query) {
              address = decodeURIComponent(query);
              console.log(`[OS-Hub] Address from maps URL: "${address}"`);
            }
          } catch (e) {
            console.log('[OS-Hub] Error parsing maps URL:', e);
          }
        }
        
        // Clean the address text
        address = cleanAddressText(address);
        
        // Filter for text that looks like an address (contains comma, numbers, etc.)
        if (address && 
            address.length > 5 && 
            address.length < 200 && // More restrictive
            (address.includes(',') || /\d/.test(address)) &&
            !address.includes('Facebook') &&
            !address.includes('See all') &&
            !address.includes('Photos') &&
            !address.includes('Reviews') &&
            !address.includes('Page ·') &&
            !address.includes('Local business') &&
            !address.includes('@') &&
            !address.includes('(') &&
            !address.includes('$') &&
            !address.includes('Rating') &&
            !address.includes('Not yet rated')) {
          console.log(`[OS-Hub] Address found: "${address}"`);
          return address;
        }
      }
    }
  }
  
  console.log('[OS-Hub] No address found');
  return null;
}

function cleanAddressText(text) {
  if (!text) return text;
  
  // Remove business info that might be concatenated with address
  const prefixesToRemove = [
    'Page · Local business',
    'Local business',
    'Page ·',
    'Business ·'
  ];
  
  for (const prefix of prefixesToRemove) {
    if (text.startsWith(prefix)) {
      text = text.substring(prefix.length).trim();
    }
  }
  
  // Look for address patterns and extract just the address part
  // Address usually comes before phone, email, website, price info
  const addressEndMarkers = [
    /\([0-9\-\)\(\s]+\)/, // Phone numbers
    /@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email addresses
    /https?:\/\//, // Websites
    /\$[0-9]/, // Price ranges
    /Price Range/, // Price info
    /Not yet rated/, // Ratings
    /\([0-9]+ Review/, // Reviews
    /Rating:/ // Rating text
  ];
  
  for (const marker of addressEndMarkers) {
    const match = text.search(marker);
    if (match > 0) {
      text = text.substring(0, match).trim();
      break;
    }
  }
  
  // Extract just the address part - look for patterns like:
  // "58777 Godley Rd, La Grande, OR, United States, Oregon"
  const addressPattern = /([0-9]+\s+[^,]+(?:,\s*[^,]+)*)/;
  const addressMatch = text.match(addressPattern);
  if (addressMatch) {
    return addressMatch[1].trim();
  }
  
  return text.trim();
}

function extractCountryFromAddress(address) {
  if (!address) return null;
  
  // Common country patterns at the end of addresses
  const countryPatterns = [
    /,\s*USA?$/i,
    /,\s*United States$/i,
    /,\s*Canada$/i,
    /,\s*UK$/i,
    /,\s*United Kingdom$/i,
    /,\s*Australia$/i,
    /,\s*Germany$/i,
    /,\s*France$/i,
    /,\s*Italy$/i,
    /,\s*Spain$/i,
    /,\s*Mexico$/i,
    /,\s*Brazil$/i,
    /,\s*India$/i,
    /,\s*China$/i,
    /,\s*Japan$/i
  ];
  
  for (const pattern of countryPatterns) {
    const match = address.match(pattern);
    if (match) {
      return match[0].replace(/,\s*/, '').trim();
    }
  }
  
  return null;
}

function extractFacebookBusinessData() {
  console.log('[OS-Hub] Starting Facebook business data extraction...');
  
  let businessName = extractBusinessName();
  let address = extractAddress();
  
  // Fallback: if we couldn't find name/address, try a broader search
  if (!businessName || !address) {
    console.log('[OS-Hub] Primary extraction failed, trying fallback methods...');
    
    // Try to find any h1 that might be the business name
    if (!businessName) {
      const allH1s = document.querySelectorAll('h1');
      console.log('[OS-Hub] Found', allH1s.length, 'h1 elements for fallback');
      for (let h1 of allH1s) {
        let text = h1.textContent.trim();
        text = cleanBusinessNameText(text); // Apply the same cleaning
        
        if (text && text.length > 2 && text.length < 100 && 
            !text.includes('Facebook') && !text.includes('Posts') && 
            !text.includes('Photos') && !text.includes('About') &&
            !text.includes('Page ·') && !text.includes('Local business') &&
            !text.includes('@') && !text.includes('(') && !text.includes('$')) {
          console.log('[OS-Hub] Fallback business name found:', text);
          businessName = text;
          break;
        }
      }
    }
    
    // Try to find any text that looks like an address
    if (!address) {
      const allDivs = document.querySelectorAll('div, span');
      console.log('[OS-Hub] Searching', allDivs.length, 'elements for address patterns');
      for (let div of allDivs) {
        let text = div.textContent.trim();
        
        // Look for address patterns: starts with numbers, contains commas
        const addressPattern = /^[0-9]+\s+[^,]+,\s*[^,]+/;
        if (addressPattern.test(text)) {
          text = cleanAddressText(text); // Apply address cleaning
          
          if (text && text.length > 10 && text.length < 200 && 
              text.includes(',') && /\d/.test(text) &&
              !text.includes('Facebook') && !text.includes('©') &&
              !text.includes('See all') && !text.includes('Photos') &&
              !text.includes('@') && !text.includes('(') && !text.includes('$')) {
            console.log('[OS-Hub] Fallback address found:', text);
            address = text;
            break;
          }
        }
      }
    }
  }
  
  const country = extractCountryFromAddress(address);
  
  console.log('[OS-Hub] Final extraction results:');
  console.log('[OS-Hub] - Business Name:', businessName);
  console.log('[OS-Hub] - Address:', address);
  console.log('[OS-Hub] - Country:', country);
  
  return {
    name: businessName,
    address: address,
    country: country || ''
  };
}

function showFacebookExtractionPopup() {
  if (facebookPopupShown) return;
  facebookPopupShown = true;
  
  // Create popup overlay
  const overlay = document.createElement('div');
  overlay.id = 'os-hub-facebook-popup';
  overlay.className = 'os-hub-popup-overlay';
  
  // Create popup content
  const popup = document.createElement('div');
  popup.className = 'os-hub-popup-content';
  
  popup.innerHTML = `
    <div class="os-hub-popup-header">
      <h3>Extract Business Information</h3>
      <button class="os-hub-popup-close">&times;</button>
    </div>
    <div class="os-hub-popup-body">
      <p>Would you like to extract the business name and address from this Facebook page for Open Supply Hub?</p>
      <div class="os-hub-popup-buttons">
        <button id="os-hub-extract-yes" class="os-hub-btn os-hub-btn-primary">Yes, Extract Data</button>
        <button id="os-hub-extract-no" class="os-hub-btn os-hub-btn-secondary">No, Cancel</button>
      </div>
    </div>
  `;
  
  overlay.appendChild(popup);
  document.body.appendChild(overlay);
  
  // Event listeners
  const closeBtn = popup.querySelector('.os-hub-popup-close');
  const yesBtn = popup.querySelector('#os-hub-extract-yes');
  const noBtn = popup.querySelector('#os-hub-extract-no');
  
  function closePopup() {
    overlay.remove();
  }
  
  closeBtn.addEventListener('click', closePopup);
  noBtn.addEventListener('click', closePopup);
  
  yesBtn.addEventListener('click', function() {
    const extractedData = extractFacebookBusinessData();
    
    if (extractedData.name || extractedData.address) {
      // Update facility data
      if (extractedData.name) facilityData.name = extractedData.name;
      if (extractedData.address) facilityData.address = extractedData.address;
      if (extractedData.country) facilityData.country = extractedData.country;
      
      // Save to local storage
      chrome.storage.local.set({facilityData: facilityData});
      
      // Show data review popup instead of success message
      showDataReviewPopup(extractedData);
    } else {
      showExtractionErrorMessage();
    }
    
    closePopup();
  });
  
  // Close on overlay click
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) {
      closePopup();
    }
  });
}

function showExtractionSuccessMessage(data) {
  const message = document.createElement('div');
  message.className = 'os-hub-extraction-message os-hub-success';
  
  let content = '<strong>✓ Data Extracted Successfully!</strong><br>';
  if (data.name) content += `Name: ${data.name}<br>`;
  if (data.address) content += `Address: ${data.address}<br>`;
  if (data.country) content += `Country: ${data.country}<br>`;
  content += 'Open the extension popup to review and submit.';
  
  message.innerHTML = content;
  
  document.body.appendChild(message);
  
  setTimeout(() => {
    message.remove();
  }, 5000);
}

function showExtractionErrorMessage() {
  const message = document.createElement('div');
  message.className = 'os-hub-extraction-message os-hub-error';
  message.innerHTML = '<strong>⚠ Extraction Failed</strong><br>Could not find business name or address on this page.';
  
  document.body.appendChild(message);
  
  setTimeout(() => {
    message.remove();
  }, 3000);
}

// Initialize Facebook detection when page loads
function initializeFacebookDetection() {
  console.log('[OS-Hub] Initializing Facebook detection...');
  console.log('[OS-Hub] Document ready state:', document.readyState);
  
  if (document.readyState === 'loading') {
    console.log('[OS-Hub] Document still loading, adding DOMContentLoaded listener');
    document.addEventListener('DOMContentLoaded', function() {
      console.log('[OS-Hub] DOMContentLoaded fired, checking page in 2s');
      setTimeout(checkForFacebookBusinessPage, 2000); // Wait for React to render
    });
  } else {
    console.log('[OS-Hub] Document already loaded, checking page in 2s');
    setTimeout(checkForFacebookBusinessPage, 2000);
  }
  
  // Also try checking multiple times as Facebook content loads dynamically
  setTimeout(() => {
    console.log('[OS-Hub] Secondary check at 5s');
    checkForFacebookBusinessPage();
  }, 5000);
  
  setTimeout(() => {
    console.log('[OS-Hub] Final check at 10s');
    checkForFacebookBusinessPage();
  }, 10000);
}

function checkForFacebookBusinessPage() {
  console.log('[OS-Hub] Running Facebook business page check...');
  
  if (facebookPopupShown) {
    console.log('[OS-Hub] Popup already shown, skipping');
    return;
  }
  
  if (isFacebookBusinessPage()) {
    console.log('[OS-Hub] Facebook business page detected! Showing popup...');
    showFacebookExtractionPopup();
  } else {
    console.log('[OS-Hub] Not detected as Facebook business page');
  }
}

// Data Review and Submission Popup
function showDataReviewPopup(extractedData) {
  // Create popup overlay
  const overlay = document.createElement('div');
  overlay.id = 'os-hub-data-review-popup';
  overlay.className = 'os-hub-popup-overlay';
  
  // Create popup content
  const content = document.createElement('div');
  content.className = 'os-hub-popup-content os-hub-review-popup';
  
  content.innerHTML = `
    <div class="os-hub-popup-header">
      <h3>Review & Submit Data</h3>
      <button class="os-hub-popup-close" aria-label="Close">&times;</button>
    </div>
    <div class="os-hub-popup-body">
      <div class="os-hub-form-section">
        <div class="os-hub-environment-section">
          <label for="os-hub-environment">Environment:</label>
          <select id="os-hub-environment">
            <option value="staging">Staging (staging.opensupplyhub.org)</option>
            <option value="production">Production (opensupplyhub.org)</option>
          </select>
          <div id="os-hub-environment-banner" class="os-hub-environment-banner">Data will be submitted to STAGING</div>
        </div>
        
        <div class="os-hub-api-section">
          <label for="os-hub-api-key">API Key:</label>
          <input type="password" id="os-hub-api-key" placeholder="Enter your API key">
          <div id="os-hub-api-status" class="os-hub-status"></div>
        </div>
        
        <div class="os-hub-form-group">
          <label for="os-hub-facility-name">Name:</label>
          <input type="text" id="os-hub-facility-name" value="${extractedData.name || ''}" required>
        </div>
        
        <div class="os-hub-form-group">
          <label for="os-hub-facility-address">Address:</label>
          <textarea id="os-hub-facility-address" required>${extractedData.address || ''}</textarea>
        </div>
        
        <div class="os-hub-form-group">
          <label for="os-hub-facility-country">Country:</label>
          <input type="text" id="os-hub-facility-country" value="${extractedData.country || ''}" list="os-hub-country-list" placeholder="Type country name or 2-letter code" required>
          <datalist id="os-hub-country-list"></datalist>
        </div>
        
        <div class="os-hub-form-group">
          <label for="os-hub-facility-product-type">Product Type (optional):</label>
          <select id="os-hub-facility-product-type">
            <option value="">Select a product type (optional)</option>
          </select>
        </div>
        
        <div class="os-hub-form-group">
          <label for="os-hub-facility-sector">Sector (optional):</label>
          <select id="os-hub-facility-sector">
            <option value="">Select a sector (optional)</option>
          </select>
        </div>
        
        <div class="os-hub-form-group">
          <label for="os-hub-facility-parent-company">Parent Company (optional):</label>
          <input type="text" id="os-hub-facility-parent-company" placeholder="Start typing to search">
          <div id="os-hub-parent-company-suggestions" class="os-hub-suggestions"></div>
        </div>
      </div>
      
      <div class="os-hub-popup-buttons">
        <button type="button" class="os-hub-btn os-hub-btn-secondary" id="os-hub-cancel-btn">Cancel</button>
        <button type="button" class="os-hub-btn os-hub-btn-primary" id="os-hub-submit-btn">Submit to Open Supply Hub</button>
      </div>
      <div id="os-hub-submit-status" class="os-hub-status"></div>
    </div>
  `;
  
  overlay.appendChild(content);
  document.body.appendChild(overlay);
  
  // Initialize the review popup functionality
  initializeDataReviewPopup();
  
  // Close handlers
  const closeBtn = content.querySelector('.os-hub-popup-close');
  const cancelBtn = content.querySelector('#os-hub-cancel-btn');
  
  function closePopup() {
    document.body.removeChild(overlay);
  }
  
  closeBtn.addEventListener('click', closePopup);
  cancelBtn.addEventListener('click', closePopup);
  
  // Close on overlay click
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) {
      closePopup();
    }
  });
}

// API configuration and data for the review popup
const osHubEnvironments = {
  staging: {
    baseUrl: 'https://staging.opensupplyhub.org/api',
    name: 'STAGING'
  },
  production: {
    baseUrl: 'https://opensupplyhub.org/api', 
    name: 'PRODUCTION'
  }
};

let osHubCurrentEnvironment = 'staging';
let osHubApiBaseUrl = osHubEnvironments.staging.baseUrl;
const osHubApiEndpoint = '/v1/production-locations/';
const osHubParentCompaniesEndpoint = '/v1/parent-companies/';

// Country codes data (same as popup.js)
const osHubCountries = [
  { name: "Afghanistan", alpha_2: "AF" },
  { name: "Albania", alpha_2: "AL" },
  { name: "Algeria", alpha_2: "DZ" },
  { name: "Andorra", alpha_2: "AD" },
  { name: "Angola", alpha_2: "AO" },
  { name: "Antigua and Barbuda", alpha_2: "AG" },
  { name: "Argentina", alpha_2: "AR" },
  { name: "Armenia", alpha_2: "AM" },
  { name: "Australia", alpha_2: "AU" },
  { name: "Austria", alpha_2: "AT" },
  { name: "Azerbaijan", alpha_2: "AZ" },
  { name: "Bahamas", alpha_2: "BS" },
  { name: "Bahrain", alpha_2: "BH" },
  { name: "Bangladesh", alpha_2: "BD" },
  { name: "Barbados", alpha_2: "BB" },
  { name: "Belarus", alpha_2: "BY" },
  { name: "Belgium", alpha_2: "BE" },
  { name: "Belize", alpha_2: "BZ" },
  { name: "Benin", alpha_2: "BJ" },
  { name: "Bhutan", alpha_2: "BT" },
  { name: "Bolivia", alpha_2: "BO" },
  { name: "Bosnia and Herzegovina", alpha_2: "BA" },
  { name: "Botswana", alpha_2: "BW" },
  { name: "Brazil", alpha_2: "BR" },
  { name: "Brunei", alpha_2: "BN" },
  { name: "Bulgaria", alpha_2: "BG" },
  { name: "Burkina Faso", alpha_2: "BF" },
  { name: "Burundi", alpha_2: "BI" },
  { name: "Cambodia", alpha_2: "KH" },
  { name: "Cameroon", alpha_2: "CM" },
  { name: "Canada", alpha_2: "CA" },
  { name: "Cape Verde", alpha_2: "CV" },
  { name: "Central African Republic", alpha_2: "CF" },
  { name: "Chad", alpha_2: "TD" },
  { name: "Chile", alpha_2: "CL" },
  { name: "China", alpha_2: "CN" },
  { name: "Colombia", alpha_2: "CO" },
  { name: "Comoros", alpha_2: "KM" },
  { name: "Congo", alpha_2: "CG" },
  { name: "Costa Rica", alpha_2: "CR" },
  { name: "Croatia", alpha_2: "HR" },
  { name: "Cuba", alpha_2: "CU" },
  { name: "Cyprus", alpha_2: "CY" },
  { name: "Czech Republic", alpha_2: "CZ" },
  { name: "Denmark", alpha_2: "DK" },
  { name: "Djibouti", alpha_2: "DJ" },
  { name: "Dominica", alpha_2: "DM" },
  { name: "Dominican Republic", alpha_2: "DO" },
  { name: "Ecuador", alpha_2: "EC" },
  { name: "Egypt", alpha_2: "EG" },
  { name: "El Salvador", alpha_2: "SV" },
  { name: "Equatorial Guinea", alpha_2: "GQ" },
  { name: "Eritrea", alpha_2: "ER" },
  { name: "Estonia", alpha_2: "EE" },
  { name: "Ethiopia", alpha_2: "ET" },
  { name: "Fiji", alpha_2: "FJ" },
  { name: "Finland", alpha_2: "FI" },
  { name: "France", alpha_2: "FR" },
  { name: "Gabon", alpha_2: "GA" },
  { name: "Gambia", alpha_2: "GM" },
  { name: "Georgia", alpha_2: "GE" },
  { name: "Germany", alpha_2: "DE" },
  { name: "Ghana", alpha_2: "GH" },
  { name: "Greece", alpha_2: "GR" },
  { name: "Grenada", alpha_2: "GD" },
  { name: "Guatemala", alpha_2: "GT" },
  { name: "Guinea", alpha_2: "GN" },
  { name: "Guinea-Bissau", alpha_2: "GW" },
  { name: "Guyana", alpha_2: "GY" },
  { name: "Haiti", alpha_2: "HT" },
  { name: "Honduras", alpha_2: "HN" },
  { name: "Hungary", alpha_2: "HU" },
  { name: "Iceland", alpha_2: "IS" },
  { name: "India", alpha_2: "IN" },
  { name: "Indonesia", alpha_2: "ID" },
  { name: "Iran", alpha_2: "IR" },
  { name: "Iraq", alpha_2: "IQ" },
  { name: "Ireland", alpha_2: "IE" },
  { name: "Israel", alpha_2: "IL" },
  { name: "Italy", alpha_2: "IT" },
  { name: "Jamaica", alpha_2: "JM" },
  { name: "Japan", alpha_2: "JP" },
  { name: "Jordan", alpha_2: "JO" },
  { name: "Kazakhstan", alpha_2: "KZ" },
  { name: "Kenya", alpha_2: "KE" },
  { name: "Kiribati", alpha_2: "KI" },
  { name: "North Korea", alpha_2: "KP" },
  { name: "South Korea", alpha_2: "KR" },
  { name: "Kuwait", alpha_2: "KW" },
  { name: "Kyrgyzstan", alpha_2: "KG" },
  { name: "Laos", alpha_2: "LA" },
  { name: "Latvia", alpha_2: "LV" },
  { name: "Lebanon", alpha_2: "LB" },
  { name: "Lesotho", alpha_2: "LS" },
  { name: "Liberia", alpha_2: "LR" },
  { name: "Libya", alpha_2: "LY" },
  { name: "Liechtenstein", alpha_2: "LI" },
  { name: "Lithuania", alpha_2: "LT" },
  { name: "Luxembourg", alpha_2: "LU" },
  { name: "Madagascar", alpha_2: "MG" },
  { name: "Malawi", alpha_2: "MW" },
  { name: "Malaysia", alpha_2: "MY" },
  { name: "Maldives", alpha_2: "MV" },
  { name: "Mali", alpha_2: "ML" },
  { name: "Malta", alpha_2: "MT" },
  { name: "Marshall Islands", alpha_2: "MH" },
  { name: "Mauritania", alpha_2: "MR" },
  { name: "Mauritius", alpha_2: "MU" },
  { name: "Mexico", alpha_2: "MX" },
  { name: "Micronesia", alpha_2: "FM" },
  { name: "Moldova", alpha_2: "MD" },
  { name: "Monaco", alpha_2: "MC" },
  { name: "Mongolia", alpha_2: "MN" },
  { name: "Montenegro", alpha_2: "ME" },
  { name: "Morocco", alpha_2: "MA" },
  { name: "Mozambique", alpha_2: "MZ" },
  { name: "Myanmar", alpha_2: "MM" },
  { name: "Namibia", alpha_2: "NA" },
  { name: "Nauru", alpha_2: "NR" },
  { name: "Nepal", alpha_2: "NP" },
  { name: "Netherlands", alpha_2: "NL" },
  { name: "New Zealand", alpha_2: "NZ" },
  { name: "Nicaragua", alpha_2: "NI" },
  { name: "Niger", alpha_2: "NE" },
  { name: "Nigeria", alpha_2: "NG" },
  { name: "North Macedonia", alpha_2: "MK" },
  { name: "Norway", alpha_2: "NO" },
  { name: "Oman", alpha_2: "OM" },
  { name: "Pakistan", alpha_2: "PK" },
  { name: "Palau", alpha_2: "PW" },
  { name: "Palestine", alpha_2: "PS" },
  { name: "Panama", alpha_2: "PA" },
  { name: "Papua New Guinea", alpha_2: "PG" },
  { name: "Paraguay", alpha_2: "PY" },
  { name: "Peru", alpha_2: "PE" },
  { name: "Philippines", alpha_2: "PH" },
  { name: "Poland", alpha_2: "PL" },
  { name: "Portugal", alpha_2: "PT" },
  { name: "Qatar", alpha_2: "QA" },
  { name: "Romania", alpha_2: "RO" },
  { name: "Russia", alpha_2: "RU" },
  { name: "Rwanda", alpha_2: "RW" },
  { name: "Saint Kitts and Nevis", alpha_2: "KN" },
  { name: "Saint Lucia", alpha_2: "LC" },
  { name: "Saint Vincent and the Grenadines", alpha_2: "VC" },
  { name: "Samoa", alpha_2: "WS" },
  { name: "San Marino", alpha_2: "SM" },
  { name: "Sao Tome and Principe", alpha_2: "ST" },
  { name: "Saudi Arabia", alpha_2: "SA" },
  { name: "Senegal", alpha_2: "SN" },
  { name: "Serbia", alpha_2: "RS" },
  { name: "Seychelles", alpha_2: "SC" },
  { name: "Sierra Leone", alpha_2: "SL" },
  { name: "Singapore", alpha_2: "SG" },
  { name: "Slovakia", alpha_2: "SK" },
  { name: "Slovenia", alpha_2: "SI" },
  { name: "Solomon Islands", alpha_2: "SB" },
  { name: "Somalia", alpha_2: "SO" },
  { name: "South Africa", alpha_2: "ZA" },
  { name: "South Sudan", alpha_2: "SS" },
  { name: "Spain", alpha_2: "ES" },
  { name: "Sri Lanka", alpha_2: "LK" },
  { name: "Sudan", alpha_2: "SD" },
  { name: "Suriname", alpha_2: "SR" },
  { name: "Sweden", alpha_2: "SE" },
  { name: "Switzerland", alpha_2: "CH" },
  { name: "Syria", alpha_2: "SY" },
  { name: "Taiwan", alpha_2: "TW" },
  { name: "Tajikistan", alpha_2: "TJ" },
  { name: "Tanzania", alpha_2: "TZ" },
  { name: "Thailand", alpha_2: "TH" },
  { name: "Timor-Leste", alpha_2: "TL" },
  { name: "Togo", alpha_2: "TG" },
  { name: "Tonga", alpha_2: "TO" },
  { name: "Trinidad and Tobago", alpha_2: "TT" },
  { name: "Tunisia", alpha_2: "TN" },
  { name: "Turkey", alpha_2: "TR" },
  { name: "Turkmenistan", alpha_2: "TM" },
  { name: "Tuvalu", alpha_2: "TV" },
  { name: "Uganda", alpha_2: "UG" },
  { name: "Ukraine", alpha_2: "UA" },
  { name: "United Arab Emirates", alpha_2: "AE" },
  { name: "United Kingdom", alpha_2: "GB" },
  { name: "United States", alpha_2: "US" },
  { name: "Uruguay", alpha_2: "UY" },
  { name: "Uzbekistan", alpha_2: "UZ" },
  { name: "Vanuatu", alpha_2: "VU" },
  { name: "Vatican City", alpha_2: "VA" },
  { name: "Venezuela", alpha_2: "VE" },
  { name: "Vietnam", alpha_2: "VN" },
  { name: "Yemen", alpha_2: "YE" },
  { name: "Zambia", alpha_2: "ZM" },
  { name: "Zimbabwe", alpha_2: "ZW" }
];

// Sectors data (same as popup.js)
const osHubSectors = [
  { name: "Agriculture" },
  { name: "Animal Production" },
  { name: "Apparel" },
  { name: "Apparel Accessories" },
  { name: "Appliances"},
  { name: "Aquaculture"},
  { name: "Automotive"},
  { name: "Biotechnology" },
  { name: "Coal" },
  { name: "Construction"},
  { name: "Electronics" },
  { name: "Energy" },
  { name: "Fishing" },
  { name: "Food & Beverage" },
  { name: "Footwear" },
  { name: "Forestry" },
  { name: "Furniture" },
  { name: "Hard Goods" },
  { name: "Health" },
  { name: "Healthcare" },
  { name: "Home" },
  { name: "Home Accessories" },
  { name: "Home Furnishings" },
  { name: "Home Textiles" },
  { name: "Jewelry" },
  { name: "Leather" },
  { name: "Logging" },
  { name: "Manufacturing" },
  { name: "Mining" },
  { name: "Nondurable Goods" },
  { name: "Oil & Gas" },
  { name: "Packaging" },
  { name: "Paper Products" },
  { name: "Personal Care Products" },
  { name: "Pharmaceuticals" },
  { name: "Plastics" },
  { name: "Printing" },
  { name: "Renewable Energy" },
  { name: "Rubber Products" },
  { name: "Sporting Goods" },
  { name: "Storage" },
  { name: "Textiles" },
  { name: "Toys" },
  { name: "Tobacco Products" },
  { name: "Utilities" },
  { name: "Warehousing" },
  { name: "Waste Management" },
  { name: "Wholesale Trade" },
  { name: "Wood Products" }
];

// Product types data (same as popup.js)
const osHubProductTypes = [
  { name: "Accessories" },
  { name: "Bags" },
  { name: "Belts" },
  { name: "Bottoms" },
  { name: "Dresses" },
  { name: "Denim" },
  { name: "Fabrics" },
  { name: "Footwear" },
  { name: "Gloves" },
  { name: "Hats" },
  { name: "Jackets" },
  { name: "Jewelry" },
  { name: "Knitwear" },
  { name: "Leather Goods" },
  { name: "Outerwear" },
  { name: "Shirts" },
  { name: "Sleepwear" },
  { name: "Socks" },
  { name: "Sportswear" },
  { name: "Suits" },
  { name: "Swimwear" },
  { name: "T-shirts" },
  { name: "Tops" },
  { name: "Underwear" },
  { name: "Uniforms" }
];

let osHubSelectedParentCompany = null;

// Helper function to make API requests via background script
function makeApiRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      action: 'makeApiRequest',
      url: url,
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body || undefined
    }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      if (response.success) {
        resolve(response.data);
      } else {
        reject(new Error(response.error));
      }
    });
  });
}

function initializeDataReviewPopup() {
  const environmentSelect = document.getElementById('os-hub-environment');
  const environmentBanner = document.getElementById('os-hub-environment-banner');
  const apiKeyInput = document.getElementById('os-hub-api-key');
  const apiStatus = document.getElementById('os-hub-api-status');
  const facilityNameInput = document.getElementById('os-hub-facility-name');
  const facilityAddressInput = document.getElementById('os-hub-facility-address');
  const facilityCountryInput = document.getElementById('os-hub-facility-country');
  const countryList = document.getElementById('os-hub-country-list');
  const facilityProductTypeSelect = document.getElementById('os-hub-facility-product-type');
  const facilitySectorSelect = document.getElementById('os-hub-facility-sector');
  const facilityParentCompanyInput = document.getElementById('os-hub-facility-parent-company');
  const parentCompanySuggestions = document.getElementById('os-hub-parent-company-suggestions');
  const submitFacilityBtn = document.getElementById('os-hub-submit-btn');
  const submitStatus = document.getElementById('os-hub-submit-status');

  // Load saved environment setting
  chrome.storage.sync.get(['environment'], function(result) {
    if (result.environment) {
      osHubCurrentEnvironment = result.environment;
      environmentSelect.value = osHubCurrentEnvironment;
      osHubApiBaseUrl = osHubEnvironments[osHubCurrentEnvironment].baseUrl;
      updateEnvironmentBanner();
      loadApiKey();
    } else {
      loadApiKey();
    }
  });

  // Update the environment banner
  function updateEnvironmentBanner() {
    environmentBanner.textContent = `Data will be submitted to ${osHubEnvironments[osHubCurrentEnvironment].name}`;
    if (osHubCurrentEnvironment === 'production') {
      environmentBanner.classList.add('os-hub-production');
    } else {
      environmentBanner.classList.remove('os-hub-production');
    }
  }

  // Function to load the API key for the current environment
  function loadApiKey() {
    const keyName = `apiKey_${osHubCurrentEnvironment}`;
    chrome.storage.sync.get([keyName], function(result) {
      if (result[keyName]) {
        apiKeyInput.value = result[keyName];
        apiStatus.textContent = 'API key loaded';
        apiStatus.className = 'os-hub-status os-hub-success';
      } else {
        apiKeyInput.value = '';
        apiStatus.textContent = 'No API key saved for this environment';
        apiStatus.className = 'os-hub-status os-hub-error';
      }
    });
  }

  // Listen for environment changes
  environmentSelect.addEventListener('change', function() {
    osHubCurrentEnvironment = this.value;
    osHubApiBaseUrl = osHubEnvironments[osHubCurrentEnvironment].baseUrl;
    
    // Save the selected environment
    chrome.storage.sync.set({ environment: osHubCurrentEnvironment });
    
    // Update the banner
    updateEnvironmentBanner();
    
    // Load the API key for the selected environment
    loadApiKey();
  });

  // Populate country datalist
  osHubCountries.forEach(country => {
    const option = document.createElement('option');
    option.value = country.alpha_2;
    option.setAttribute('data-name', country.name);
    option.text = `${country.name} (${country.alpha_2})`;
    countryList.appendChild(option);
  });

  // Add event listener to handle country input
  facilityCountryInput.addEventListener('input', function() {
    const value = this.value.trim().toUpperCase();
    
    // If the input is exactly 2 characters, check if it's a valid country code
    if (value.length === 2) {
      const country = osHubCountries.find(c => c.alpha_2 === value);
      if (country) {
        this.value = value;
        this.setAttribute('data-selected-country', country.name);
      }
    } else {
      // Check if the input matches a country name
      const country = osHubCountries.find(c => c.name.toUpperCase() === value.toUpperCase());
      if (country) {
        this.value = country.alpha_2;
        this.setAttribute('data-selected-country', country.name);
      }
    }
  });

  // Add blur event to validate the country input
  facilityCountryInput.addEventListener('blur', function() {
    const value = this.value.trim().toUpperCase();
    if (value.length > 0) {
      const country = osHubCountries.find(c => c.alpha_2 === value);
      if (!country) {
        const countryByName = osHubCountries.find(c => c.name.toUpperCase() === value.toUpperCase());
        if (countryByName) {
          this.value = countryByName.alpha_2;
          this.setAttribute('data-selected-country', countryByName.name);
        } else {
          this.setCustomValidity('Please select a valid country code');
          return;
        }
      }
      this.setCustomValidity('');
    }
  });

  // Populate sector dropdown
  osHubSectors.forEach(sector => {
    const option = document.createElement('option');
    option.value = sector.name;
    option.textContent = sector.name;
    facilitySectorSelect.appendChild(option);
  });

  // Populate product type dropdown
  osHubProductTypes.forEach(productType => {
    const option = document.createElement('option');
    option.value = productType.name;
    option.textContent = productType.name;
    facilityProductTypeSelect.appendChild(option);
  });

  // Parent company search functionality
  facilityParentCompanyInput.addEventListener('input', function() {
    const query = this.value.trim();
    
    if (query.length < 2) {
      parentCompanySuggestions.style.display = 'none';
      osHubSelectedParentCompany = null;
      return;
    }
    
    const keyName = `apiKey_${osHubCurrentEnvironment}`;
    chrome.storage.sync.get([keyName], function(result) {
      if (!result[keyName]) return;
      
      makeApiRequest(osHubApiBaseUrl + osHubParentCompaniesEndpoint + '?name=' + encodeURIComponent(query) + '&size=10', {
        headers: {
          'Authorization': 'Token ' + result[keyName]
        }
      })
      .then(companies => {
        parentCompanySuggestions.innerHTML = '';
        
        if (companies.length === 0) {
          parentCompanySuggestions.style.display = 'none';
          return;
        }
        
        companies.forEach(company => {
          const item = document.createElement('div');
          item.className = 'os-hub-suggestion-item';
          item.textContent = company.name;
          item.addEventListener('click', function() {
            facilityParentCompanyInput.value = company.name;
            osHubSelectedParentCompany = company.name;
            parentCompanySuggestions.style.display = 'none';
          });
          parentCompanySuggestions.appendChild(item);
        });
        
        parentCompanySuggestions.style.display = 'block';
      })
      .catch(error => {
        console.error('Error searching parent companies:', error);
        parentCompanySuggestions.style.display = 'none';
      });
    });
  });

  // Hide suggestions when clicking outside
  document.addEventListener('click', function(event) {
    if (event.target !== facilityParentCompanyInput) {
      parentCompanySuggestions.style.display = 'none';
    }
  });

  // Submit location to Open Supply Hub
  submitFacilityBtn.addEventListener('click', function() {
    // Get form values
    const name = facilityNameInput.value.trim();
    const address = facilityAddressInput.value.trim();
    const country = facilityCountryInput.value.trim().toUpperCase();
    const productType = facilityProductTypeSelect.value.trim();
    const sector = facilitySectorSelect.value.trim();
    const parentCompany = facilityParentCompanyInput.value.trim();
    
    // Validate required fields
    if (!name || !address || !country) {
      submitStatus.textContent = 'Name, address, and country are required';
      submitStatus.className = 'os-hub-status os-hub-error';
      return;
    }
    
    // Get API key for the current environment
    const keyName = `apiKey_${osHubCurrentEnvironment}`;
    chrome.storage.sync.get([keyName], function(result) {
      if (!result[keyName]) {
        submitStatus.textContent = `Please enter your API key for ${osHubEnvironments[osHubCurrentEnvironment].name}`;
        submitStatus.className = 'os-hub-status os-hub-error';
        return;
      }
      
      // Save the API key for future use
      const storageData = {};
      storageData[keyName] = apiKeyInput.value.trim();
      chrome.storage.sync.set(storageData);
      
      submitStatus.textContent = 'Submitting...';
      submitStatus.className = 'os-hub-status';
      
      // Prepare payload for Open Supply Hub API
      const payload = {
        name: name,
        address: address,
        country: country,
        source_name: "OS Hub Chrome Extension - Facebook",
        source_link: window.location.href
      };
      
      // Add optional fields if provided
      if (productType) payload.product_types = [productType];
      if (sector) payload.sectors = [sector];
      if (parentCompany) payload.parent_companies = [parentCompany];
    
      // Make API request to Open Supply Hub via background script
      makeApiRequest(osHubApiBaseUrl + osHubApiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Token ' + (apiKeyInput.value.trim() || result[keyName])
        },
        body: JSON.stringify(payload)
      })
      .then(data => {
        submitStatus.textContent = '✓ Location submitted successfully!';
        submitStatus.className = 'os-hub-status os-hub-success';
        
        // Show additional IDs if available
        if (data.moderation_id) {
          submitStatus.textContent += ` Moderation ID: ${data.moderation_id}`;
        }
        
        if (data.os_id) {
          submitStatus.textContent += ` OS ID: ${data.os_id}`;
        }
        
        // Clear form after successful submission
        facilityNameInput.value = '';
        facilityAddressInput.value = '';
        facilityCountryInput.value = '';
        facilityProductTypeSelect.selectedIndex = 0;
        facilitySectorSelect.selectedIndex = 0;
        facilityParentCompanyInput.value = '';
        osHubSelectedParentCompany = null;
        
        // Clear local storage
        chrome.storage.local.remove(['facilityData']);
        
        // Auto-close after 3 seconds
        setTimeout(() => {
          const popup = document.getElementById('os-hub-data-review-popup');
          if (popup) {
            document.body.removeChild(popup);
          }
        }, 3000);
      })
      .catch(error => {
        submitStatus.textContent = `Error: ${error.message}`;
        submitStatus.className = 'os-hub-status os-hub-error';
      });
    });
  });
}

// LinkedIn location detection and extraction functions
function detectLinkedInLocations() {
  if (!window.location.hostname.includes('linkedin.com')) {
    return 0;
  }

  if (!window.location.pathname.includes('/about/')) {
    return 0; // Only detect on About pages
  }

  console.log('[OS-Hub] Detecting LinkedIn locations on About page');

  let locationCount = 0;

  // Look for headquarters section
  const hqSelectors = [
    '.org-top-card-summary__headquarter',
    '.org-about-us__headquarter',
    '[data-test-id="about-us-headquarters"]'
  ];

  for (const selector of hqSelectors) {
    const hqElement = document.querySelector(selector);
    if (hqElement && hqElement.textContent.trim()) {
      locationCount++;
      console.log('[OS-Hub] Found headquarters location');
      break;
    }
  }

  // Manual search for "Headquarters" text
  if (locationCount === 0) {
    const dtElements = document.querySelectorAll('.org-page-details dt');
    for (const dt of dtElements) {
      if (dt.textContent.toLowerCase().includes('headquarters')) {
        const dd = dt.nextElementSibling;
        if (dd && dd.tagName === 'DD' && dd.textContent.trim()) {
          locationCount++;
          console.log('[OS-Hub] Found headquarters via text search');
          break;
        }
      }
    }
  }

  // Look for additional locations section
  const locationSectionSelectors = [
    '[data-test-id="org-locations"]',
    '.org-locations__card-list',
    '.org-about-us__locations'
  ];

  for (const selector of locationSectionSelectors) {
    const locationSection = document.querySelector(selector);
    if (locationSection) {
      // Count individual location cards/items
      const locationCards = locationSection.querySelectorAll(
        '.org-locations__card, .location-card, [class*="location"]'
      );

      if (locationCards.length > 0) {
        locationCount += locationCards.length;
        console.log(`[OS-Hub] Found ${locationCards.length} additional locations`);
      } else if (locationSection.textContent.includes(',')) {
        // If no cards but text with commas, assume multiple locations
        const commaCount = (locationSection.textContent.match(/,/g) || []).length;
        locationCount += Math.min(commaCount, 3); // Cap at reasonable number
        console.log(`[OS-Hub] Estimated ${Math.min(commaCount, 3)} locations from comma-separated text`);
      }
      break;
    }
  }

  // Manual search for "Locations" text if nothing found yet
  if (locationCount <= 1) {
    const dtElements = document.querySelectorAll('.org-page-details dt');
    for (const dt of dtElements) {
      if (dt.textContent.toLowerCase().includes('locations') ||
          dt.textContent.toLowerCase().includes('offices')) {
        const dd = dt.nextElementSibling;
        if (dd && dd.tagName === 'DD' && dd.textContent.trim()) {
          // Count locations by looking for comma-separated addresses
          const text = dd.textContent;
          if (text.includes(',')) {
            const possibleCount = text.split('\n').filter(line =>
              line.trim() && (line.includes(',') || /\d+\s+\w+/.test(line))
            ).length;
            if (possibleCount > 1) {
              locationCount = Math.min(possibleCount, 4);
              console.log(`[OS-Hub] Found ${locationCount} locations via text search`);
            }
          }
          break;
        }
      }
    }
  }

  // Fallback: Look for any address-like text patterns on About page
  if (locationCount === 0) {
    const aboutContent = document.querySelector('.org-about-us, .about-section, [class*="about"]');
    if (aboutContent) {
      const text = aboutContent.textContent;
      // Count address-like patterns (number + street, city state zip)
      const addressPatterns = [
        /\d+\s+[A-Za-z\s]+(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd)/gi,
        /[A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5}/g // City, State ZIP
      ];

      for (const pattern of addressPatterns) {
        const matches = text.match(pattern);
        if (matches) {
          locationCount = Math.min(matches.length, 4); // Cap at 4 locations
          console.log(`[OS-Hub] Found ${locationCount} address patterns in about text`);
          break;
        }
      }
    }
  }

  // Default to 1 if we're on About page but found nothing specific
  if (locationCount === 0 && window.location.pathname.includes('/about/')) {
    locationCount = 1;
  }

  console.log(`[OS-Hub] Total detected locations: ${locationCount}`);
  return locationCount;
}

function extractLinkedInBusinessName() {
  console.log('[OS-Hub] Extracting LinkedIn business name...');

  const nameSelectors = [
    // New LinkedIn layout selectors
    '.org-top-card-summary__title h1',
    '.org-top-card-summary-info__title h1',
    '.org-top-card-summary__info h1',
    // Updated selectors for current LinkedIn structure
    'h1[data-test-id="org-top-card-summary-info-title"]',
    '.break-words h1',
    '.org-top-card-summary h1',
    '.org-page-header h1',
    // Fallback selectors
    '.org-top-card-summary__title',
    '.org-top-card-summary-info__title',
    '.break-words',
    // General fallbacks
    'h1',
    '.pv-entity__company-summary-info h3',
    '.pv-entity__company-summary-info h2'
  ];

  for (const selector of nameSelectors) {
    console.log(`[OS-Hub] Trying selector: ${selector}`);
    const element = document.querySelector(selector);

    if (element && element.textContent && element.textContent.trim()) {
      let name = element.textContent.trim();

      // Clean up the name
      name = name.replace(/\s+/g, ' ').trim();

      console.log(`[OS-Hub] Found potential name: "${name}"`);

      // Skip if it looks like a generic LinkedIn element or page text
      if (name.length > 2 && name.length < 150 &&
          !name.includes('LinkedIn') &&
          !name.includes('followers') &&
          !name.includes('employees') &&
          !name.includes('About') &&
          !name.includes('Overview') &&
          !name.includes('Posts') &&
          !name.includes('Jobs') &&
          !name.includes('People') &&
          !name.includes('Sign in') &&
          !name.includes('Join now') &&
          !name.toLowerCase().includes('company page') &&
          !name.includes('@') &&
          !name.match(/^\d+$/) && // Not just numbers
          !name.match(/^[^\w\s]+$/) // Not just special characters
      ) {
        console.log(`[OS-Hub] LinkedIn business name found: "${name}"`);
        return name;
      } else {
        console.log(`[OS-Hub] Skipping "${name}" - appears to be UI text`);
      }
    }
  }

  // Fallback: try to extract from page title
  const pageTitle = document.title;
  if (pageTitle && pageTitle !== 'LinkedIn' && !pageTitle.includes('Sign in')) {
    const titleParts = pageTitle.split('|');
    if (titleParts.length > 0) {
      let companyName = titleParts[0].trim();
      companyName = companyName.replace('- LinkedIn', '').trim();

      if (companyName.length > 2 && companyName.length < 100) {
        console.log(`[OS-Hub] LinkedIn business name from title: "${companyName}"`);
        return companyName;
      }
    }
  }

  console.log('[OS-Hub] No LinkedIn business name found');
  return null;
}

function extractLinkedInLocations() {
  console.log('[OS-Hub] Extracting LinkedIn locations...');

  const locations = [];
  const businessName = extractLinkedInBusinessName();
  let headquartersFound = false;

  // First priority: Target the specific LinkedIn location card structure
  console.log('[OS-Hub] Searching for LinkedIn location cards...');
  const locationCards = document.querySelectorAll('.org-location-card');

  for (const card of locationCards) {
    // Look for the address paragraph within the location card
    const addressParagraph = card.querySelector('p.t-14.t-black--light.t-normal.break-words, p[dir="ltr"]');
    if (addressParagraph && addressParagraph.textContent.trim()) {
      const address = addressParagraph.textContent.trim();
      console.log(`[OS-Hub] Found location card address: "${address}"`);

      // Check if this is marked as primary
      const isPrimary = card.querySelector('.label-16dp[aria-label*="primary"]') ||
                       card.querySelector('span.label-16dp') &&
                       card.querySelector('span.label-16dp').textContent.toLowerCase().includes('primary');

      locations.push({
        name: businessName ? `${businessName} - ${isPrimary ? 'Headquarters' : 'Office'}` : (isPrimary ? 'Headquarters' : 'Office'),
        address: address,
        country: extractCountryFromAddress(address) || 'US',
        isHeadquarters: !!isPrimary
      });
      headquartersFound = true;
      console.log(`[OS-Hub] Extracted location from org-location-card: ${address} (Primary: ${!!isPrimary})`);
    }
  }

  // If we found locations from location cards, return early to avoid duplicates
  if (locations.length > 0) {
    console.log(`[OS-Hub] Found ${locations.length} locations from location cards, skipping fallback methods`);
    return locations;
  }

  // Fallback: Extract headquarters with comprehensive selector search
  const hqSelectors = [
    // Standard LinkedIn selectors
    '.org-top-card-summary__headquarter',
    '.org-about-us__headquarter',
    '[data-test-id="about-us-headquarters"]',
    // LinkedIn location and contact sections
    '.org-locations__card-content',
    '.org-location-card__content',
    '.org-top-card-summary__info .org-top-card-summary__info-item',
    '.org-page-header__subtitle',
    '.org-top-card-summary__subtitle',
    // Contact info sections where addresses often appear
    '.org-top-card-summary__contact-info',
    '.org-about-module',
    '.org-about-us__info',
    '.org-top-card-summary__info',
    '.org-page-details__contact-info',
    // Location specific containers
    '.org-locations',
    '.org-location',
    '.location-card',
    '.contact-info',
    // More generic selectors for address content
    '[class*="location"]',
    '[class*="address"]',
    '[class*="contact"]',
    '[class*="headquarter"]',
    // Broader search for any div that might contain address
    '.org-top-card-summary div',
    '.org-about-us div',
    '.org-page-details div'
  ];

  console.log('[OS-Hub] Trying standard headquarters selectors...');
  for (const selector of hqSelectors) {
    console.log(`[OS-Hub] Testing HQ selector: ${selector}`);
    const hqElement = document.querySelector(selector);
    if (hqElement && hqElement.textContent.trim()) {
      console.log(`[OS-Hub] Found HQ element: "${hqElement.textContent.trim()}"`);
      const address = cleanLinkedInAddress(hqElement.textContent.trim());
      if (address) {
        locations.push({
          name: businessName ? `${businessName} - Headquarters` : 'Headquarters',
          address: address,
          country: extractCountryFromAddress(address) || '',
          isHeadquarters: true
        });
        headquartersFound = true;
        console.log('[OS-Hub] Extracted headquarters location:', address);
        break;
      }
    }
  }

  // Enhanced search for headquarters in org details using multiple approaches
  if (!headquartersFound) {
    console.log('[OS-Hub] Searching org-page-details for headquarters...');

    // Method 1: Look for dt/dd pairs
    const dtElements = document.querySelectorAll('.org-page-details dt, dt');
    for (const dt of dtElements) {
      const dtText = dt.textContent.toLowerCase();
      console.log(`[OS-Hub] Checking dt: "${dtText}"`);

      if (dtText.includes('headquarters') || dtText.includes('headquarter') ||
          dtText.includes('location') || dtText.includes('address') ||
          dtText.includes('office')) {
        const dd = dt.nextElementSibling;
        if (dd && dd.textContent && dd.textContent.trim()) {
          const addressText = dd.textContent.trim();
          console.log(`[OS-Hub] Found HQ dd: "${addressText}"`);

          // For simple city/state format or any location text, accept it
          if (addressText.length > 2) {
            // Use the raw text if it's a simple city/state format
            let address = cleanLinkedInAddress(addressText);
            if (!address && addressText.length < 100) {
              // If cleanLinkedInAddress doesn't find a pattern but text is reasonable, use it
              address = addressText;
            }

            if (address) {
              locations.push({
                name: businessName ? `${businessName} - Headquarters` : 'Headquarters',
                address: address,
                country: extractCountryFromAddress(address) || 'US', // Default to US for state abbreviations
                isHeadquarters: true
              });
              headquartersFound = true;
              console.log('[OS-Hub] Extracted headquarters from dt/dd:', address);
              break;
            }
          }
        }
      }
    }
  }

  // Method 2: Look for full address patterns anywhere on the page
  if (!headquartersFound) {
    console.log('[OS-Hub] Searching for full address patterns in page content...');

    // First, try to find full addresses with street numbers and zip codes
    const pageText = document.body.textContent;

    // More precise pattern that captures clean addresses and stops at boundaries
    const fullAddressPattern = /(\d+\s+[A-Za-z\s]+(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Way|Place|Pl|Circle|Cir|Court|Ct)[^,]*,\s*[A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?(?:,\s*[A-Z]{2,})?(?=\s|$|[^A-Za-z0-9,\s-]))/gi;

    const fullAddressMatches = [...pageText.matchAll(fullAddressPattern)];
    if (fullAddressMatches && fullAddressMatches.length > 0) {
      console.log(`[OS-Hub] Found ${fullAddressMatches.length} full address patterns on page`);

      // Extract clean addresses and deduplicate
      const allAddresses = fullAddressMatches.map(match => match[1].trim());
      const uniqueAddresses = [...new Set(allAddresses)]; // Remove duplicates

      const address = uniqueAddresses[0]; // Take the first unique address
      console.log(`[OS-Hub] Using clean address: ${address}`);

      locations.push({
        name: businessName ? `${businessName} - Headquarters` : 'Headquarters',
        address: address,
        country: extractCountryFromAddress(address) || 'US',
        isHeadquarters: true
      });
      headquartersFound = true;
    }
  }

  // Method 3: Look for any text that might contain location information in specific containers
  if (!headquartersFound) {
    console.log('[OS-Hub] Searching for location patterns in page containers...');

    // Search all elements that might contain location info
    const locationSearchSelectors = [
      '.org-page-details',
      '.org-about-us',
      '.org-top-card-summary',
      '.pv-entity__company-summary-info',
      '.company-info',
      '.about-section'
    ];

    for (const selector of locationSearchSelectors) {
      const container = document.querySelector(selector);
      if (container) {
        console.log(`[OS-Hub] Searching in container: ${selector}`);
        const text = container.textContent;

        // Look for address patterns in the text
        const addresses = extractAddressesFromText(text);
        if (addresses.length > 0) {
          console.log(`[OS-Hub] Found ${addresses.length} address patterns`);
          const bestAddress = addresses[0]; // Take the first/best match

          locations.push({
            name: businessName ? `${businessName} - Headquarters` : 'Headquarters',
            address: bestAddress,
            country: extractCountryFromAddress(bestAddress) || '',
            isHeadquarters: true
          });
          headquartersFound = true;
          console.log('[OS-Hub] Extracted headquarters from text pattern:', bestAddress);
          break;
        }
      }
    }
  }

  // Method 3: Look for city/state patterns even without full addresses
  if (!headquartersFound) {
    console.log('[OS-Hub] Searching for city/state patterns...');

    const allText = document.body.textContent;

    // Common patterns for city, state combinations
    const cityStatePatterns = [
      /([A-Za-z\s]+),\s*([A-Z]{2})\b/g,  // City, ST
      /([A-Za-z\s]+),\s*([A-Za-z\s]+),\s*([A-Z]{2})\b/g,  // City, County, ST
      /\b([A-Z][a-z]+)\s*,\s*([A-Z]{2})\b/g  // Simple City, ST
    ];

    for (const pattern of cityStatePatterns) {
      const matches = [...allText.matchAll(pattern)];
      console.log(`[OS-Hub] Found ${matches.length} city/state matches`);

      if (matches.length > 0) {
        // Filter for reasonable-looking city names (not UI text)
        const validMatches = matches.filter(match => {
          const fullMatch = match[0];
          return !fullMatch.includes('LinkedIn') &&
                 !fullMatch.includes('Sign') &&
                 !fullMatch.includes('Join') &&
                 !fullMatch.includes('Home') &&
                 fullMatch.length < 50; // Reasonable length
        });

        if (validMatches.length > 0) {
          const cityState = validMatches[0][0];
          console.log(`[OS-Hub] Using city/state: ${cityState}`);

          locations.push({
            name: businessName ? `${businessName} - Headquarters` : 'Headquarters',
            address: cityState,
            country: 'US', // Assume US for state abbreviations
            isHeadquarters: true
          });
          headquartersFound = true;
          console.log('[OS-Hub] Extracted headquarters from city/state pattern:', cityState);
          break;
        }
      }
    }
  }

  // Extract additional locations
  const locationSectionSelectors = [
    '[data-test-id="org-locations"]',
    '.org-locations__card-list',
    '.org-about-us__locations'
  ];

  for (const selector of locationSectionSelectors) {
    const locationSection = document.querySelector(selector);
    if (locationSection) {
      const locationCards = locationSection.querySelectorAll(
        '.org-locations__card, .location-card, [class*="location"]'
      );

      locationCards.forEach((card, index) => {
        const address = cleanLinkedInAddress(card.textContent.trim());
        if (address) {
          locations.push({
            name: businessName ? `${businessName} - Location ${index + 1}` : `Location ${index + 1}`,
            address: address,
            country: extractCountryFromAddress(address) || '',
            isHeadquarters: false
          });
          console.log(`[OS-Hub] Extracted location ${index + 1}:`, address);
        }
      });
      break;
    }
  }

  // Manual search for additional locations in org details
  if (locations.length <= 1) {
    const dtElements = document.querySelectorAll('.org-page-details dt');
    for (const dt of dtElements) {
      if (dt.textContent.toLowerCase().includes('locations') ||
          dt.textContent.toLowerCase().includes('offices')) {
        const dd = dt.nextElementSibling;
        if (dd && dd.tagName === 'DD' && dd.textContent.trim()) {
          const text = dd.textContent.trim();
          const addresses = parseMultipleAddresses(text);

          addresses.forEach((address, index) => {
            const locationName = businessName ?
              `${businessName} - Office ${index + 1}` :
              `Office ${index + 1}`;

            locations.push({
              name: locationName,
              address: address,
              country: extractCountryFromAddress(address) || '',
              isHeadquarters: false
            });
            console.log(`[OS-Hub] Extracted office ${index + 1}:`, address);
          });
          break;
        }
      }
    }
  }

  // If no specific locations found, try to extract any address-like text
  if (locations.length === 0) {
    const aboutContent = document.querySelector('.org-about-us, .about-section, [class*="about"]');
    if (aboutContent) {
      const addresses = extractAddressesFromText(aboutContent.textContent);
      addresses.forEach((address, index) => {
        const locationName = businessName ?
          `${businessName} - Location ${index + 1}` :
          `Location ${index + 1}`;

        locations.push({
          name: locationName,
          address: address,
          country: extractCountryFromAddress(address) || '',
          isHeadquarters: index === 0
        });
        console.log(`[OS-Hub] Extracted fallback location ${index + 1}:`, address);
      });
    }
  }

  // Ensure we have at least one location if we're on an about page
  if (locations.length === 0 && window.location.pathname.includes('/about/') && businessName) {
    locations.push({
      name: businessName,
      address: '', // Will need manual entry
      country: '',
      isHeadquarters: true
    });
    console.log('[OS-Hub] Added placeholder location for business:', businessName);
  }

  console.log(`[OS-Hub] Total extracted LinkedIn locations: ${locations.length}`);
  return locations;
}

// Debug function to copy LinkedIn page information to clipboard
function copyLinkedInDebugInfo() {
  const debugInfo = {
    url: window.location.href,
    businessName: extractLinkedInBusinessName(),
    timestamp: new Date().toISOString(),
    pageStructure: {
      locationCards: document.querySelectorAll('.org-location-card').length,
      orgPageDetails: document.querySelectorAll('.org-page-details').length,
      orgTopCard: document.querySelectorAll('.org-top-card-summary').length
    },
    extractedLocations: extractLinkedInLocations(),
    htmlSamples: {
      locationCardHTML: document.querySelector('.org-location-card')?.outerHTML || 'Not found',
      businessNameHTML: document.querySelector('.org-top-card-summary__title h1')?.outerHTML || 'Not found'
    }
  };

  const debugText = `
=== LinkedIn Debug Information ===
URL: ${debugInfo.url}
Business Name: ${debugInfo.businessName}
Timestamp: ${debugInfo.timestamp}

Page Structure:
- Location Cards: ${debugInfo.pageStructure.locationCards}
- Org Page Details: ${debugInfo.pageStructure.orgPageDetails}
- Org Top Card: ${debugInfo.pageStructure.orgTopCard}

Extracted Locations (${debugInfo.extractedLocations.length}):
${debugInfo.extractedLocations.map((loc, i) => `${i + 1}. ${loc.name}: ${loc.address} (${loc.country})`).join('\n')}

HTML Samples:
--- Location Card HTML ---
${debugInfo.htmlSamples.locationCardHTML}

--- Business Name HTML ---
${debugInfo.htmlSamples.businessNameHTML}

=== End Debug Information ===
`;

  // Copy to clipboard
  navigator.clipboard.writeText(debugText).then(() => {
    console.log('[OS-Hub] Debug information copied to clipboard');
    alert('LinkedIn debug information copied to clipboard!');
  }).catch(err => {
    console.error('[OS-Hub] Failed to copy debug info:', err);
    // Fallback: show in console for manual copy
    console.log('=== DEBUG INFO FOR MANUAL COPY ===');
    console.log(debugText);
    alert('Failed to copy automatically. Check console for debug information.');
  });
}

// Add global access to debug function
window.osHubCopyDebugInfo = copyLinkedInDebugInfo;

function cleanLinkedInAddress(text) {
  if (!text) return '';

  // Remove common LinkedIn artifacts
  text = text.replace(/\s+/g, ' ').trim();

  // Remove employee count info
  text = text.replace(/\d+[\s\-]*(?:employees?|workers?)/gi, '');

  // Remove follower info
  text = text.replace(/\d+[\s\-]*followers?/gi, '');

  // Remove industry info that might be concatenated
  text = text.replace(/·\s*\w+\s*industry/gi, '');

  // Look for address patterns
  const addressPatterns = [
    /\d+[^,]*(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd)[^,]*(?:,\s*[^,]+)*/gi,
    /[A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5}/g,
    /[^,]+,\s*[^,]+,\s*[A-Z]{2,}/g, // City, State, Country
    /[A-Za-z\s]+,\s*[A-Z]{2}\b/g // Simple City, ST format
  ];

  for (const pattern of addressPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }

  // If no specific pattern, but contains comma and is reasonable length
  if (text.includes(',') && text.length > 5 && text.length < 200) {
    return text;
  }

  // Accept simple city/state formats even without complex patterns
  if (/^[A-Za-z\s]+,\s*[A-Z]{2}$/.test(text.trim())) {
    return text.trim();
  }

  return '';
}

function parseMultipleAddresses(text) {
  const addresses = [];

  // Split by line breaks first
  const lines = text.split(/\n+/).map(line => line.trim()).filter(line => line.length > 0);

  for (const line of lines) {
    const cleaned = cleanLinkedInAddress(line);
    if (cleaned && cleaned.length > 10) {
      addresses.push(cleaned);
    }
  }

  // If no line breaks, try to split by common separators
  if (addresses.length <= 1) {
    const separators = [' | ', ' • ', ' / ', '  '];
    for (const separator of separators) {
      if (text.includes(separator)) {
        const parts = text.split(separator);
        for (const part of parts) {
          const cleaned = cleanLinkedInAddress(part);
          if (cleaned && cleaned.length > 10) {
            addresses.push(cleaned);
          }
        }
        break;
      }
    }
  }

  return addresses.slice(0, 5); // Cap at 5 locations max
}

function extractAddressesFromText(text) {
  const addresses = [];

  // Look for address patterns
  const addressPatterns = [
    /\d+\s+[A-Za-z\s]+(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd)[^.]*?(?:\d{5}|\w{2,}\s*\d{4,})/gi,
    /[A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5}/g
  ];

  for (const pattern of addressPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        const cleaned = cleanLinkedInAddress(match);
        if (cleaned && cleaned.length > 10 && addresses.length < 4) {
          addresses.push(cleaned);
        }
      }
    }
  }

  return addresses;
}

function showLinkedInExtractionPopup() {
  console.log('[OS-Hub] Showing LinkedIn extraction popup...');

  const locations = extractLinkedInLocations();

  if (locations.length === 0) {
    showExtractionErrorMessage();
    return;
  }

  // Create popup overlay
  const overlay = document.createElement('div');
  overlay.id = 'os-hub-linkedin-popup';
  overlay.className = 'os-hub-popup-overlay';

  // Create popup content
  const popup = document.createElement('div');
  popup.className = 'os-hub-popup-content os-hub-linkedin-popup';

  popup.innerHTML = `
    <div class="os-hub-popup-header">
      <h3>Extract LinkedIn Business Locations</h3>
      <button class="os-hub-popup-close">&times;</button>
    </div>
    <div class="os-hub-popup-body">
      <p>Found ${locations.length} location(s) for this business. Would you like to extract and submit them to Open Supply Hub?</p>

      <div class="os-hub-location-preview">
        ${locations.map((loc, index) => `
          <div class="os-hub-location-item">
            <h4>${loc.name}</h4>
            <p class="os-hub-address">${loc.address || '<em>Address not found - will need manual entry</em>'}</p>
            ${loc.country ? `<p class="os-hub-country">Country: ${loc.country}</p>` : ''}
          </div>
        `).join('')}
      </div>

      <div class="os-hub-popup-buttons">
        <button id="os-hub-linkedin-extract-yes" class="os-hub-btn os-hub-btn-primary">Extract All Locations</button>
        <button id="os-hub-linkedin-extract-no" class="os-hub-btn os-hub-btn-secondary">Cancel</button>
      </div>
    </div>
  `;

  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  // Event listeners
  const closeBtn = popup.querySelector('.os-hub-popup-close');
  const yesBtn = popup.querySelector('#os-hub-linkedin-extract-yes');
  const noBtn = popup.querySelector('#os-hub-linkedin-extract-no');

  function closePopup() {
    overlay.remove();
  }

  closeBtn.addEventListener('click', closePopup);
  noBtn.addEventListener('click', closePopup);

  yesBtn.addEventListener('click', function() {
    // Store all locations and show bulk submission interface
    storeLinkedInLocations(locations);
    closePopup();
    showLinkedInBulkSubmissionPopup(locations);
  });

  // Close on overlay click
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) {
      closePopup();
    }
  });
}

function storeLinkedInLocations(locations) {
  // Convert to our storage format
  locationDatasets = locations.map(loc => ({
    name: loc.name,
    address: loc.address,
    country: loc.country,
    productType: '',
    sector: '',
    parentCompany: ''
  }));

  detectedLocationCount = locations.length;
  currentLocationIndex = 0;

  // Update main facility data for backward compatibility
  if (locations.length > 0) {
    facilityData = { ...locationDatasets[0] };
  }

  // Save to storage
  chrome.storage.local.set({
    facilityData: facilityData,
    locationDatasets: locationDatasets,
    currentLocationIndex: currentLocationIndex,
    detectedLocationCount: detectedLocationCount
  });

  // Update context menus
  chrome.runtime.sendMessage({
    action: 'updateLocationCount',
    count: detectedLocationCount
  });

  console.log(`[OS-Hub] Stored ${detectedLocationCount} LinkedIn locations`);
}

function showLinkedInBulkSubmissionPopup(locations) {
  // Create popup overlay
  const overlay = document.createElement('div');
  overlay.id = 'os-hub-linkedin-bulk-popup';
  overlay.className = 'os-hub-popup-overlay';

  // Create popup content
  const content = document.createElement('div');
  content.className = 'os-hub-popup-content os-hub-bulk-popup';

  content.innerHTML = `
    <div class="os-hub-popup-header">
      <h3>Submit ${locations.length} Locations to Open Supply Hub</h3>
      <button class="os-hub-popup-close" aria-label="Close">&times;</button>
    </div>
    <div class="os-hub-popup-body">
      <div class="os-hub-form-section">
        <div class="os-hub-environment-section">
          <label for="os-hub-bulk-environment">Environment:</label>
          <select id="os-hub-bulk-environment">
            <option value="staging">Staging (staging.opensupplyhub.org)</option>
            <option value="production">Production (opensupplyhub.org)</option>
          </select>
          <div id="os-hub-bulk-environment-banner" class="os-hub-environment-banner">Data will be submitted to STAGING</div>
        </div>

        <div class="os-hub-api-section">
          <label for="os-hub-bulk-api-key">API Key:</label>
          <input type="password" id="os-hub-bulk-api-key" placeholder="Enter your API key">
          <div id="os-hub-bulk-api-status" class="os-hub-status"></div>
        </div>

        <div class="os-hub-bulk-locations">
          ${locations.map((loc, index) => `
            <div class="os-hub-location-form" data-index="${index}">
              <h4>Location ${index + 1}</h4>
              <div class="os-hub-form-group">
                <label>Name:</label>
                <input type="text" class="os-hub-location-name" value="${loc.name}" required>
              </div>
              <div class="os-hub-form-group">
                <label>Address:</label>
                <textarea class="os-hub-location-address" required>${loc.address}</textarea>
              </div>
              <div class="os-hub-form-group">
                <label>Country:</label>
                <input type="text" class="os-hub-location-country" value="${loc.country}" list="os-hub-bulk-country-list" placeholder="2-letter code or country name" required>
              </div>
              <div class="os-hub-form-group">
                <label>Sector (optional):</label>
                <select class="os-hub-location-sector">
                  <option value="">Select a sector (optional)</option>
                </select>
              </div>
            </div>
          `).join('')}
          <datalist id="os-hub-bulk-country-list"></datalist>
        </div>
      </div>

      <div class="os-hub-popup-buttons">
        <button type="button" class="os-hub-btn os-hub-btn-secondary" id="os-hub-bulk-cancel-btn">Cancel</button>
        <button type="button" class="os-hub-btn os-hub-btn-primary" id="os-hub-bulk-submit-btn">Submit All Locations</button>
      </div>
      <div id="os-hub-bulk-submit-status" class="os-hub-status"></div>
      <div id="os-hub-bulk-progress" class="os-hub-progress" style="display: none;">
        <div class="os-hub-progress-bar">
          <div class="os-hub-progress-fill" style="width: 0%"></div>
        </div>
        <div class="os-hub-progress-text">Submitting location 0 of ${locations.length}...</div>
      </div>
    </div>
  `;

  overlay.appendChild(content);
  document.body.appendChild(overlay);

  // Initialize the bulk submission popup
  initializeLinkedInBulkSubmissionPopup(locations);

  // Close handlers
  const closeBtn = content.querySelector('.os-hub-popup-close');
  const cancelBtn = content.querySelector('#os-hub-bulk-cancel-btn');

  function closePopup() {
    document.body.removeChild(overlay);
  }

  closeBtn.addEventListener('click', closePopup);
  cancelBtn.addEventListener('click', closePopup);

  // Close on overlay click
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) {
      closePopup();
    }
  });
}

function initializeLocationDatasets() {
  const locationCount = detectLinkedInLocations();
  detectedLocationCount = locationCount;
  
  if (locationCount <= 1) {
    // Single location - use existing behavior
    locationDatasets = [];
    return locationCount;
  }
  
  // Multiple locations - initialize datasets
  locationDatasets = [];
  for (let i = 0; i < locationCount; i++) {
    locationDatasets.push({
      name: '',
      address: '',
      country: '',
      productType: '',
      sector: '',
      parentCompany: ''
    });
  }
  
  // Notify background script to update context menus
  chrome.runtime.sendMessage({
    action: 'updateLocationCount',
    count: locationCount
  });
  
  // Save to storage
  chrome.storage.local.set({
    locationDatasets: locationDatasets,
    detectedLocationCount: locationCount,
    currentLocationIndex: 0
  });
  
  console.log(`[OS-Hub] Initialized ${locationCount} location datasets`);
  return locationCount;
}

function initializeLinkedInBulkSubmissionPopup(locations) {
  const environmentSelect = document.getElementById('os-hub-bulk-environment');
  const environmentBanner = document.getElementById('os-hub-bulk-environment-banner');
  const apiKeyInput = document.getElementById('os-hub-bulk-api-key');
  const apiStatus = document.getElementById('os-hub-bulk-api-status');
  const submitBtn = document.getElementById('os-hub-bulk-submit-btn');
  const submitStatus = document.getElementById('os-hub-bulk-submit-status');
  const progressDiv = document.getElementById('os-hub-bulk-progress');
  const progressFill = progressDiv.querySelector('.os-hub-progress-fill');
  const progressText = progressDiv.querySelector('.os-hub-progress-text');
  const countryList = document.getElementById('os-hub-bulk-country-list');

  let currentEnvironment = 'staging';
  let apiBaseUrl = osHubEnvironments.staging.baseUrl;

  // Load saved environment setting
  chrome.storage.sync.get(['environment'], function(result) {
    if (result.environment) {
      currentEnvironment = result.environment;
      environmentSelect.value = currentEnvironment;
      apiBaseUrl = osHubEnvironments[currentEnvironment].baseUrl;
      updateEnvironmentBanner();
      loadApiKey();
    } else {
      loadApiKey();
    }
  });

  function updateEnvironmentBanner() {
    environmentBanner.textContent = `Data will be submitted to ${osHubEnvironments[currentEnvironment].name}`;
    if (currentEnvironment === 'production') {
      environmentBanner.classList.add('os-hub-production');
    } else {
      environmentBanner.classList.remove('os-hub-production');
    }
  }

  function loadApiKey() {
    const keyName = `apiKey_${currentEnvironment}`;
    chrome.storage.sync.get([keyName], function(result) {
      if (result[keyName]) {
        apiKeyInput.value = result[keyName];
        apiStatus.textContent = 'API key loaded';
        apiStatus.className = 'os-hub-status os-hub-success';
      } else {
        apiKeyInput.value = '';
        apiStatus.textContent = 'No API key saved for this environment';
        apiStatus.className = 'os-hub-status os-hub-error';
      }
    });
  }

  // Environment change handler
  environmentSelect.addEventListener('change', function() {
    currentEnvironment = this.value;
    apiBaseUrl = osHubEnvironments[currentEnvironment].baseUrl;
    chrome.storage.sync.set({ environment: currentEnvironment });
    updateEnvironmentBanner();
    loadApiKey();
  });

  // Populate country datalist
  osHubCountries.forEach(country => {
    const option = document.createElement('option');
    option.value = country.alpha_2;
    option.text = `${country.name} (${country.alpha_2})`;
    countryList.appendChild(option);
  });

  // Populate sector dropdowns
  const sectorSelects = document.querySelectorAll('.os-hub-location-sector');
  sectorSelects.forEach(select => {
    osHubSectors.forEach(sector => {
      const option = document.createElement('option');
      option.value = sector.name;
      option.textContent = sector.name;
      select.appendChild(option);
    });
  });

  // Bulk submission handler
  submitBtn.addEventListener('click', async function() {
    const keyName = `apiKey_${currentEnvironment}`;
    chrome.storage.sync.get([keyName], async function(result) {
      const apiKey = apiKeyInput.value.trim() || result[keyName];

      if (!apiKey) {
        submitStatus.textContent = `Please enter your API key for ${osHubEnvironments[currentEnvironment].name}`;
        submitStatus.className = 'os-hub-status os-hub-error';
        return;
      }

      // Save API key
      const storageData = {};
      storageData[keyName] = apiKey;
      chrome.storage.sync.set(storageData);

      // Collect all location data
      const locationForms = document.querySelectorAll('.os-hub-location-form');
      const submissionData = [];

      for (const form of locationForms) {
        const name = form.querySelector('.os-hub-location-name').value.trim();
        const address = form.querySelector('.os-hub-location-address').value.trim();
        const country = form.querySelector('.os-hub-location-country').value.trim().toUpperCase();
        const sector = form.querySelector('.os-hub-location-sector').value.trim();

        if (!name || !address || !country) {
          submitStatus.textContent = 'All locations must have name, address, and country';
          submitStatus.className = 'os-hub-status os-hub-error';
          return;
        }

        const payload = {
          name: name,
          address: address,
          country: country,
          source_name: "OS Hub Chrome Extension - LinkedIn",
          source_link: window.location.href
        };

        if (sector) payload.sectors = [sector];

        submissionData.push(payload);
      }

      // Start bulk submission
      submitBtn.disabled = true;
      progressDiv.style.display = 'block';
      submitStatus.textContent = 'Starting bulk submission...';
      submitStatus.className = 'os-hub-status';

      const results = [];
      const errors = [];

      for (let i = 0; i < submissionData.length; i++) {
        const payload = submissionData[i];
        progressText.textContent = `Submitting location ${i + 1} of ${submissionData.length}...`;
        progressFill.style.width = `${((i) / submissionData.length) * 100}%`;

        try {
          const data = await makeApiRequest(apiBaseUrl + osHubApiEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Token ' + apiKey
            },
            body: JSON.stringify(payload)
          });

          results.push({
            name: payload.name,
            success: true,
            data: data
          });

          // Small delay between submissions to be nice to the API
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          console.error(`Error submitting location ${i + 1}:`, error);
          errors.push({
            name: payload.name,
            error: error.message
          });
        }
      }

      // Completion
      progressFill.style.width = '100%';
      progressText.textContent = `Completed: ${results.length} successful, ${errors.length} errors`;

      if (errors.length === 0) {
        submitStatus.textContent = `✓ All ${results.length} locations submitted successfully!`;
        submitStatus.className = 'os-hub-status os-hub-success';

        // Clear stored location data
        chrome.storage.local.remove(['facilityData', 'locationDatasets']);

        // Auto-close after success
        setTimeout(() => {
          const popup = document.getElementById('os-hub-linkedin-bulk-popup');
          if (popup) {
            document.body.removeChild(popup);
          }
        }, 3000);

      } else {
        submitStatus.textContent = `⚠ ${results.length} successful, ${errors.length} failed. Check console for details.`;
        submitStatus.className = 'os-hub-status os-hub-warning';
        console.error('Submission errors:', errors);
      }

      submitBtn.disabled = false;
    });
  });
}

// Global variable to track current URL for navigation detection
let lastLinkedInUrl = window.location.href;
let linkedInPopupShown = false;

function initializeLinkedInDetection() {
  if (!window.location.hostname.includes('linkedin.com')) {
    return;
  }

  console.log('[OS-Hub] Initializing LinkedIn location detection with navigation monitoring');

  // Set up URL change detection for single-page app navigation
  setupLinkedInNavigationDetection();

  // Check current page
  checkLinkedInPage();
}

function setupLinkedInNavigationDetection() {
  console.log('[OS-Hub] Setting up LinkedIn navigation detection...');

  // Method 1: Monitor URL changes using history API
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function() {
    originalPushState.apply(history, arguments);
    handleLinkedInNavigation();
  };

  history.replaceState = function() {
    originalReplaceState.apply(history, arguments);
    handleLinkedInNavigation();
  };

  // Method 2: Listen for popstate events (back/forward navigation)
  window.addEventListener('popstate', handleLinkedInNavigation);

  // Method 3: Monitor DOM changes for LinkedIn's dynamic content loading
  const observer = new MutationObserver((mutations) => {
    let significantChange = false;

    mutations.forEach(mutation => {
      // Check if main content areas have changed
      if (mutation.target.classList && (
          mutation.target.classList.contains('main') ||
          mutation.target.classList.contains('org-page') ||
          mutation.target.classList.contains('org-about-us') ||
          mutation.target.classList.contains('org-location-card')
        )) {
        significantChange = true;
      }
    });

    if (significantChange) {
      console.log('[OS-Hub] LinkedIn content change detected');
      setTimeout(checkLinkedInPage, 1000); // Small delay for content to settle
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
  });

  console.log('[OS-Hub] Navigation detection setup complete');
}

function handleLinkedInNavigation() {
  console.log('[OS-Hub] LinkedIn navigation detected');

  // Small delay to let the page content update
  setTimeout(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastLinkedInUrl) {
      console.log(`[OS-Hub] URL changed from ${lastLinkedInUrl} to ${currentUrl}`);
      lastLinkedInUrl = currentUrl;

      // Reset popup state for new page
      linkedInPopupShown = false;

      // Check the new page
      checkLinkedInPage();
    }
  }, 500);
}

function checkLinkedInPage() {
  if (!window.location.hostname.includes('linkedin.com')) {
    return;
  }

  console.log('[OS-Hub] Checking LinkedIn page:', window.location.pathname);

  // Show LinkedIn extraction popup if on About page
  if (window.location.pathname.includes('/about/')) {
    console.log('[OS-Hub] LinkedIn About page detected, checking for extraction opportunity...');

    // Try multiple times as LinkedIn loads content dynamically
    const attempts = [1000, 3000, 6000, 10000];

    attempts.forEach((delay, index) => {
      setTimeout(() => {
        console.log(`[OS-Hub] LinkedIn extraction attempt ${index + 1} for ${window.location.pathname}`);
        const locations = extractLinkedInLocations();

        console.log(`[OS-Hub] Attempt ${index + 1}: Found ${locations.length} locations`);

        // Show popup on ANY successful detection (not just first attempt)
        if (locations.length > 0 && !linkedInPopupShown) {
          console.log('[OS-Hub] Showing LinkedIn extraction popup');
          showLinkedInExtractionPopup();
          linkedInPopupShown = true;
        }

        // Always update location count for context menus
        initializeLocationDatasets();
      }, delay);
    });

    // Also detect when user scrolls or interacts with page (content might load)
    let hasScrollDetected = false;
    const scrollHandler = () => {
      if (!hasScrollDetected) {
        hasScrollDetected = true;
        setTimeout(() => {
          console.log('[OS-Hub] LinkedIn location detection on scroll');
          const locations = extractLinkedInLocations();
          if (locations.length > 0 && !linkedInPopupShown) {
            console.log('[OS-Hub] Showing LinkedIn extraction popup (scroll trigger)');
            showLinkedInExtractionPopup();
            linkedInPopupShown = true;
          }
          initializeLocationDatasets();
        }, 1000);
      }
    };

    window.addEventListener('scroll', scrollHandler, { once: true });

    // Also try on click events (user interaction might trigger content load)
    const clickHandler = () => {
      setTimeout(() => {
        console.log('[OS-Hub] LinkedIn location detection on click');
        const locations = extractLinkedInLocations();
        if (locations.length > 0 && !linkedInPopupShown) {
          console.log('[OS-Hub] Showing LinkedIn extraction popup (click trigger)');
          showLinkedInExtractionPopup();
          linkedInPopupShown = true;
        }
        initializeLocationDatasets();
      }, 500);
    };

    document.addEventListener('click', clickHandler, { once: true });

  } else {
    // Not on About page, just do basic detection for context menus
    setTimeout(() => {
      initializeLocationDatasets();
    }, 2000);
  }
}

// Test function to simulate Point Reyes scenario (for debugging)
window.osHubTestMultipleLocations = function() {
  console.log('[OS-Hub] Setting up test data for Point Reyes Farmstead Cheese');

  // Simulate 2 locations detected
  detectedLocationCount = 2;

  // Create test location datasets
  locationDatasets = [
    {
      name: 'Point Reyes Farmstead Cheese Company - Main Facility',
      address: '14700 Red Hill Road, Point Reyes Station, CA 94956',
      country: 'US',
      productType: 'Food & Beverages',
      sector: 'Food & Beverage',
      parentCompany: 'Point Reyes Farmstead Cheese Company'
    },
    {
      name: 'Point Reyes Farmstead Cheese Company - Retail Store',
      address: '80 4th Street, Point Reyes Station, CA 94956',
      country: 'US',
      productType: 'Food & Beverages',
      sector: 'Food & Beverage',
      parentCompany: 'Point Reyes Farmstead Cheese Company'
    }
  ];

  currentLocationIndex = 0;

  // Update storage
  chrome.storage.local.set({
    locationDatasets: locationDatasets,
    facilityData: locationDatasets[0], // Backward compatibility
    detectedLocationCount: detectedLocationCount,
    currentLocationIndex: currentLocationIndex
  });

  // Update context menus
  chrome.runtime.sendMessage({
    action: 'updateLocationCount',
    count: detectedLocationCount
  });

  console.log(`[OS-Hub] Test setup complete: ${detectedLocationCount} locations, context menus updated`);
  console.log('[OS-Hub] Test locations:', locationDatasets);

  return detectedLocationCount;
};

// Manual trigger function for testing LinkedIn pages
window.osHubManualLinkedInTest = function() {
  console.log('[OS-Hub] Manual LinkedIn extraction test triggered');
  console.log('[OS-Hub] Current URL:', window.location.href);
  console.log('[OS-Hub] Current pathname:', window.location.pathname);

  // Force LinkedIn detection
  if (!window.location.hostname.includes('linkedin.com')) {
    console.log('[OS-Hub] ⚠️ Not on LinkedIn - this test may not work correctly');
  }

  // Try business name extraction
  console.log('[OS-Hub] Testing business name extraction...');
  const businessName = extractLinkedInBusinessName();
  console.log('[OS-Hub] Business name result:', businessName);

  // Try location extraction
  console.log('[OS-Hub] Testing location extraction...');
  const locations = extractLinkedInLocations();
  console.log('[OS-Hub] Extracted locations:', locations);

  // Show popup if locations found
  if (locations.length > 0) {
    console.log('[OS-Hub] Showing extraction popup...');
    showLinkedInExtractionPopup();
    return {
      success: true,
      businessName: businessName,
      locations: locations,
      message: 'LinkedIn extraction successful!'
    };
  } else {
    console.log('[OS-Hub] No locations found - popup not shown');
    return {
      success: false,
      businessName: businessName,
      locations: locations,
      message: 'No locations detected. Try scrolling down or waiting for page to fully load.'
    };
  }
};

// Single location test function for companies with minimal location data
window.osHubTestSingleLocation = function() {
  console.log('[OS-Hub] Testing single location detection');

  const businessName = extractLinkedInBusinessName();
  console.log('[OS-Hub] Business name:', businessName);

  if (businessName) {
    // Create a single location with just the business name
    const singleLocation = {
      name: businessName,
      address: '', // Will be filled manually
      country: '',
      isHeadquarters: true
    };

    console.log('[OS-Hub] Created single location:', singleLocation);

    // Store and show popup
    storeLinkedInLocations([singleLocation]);
    showLinkedInExtractionPopup();

    return {
      success: true,
      location: singleLocation,
      message: 'Single location created successfully!'
    };
  } else {
    return {
      success: false,
      message: 'Could not extract business name from page'
    };
  }
};

// Start Facebook and LinkedIn detection
console.log('[OS-Hub] Content script loaded');
initializeFacebookDetection();
initializeLinkedInDetection();
