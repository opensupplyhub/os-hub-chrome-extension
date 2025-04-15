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

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(function(info, tab) {
  if (info.menuItemId.startsWith('os-hub-') && info.menuItemId !== 'os-hub-menu') {
    // Extract the field name from the menu item ID
    const field = info.menuItemId.replace('os-hub-', '');
    
    // Send message to content script to save the selected text
    chrome.tabs.sendMessage(tab.id, {
      action: 'saveFacilityData',
      field: field
    });
  }
});
