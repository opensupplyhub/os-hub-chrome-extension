// Global variables to store production location data
let facilityData = {
  name: '',
  address: '',
  country: '',
  productType: '',
  sector: '',
  parentCompany: ''
};

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
