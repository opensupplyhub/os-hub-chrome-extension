// Global variables to store production location data
let facilityData = {
  name: '',
  address: '',
  country: '',
  productType: '',
  sector: '',
  parentCompany: ''
};

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
    
    // Save the selected text to the appropriate field
    if (field && selection) {
      facilityData[field] = selection;
      
      // Save to local storage for the popup
      chrome.storage.local.set({facilityData: facilityData});
      
      // Provide visual feedback
      highlightSelectedText(field);
      sendResponse({success: true, field: field, value: selection});
    } else {
      sendResponse({success: false, error: 'No selection or invalid field'});
    }
  }
  return true; // Keep the message channel open for async response
});

// Function to highlight selected text
function highlightSelectedText(field) {
  const selection = window.getSelection();
  
  if (selection.rangeCount > 0) {
    // Create a new range to avoid modifying the original selection
    const range = selection.getRangeAt(0).cloneRange();
    
    // Create a span element for highlighting
    const highlightSpan = document.createElement('span');
    highlightSpan.className = 'os-hub-highlight';
    
    // Add specific class based on the field type
    if (field) {
      highlightSpan.classList.add(`os-hub-${field}`);
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
      
      // Show success message
      showExtractionSuccessMessage(extractedData);
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

// Start Facebook detection
console.log('[OS-Hub] Content script loaded');
initializeFacebookDetection();
