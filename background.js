// Create context menu items when the extension is installed
chrome.runtime.onInstalled.addListener(function() {
  // Create parent menu item
  chrome.contextMenus.create({
    id: 'os-hub-menu',
    title: 'Save to Open Supply Hub',
    contexts: ['selection']
  });
  
  // Create child menu items for each field
  chrome.contextMenus.create({
    id: 'os-hub-name',
    parentId: 'os-hub-menu',
    title: 'Save as Location Name',
    contexts: ['selection']
  });
  
  chrome.contextMenus.create({
    id: 'os-hub-address',
    parentId: 'os-hub-menu',
    title: 'Save as Location Address',
    contexts: ['selection']
  });
  
  chrome.contextMenus.create({
    id: 'os-hub-country',
    parentId: 'os-hub-menu',
    title: 'Save as Location Country',
    contexts: ['selection']
  });
  
  chrome.contextMenus.create({
    id: 'os-hub-productType',
    parentId: 'os-hub-menu',
    title: 'Save as Product Type',
    contexts: ['selection']
  });
  
  chrome.contextMenus.create({
    id: 'os-hub-sector',
    parentId: 'os-hub-menu',
    title: 'Save as Sector',
    contexts: ['selection']
  });
  
  chrome.contextMenus.create({
    id: 'os-hub-parentCompany',
    parentId: 'os-hub-menu',
    title: 'Save as Parent Company',
    contexts: ['selection']
  });
});

// Function to update context menus based on location count
function updateContextMenusForLocations(locationCount) {
  console.log(`[OS-Hub Background] Updating context menus for ${locationCount} locations`);
  
  // Remove all existing menus first to avoid duplicates
  chrome.contextMenus.removeAll(function() {
    const fields = [
      { id: 'name', title: 'Location Name' },
      { id: 'address', title: 'Location Address' },
      { id: 'country', title: 'Location Country' },
      { id: 'productType', title: 'Product Type' },
      { id: 'sector', title: 'Sector' },
      { id: 'parentCompany', title: 'Parent Company' }
    ];

    if (locationCount <= 1) {
      // Single location - use original menu structure
      chrome.contextMenus.create({
        id: 'os-hub-menu',
        title: 'Save to Open Supply Hub',
        contexts: ['selection']
      });

      fields.forEach(field => {
        chrome.contextMenus.create({
          id: `os-hub-${field.id}`,
          parentId: 'os-hub-menu',
          title: `Save as ${field.title}`,
          contexts: ['selection']
        });
      });
    } else {
      // Multiple locations - create hierarchical menu
      chrome.contextMenus.create({
        id: 'os-hub-menu',
        title: `Save to Open Supply Hub (${locationCount} locations detected)`,
        contexts: ['selection']
      });

      // Create location submenus
      for (let i = 0; i < locationCount; i++) {
        const locationTitle = i === 0 ? 'Headquarters/Location 1' : `Location ${i + 1}`;
        
        // Create location submenu
        chrome.contextMenus.create({
          id: `os-hub-location-${i}`,
          parentId: 'os-hub-menu',
          title: locationTitle,
          contexts: ['selection']
        });

        // Create field options for this location
        fields.forEach(field => {
          chrome.contextMenus.create({
            id: `os-hub-${field.id}-loc-${i}`,
            parentId: `os-hub-location-${i}`,
            title: `Save as ${field.title}`,
            contexts: ['selection']
          });
        });
      }
    }
    
    console.log(`[OS-Hub Background] Context menus updated for ${locationCount} locations`);
  });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(function(info, tab) {
  if (info.menuItemId.startsWith('os-hub-') && info.menuItemId !== 'os-hub-menu' && !info.menuItemId.startsWith('os-hub-location-')) {
    let field, locationIndex = 0;
    
    // Parse field name and location index from menu item ID
    if (info.menuItemId.includes('-loc-')) {
      // Format: os-hub-field-loc-N
      const parts = info.menuItemId.split('-loc-');
      field = parts[0].replace('os-hub-', '');
      locationIndex = parseInt(parts[1]) || 0;
    } else {
      // Legacy format: os-hub-field
      field = info.menuItemId.replace('os-hub-', '');
    }
    
    // Send message to content script to save the selected text
    chrome.tabs.sendMessage(tab.id, {
      action: 'saveFacilityData',
      field: field,
      locationIndex: locationIndex
    });
  }
});

// Handle location count updates and create dynamic context menus
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateLocationCount') {
    updateContextMenusForLocations(request.count);
    sendResponse({success: true});
    return true;
  } else if (request.action === 'makeApiRequest') {
    // Handle API requests from content script
    fetch(request.url, {
      method: request.method || 'GET',
      headers: request.headers || {},
      body: request.body || undefined
    })
    .then(response => {
      if (!response.ok) {
        return response.json().then(errorData => {
          throw new Error(errorData.detail || `HTTP error ${response.status}`);
        }).catch(() => {
          throw new Error(`HTTP error ${response.status}`);
        });
      }
      return response.json();
    })
    .then(data => {
      sendResponse({ success: true, data: data });
    })
    .catch(error => {
      sendResponse({ success: false, error: error.message });
    });

    // Return true to indicate we'll respond asynchronously
    return true;
  } else if (request.action === 'getActiveTab') {
    // Get current active tab info for debugging/testing
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs.length > 0) {
        sendResponse({
          success: true,
          tab: {
            url: tabs[0].url,
            title: tabs[0].title,
            id: tabs[0].id
          }
        });
      } else {
        sendResponse({success: false, error: 'No active tab found'});
      }
    });
    return true;
  } else if (request.action === 'showLinkedInExtraction') {
    // Trigger LinkedIn extraction popup manually (for testing)
    chrome.tabs.sendMessage(sender.tab.id, {
      action: 'showLinkedInExtractionPopup'
    }, function(response) {
      sendResponse(response || {success: true});
    });
    return true;
  }
});

// Handle tab updates to detect LinkedIn About pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only act when the page has finished loading
  if (changeInfo.status === 'complete' && tab.url) {
    if (tab.url.includes('linkedin.com') && tab.url.includes('/about/')) {
      console.log('[OS-Hub Background] LinkedIn About page loaded:', tab.url);

      // Small delay to ensure content script has initialized
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, {
          action: 'linkedInAboutPageLoaded'
        }, function(response) {
          if (chrome.runtime.lastError) {
            console.log('[OS-Hub Background] Content script not ready yet');
          }
        });
      }, 1000);
    }
  }
});

// Add debugging function for testing
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'testLinkedInExtraction') {
    // Test function to manually trigger LinkedIn extraction
    const testCompanyData = {
      name: 'Test Company Inc.',
      locations: [
        {
          name: 'Test Company Inc. - Headquarters',
          address: '123 Test Street, Test City, CA 90210',
          country: 'US'
        },
        {
          name: 'Test Company Inc. - Manufacturing',
          address: '456 Factory Road, Industrial City, TX 75201',
          country: 'US'
        }
      ]
    };

    console.log('[OS-Hub Background] Test LinkedIn extraction triggered', testCompanyData);
    sendResponse({success: true, testData: testCompanyData});
    return true;
  }
});
