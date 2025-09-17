document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const environmentSelect = document.getElementById('environment');
  const environmentBanner = document.getElementById('environment-banner');
  const apiKeyInput = document.getElementById('api-key');
  const saveApiKeyBtn = document.getElementById('save-api-key');
  const apiStatus = document.getElementById('api-status');
  const facilityNameInput = document.getElementById('facility-name');
  const facilityAddressInput = document.getElementById('facility-address');
  const facilityCountryInput = document.getElementById('facility-country');
  const countryList = document.getElementById('country-list');
  const facilityProductTypeSelect = document.getElementById('facility-product-type');
  const facilitySectorSelect = document.getElementById('facility-sector');
  const facilityParentCompanyInput = document.getElementById('facility-parent-company');
  const parentCompanySuggestions = document.getElementById('parent-company-suggestions');
  const submitFacilityBtn = document.getElementById('submit-facility');
  const submitStatus = document.getElementById('submit-status');
  
  // Multi-location elements
  const locationSelector = document.getElementById('location-selector');
  const locationSelectorGroup = document.getElementById('location-selector-group');
  const locationCountInfo = document.getElementById('location-count-info');

  // Environment configuration
  const environments = {
    staging: {
      baseUrl: 'https://staging.opensupplyhub.org/api',
      name: 'STAGING'
    },
    production: {
      baseUrl: 'https://opensupplyhub.org/api',
      name: 'PRODUCTION'
    }
  };
  
  // Current environment settings
  let currentEnvironment = 'staging';
  let API_BASE_URL = environments.staging.baseUrl;
  
  // Multi-location data
  let locationDatasets = [];
  let currentLocationIndex = 0;
  let detectedLocationCount = 0;
  const API_ENDPOINT = '/v1/production-locations/';
  const PARENT_COMPANIES_ENDPOINT = '/v1/parent-companies/';
  
  // Update the environment banner
  function updateEnvironmentBanner() {
    environmentBanner.textContent = `Data will be submitted to ${environments[currentEnvironment].name}`;
    if (currentEnvironment === 'production') {
      environmentBanner.classList.add('production');
    } else {
      environmentBanner.classList.remove('production');
    }
  }

  // Load saved environment setting
  chrome.storage.sync.get(['environment'], function(result) {
    if (result.environment) {
      currentEnvironment = result.environment;
      environmentSelect.value = currentEnvironment;
      API_BASE_URL = environments[currentEnvironment].baseUrl;
      updateEnvironmentBanner();
      
      // Load the appropriate API key for the current environment
      loadApiKey();
    } else {
      // Default to staging if no environment is saved
      chrome.storage.sync.set({ environment: 'staging' });
      loadApiKey();
    }
  });
  
  // Function to load the API key for the current environment
  function loadApiKey() {
    const keyName = `apiKey_${currentEnvironment}`;
    chrome.storage.sync.get([keyName], function(result) {
      if (result[keyName]) {
        apiKeyInput.value = result[keyName];
        apiStatus.textContent = 'API key is saved';
        apiStatus.className = 'status success';
      } else {
        apiKeyInput.value = '';
        apiStatus.textContent = '';
      }
    });
  }
  
  // Listen for environment changes
  environmentSelect.addEventListener('change', function() {
    currentEnvironment = this.value;
    API_BASE_URL = environments[currentEnvironment].baseUrl;
    
    // Save the selected environment
    chrome.storage.sync.set({ environment: currentEnvironment });
    
    // Update the banner
    updateEnvironmentBanner();
    
    // Load the API key for the selected environment
    loadApiKey();
  });
  
  // Hard-coded country codes based on ISO 3166-1 alpha-2
  const countries = [
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
  
  // Hard-coded sectors based on Open Supply Hub data
  const sectors = [
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
  
  // Hard-coded product types based on Open Supply Hub data
  const productTypes = [
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
  
  // Populate country datalist
  countries.forEach(country => {
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
      const country = countries.find(c => c.alpha_2 === value);
      if (country) {
        // Display the full country name with the code
        this.value = value;
        this.setAttribute('data-selected-country', country.name);
      }
    } else {
      // Check if the input matches a country name
      const country = countries.find(c => c.name.toUpperCase() === value.toUpperCase());
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
      // Check if it's a valid country code
      const country = countries.find(c => c.alpha_2 === value);
      if (!country) {
        // Try to find by name
        const countryByName = countries.find(c => c.name.toUpperCase() === value.toUpperCase());
        if (countryByName) {
          this.value = countryByName.alpha_2;
          this.setAttribute('data-selected-country', countryByName.name);
        } else {
          // Invalid input
          this.setCustomValidity('Please select a valid country code');
          return;
        }
      }
      this.setCustomValidity('');
    }
  });
  
  // Populate sector dropdown
  sectors.forEach(sector => {
    const option = document.createElement('option');
    option.value = sector.name;
    option.textContent = sector.name;
    facilitySectorSelect.appendChild(option);
  });
  
  // Populate product type dropdown
  productTypes.forEach(productType => {
    const option = document.createElement('option');
    option.value = productType.name;
    option.textContent = productType.name;
    facilityProductTypeSelect.appendChild(option);
  });
  
  // Parent company search functionality
  let selectedParentCompany = null;
  
  facilityParentCompanyInput.addEventListener('input', function() {
    const query = this.value.trim();
    
    if (query.length < 2) {
      parentCompanySuggestions.style.display = 'none';
      selectedParentCompany = null;
      return;
    }
    
    const keyName = `apiKey_${currentEnvironment}`;
    chrome.storage.sync.get([keyName], function(result) {
      if (!result[keyName]) return;
      
      fetch(API_BASE_URL + PARENT_COMPANIES_ENDPOINT + '?name=' + encodeURIComponent(query) + '&size=10', {
        headers: {
          'Authorization': 'Token ' + result[keyName]
        }
      })
      .then(response => response.json())
      .then(companies => {
        parentCompanySuggestions.innerHTML = '';
        
        if (companies.length === 0) {
          parentCompanySuggestions.style.display = 'none';
          return;
        }
        
        companies.forEach(company => {
          const item = document.createElement('div');
          item.className = 'suggestion-item';
          item.textContent = company.name;
          item.addEventListener('click', function() {
            facilityParentCompanyInput.value = company.name;
            selectedParentCompany = company.name;
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

  // Load any facility data from the content script
  chrome.storage.local.get(['facilityData', 'locationDatasets', 'detectedLocationCount', 'currentLocationIndex', 'sourceUrl'], function(result) {
    // Handle multiple locations if available
    if (result.locationDatasets && result.locationDatasets.length > 0) {
      locationDatasets = result.locationDatasets;
      detectedLocationCount = result.detectedLocationCount || locationDatasets.length;
      currentLocationIndex = result.currentLocationIndex || 0;
      
      setupLocationSelector();
      loadLocationData(currentLocationIndex);
    } else if (result.facilityData) {
      // Single location fallback
      const data = result.facilityData;
      if (data.name) facilityNameInput.value = data.name;
      if (data.address) facilityAddressInput.value = data.address;
      if (data.country) {
        // Set the country input value
        const countryCode = data.country.toUpperCase();
        facilityCountryInput.value = countryCode;
        
        // Find the country name for the code
        const country = countries.find(c => c.alpha_2 === countryCode);
        if (country) {
          facilityCountryInput.setAttribute('data-selected-country', country.name);
        }
      }
      if (data.productType) {
        // Set the product type dropdown value
        for (let i = 0; i < facilityProductTypeSelect.options.length; i++) {
          if (facilityProductTypeSelect.options[i].value === data.productType) {
            facilityProductTypeSelect.selectedIndex = i;
            break;
          }
        }
      }
      if (data.sector) {
        // Set the sector dropdown value
        for (let i = 0; i < facilitySectorSelect.options.length; i++) {
          if (facilitySectorSelect.options[i].value === data.sector) {
            facilitySectorSelect.selectedIndex = i;
            break;
          }
        }
      }
      if (data.parentCompany) {
        facilityParentCompanyInput.value = data.parentCompany;
        selectedParentCompany = data.parentCompany;
      }
    }
  });

  // Save API key
  saveApiKeyBtn.addEventListener('click', function() {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      apiStatus.textContent = 'Please enter an API key';
      apiStatus.className = 'status error';
      return;
    }
    
    // Save the API key for the current environment
    const keyName = `apiKey_${currentEnvironment}`;
    const storageData = {};
    storageData[keyName] = apiKey;
    
    chrome.storage.sync.set(storageData, function() {
      apiStatus.textContent = `API key saved for ${environments[currentEnvironment].name}!`;
      apiStatus.className = 'status success';
      
      // Clear status message after 3 seconds
      setTimeout(() => {
        apiStatus.textContent = '';
      }, 3000);
    });
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
      submitStatus.className = 'status error';
      return;
    }
    
    // Get API key for the current environment
    const keyName = `apiKey_${currentEnvironment}`;
    chrome.storage.sync.get([keyName], function(result) {
      if (!result[keyName]) {
        submitStatus.textContent = `Please save your API key for ${environments[currentEnvironment].name} first`;
        submitStatus.className = 'status error';
        return;
      }
      
      submitStatus.textContent = 'Submitting...';
      
      // Get the current tab's URL to use as source_link
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentUrl = tabs[0]?.url || '';
        
        // Prepare payload for Open Supply Hub API based on OpenAPI spec
        const payload = {
          name: name,
          address: address,
          country: country,
          source_name: "OS Hub Chrome Extension",
          source_link: currentUrl
        };
        
        // Add optional fields if provided
        if (productType) payload.product_types = [productType];
        if (sector) payload.sectors = [sector];
        if (parentCompany) payload.parent_companies = [parentCompany];
      
        // Make API request to Open Supply Hub
        fetch(API_BASE_URL + API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Token ' + result[keyName]
        },
        body: JSON.stringify(payload)
        })
        .then(response => {
        if (!response.ok) {
          return response.json().then(errorData => {
            throw new Error(errorData.detail || `HTTP error ${response.status}`);
          });
        }
        return response.json();
        })
        .then(data => {
        submitStatus.textContent = 'Location submitted successfully!';
        submitStatus.className = 'status success';
        
        // Clear form after successful submission
        facilityNameInput.value = '';
        facilityAddressInput.value = '';
        facilityCountryInput.value = '';
        facilityProductTypeSelect.selectedIndex = 0;
        facilitySectorSelect.selectedIndex = 0;
        facilityParentCompanyInput.value = '';
        selectedParentCompany = null;
        
        // Clear local storage
        chrome.storage.local.remove(['facilityData']);
        
        // Show moderation ID if available
        if (data.moderation_id) {
          submitStatus.textContent += ` Moderation ID: ${data.moderation_id}`;
        }
        
        // Show OS ID if available
        if (data.os_id) {
          submitStatus.textContent += ` OS ID: ${data.os_id}`;
        }
        })
        .catch(error => {
          submitStatus.textContent = `Error: ${error.message}`;
          submitStatus.className = 'status error';
        });
      });
    });
  });

  // Function to setup location selector
  function setupLocationSelector() {
    if (locationDatasets.length <= 1) {
      locationSelectorGroup.style.display = 'none';
      return;
    }

    locationSelectorGroup.style.display = 'block';
    locationCountInfo.textContent = `${detectedLocationCount} locations detected`;
    
    // Clear existing options
    locationSelector.innerHTML = '';
    
    // Add options for each location
    locationDatasets.forEach((location, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = index === 0 ? 'Headquarters/Location 1' : `Location ${index + 1}`;
      locationSelector.appendChild(option);
    });
    
    // Set current selection
    locationSelector.value = currentLocationIndex;
    
    // Add change event listener
    locationSelector.addEventListener('change', function() {
      // Save current form data before switching
      saveCurrentLocationData();
      
      // Switch to new location
      currentLocationIndex = parseInt(this.value);
      loadLocationData(currentLocationIndex);
      
      // Update storage
      chrome.storage.local.set({
        currentLocationIndex: currentLocationIndex
      });
    });
  }

  // Function to load data for a specific location
  function loadLocationData(locationIndex) {
    if (!locationDatasets[locationIndex]) return;
    
    const data = locationDatasets[locationIndex];
    facilityNameInput.value = data.name || '';
    facilityAddressInput.value = data.address || '';
    
    if (data.country) {
      facilityCountryInput.value = data.country;
    } else {
      facilityCountryInput.value = '';
    }
    
    // Set product type
    if (data.productType) {
      for (let i = 0; i < facilityProductTypeSelect.options.length; i++) {
        if (facilityProductTypeSelect.options[i].value === data.productType) {
          facilityProductTypeSelect.selectedIndex = i;
          break;
        }
      }
    } else {
      facilityProductTypeSelect.selectedIndex = 0;
    }
    
    // Set sector
    if (data.sector) {
      for (let i = 0; i < facilitySectorSelect.options.length; i++) {
        if (facilitySectorSelect.options[i].value === data.sector) {
          facilitySectorSelect.selectedIndex = i;
          break;
        }
      }
    } else {
      facilitySectorSelect.selectedIndex = 0;
    }
    
    facilityParentCompanyInput.value = data.parentCompany || '';
  }

  // Function to save current form data to location dataset
  function saveCurrentLocationData() {
    if (locationDatasets.length === 0) return;
    
    locationDatasets[currentLocationIndex] = {
      name: facilityNameInput.value.trim(),
      address: facilityAddressInput.value.trim(),
      country: facilityCountryInput.value.trim(),
      productType: facilityProductTypeSelect.value,
      sector: facilitySectorSelect.value,
      parentCompany: facilityParentCompanyInput.value.trim()
    };
    
    // Also update the legacy facilityData if this is location 0
    if (currentLocationIndex === 0) {
      chrome.storage.local.set({
        facilityData: locationDatasets[0],
        locationDatasets: locationDatasets
      });
    } else {
      chrome.storage.local.set({
        locationDatasets: locationDatasets
      });
    }
  }

  // Add event listeners to auto-save data when form fields change
  [facilityNameInput, facilityAddressInput, facilityCountryInput, 
   facilityProductTypeSelect, facilitySectorSelect, facilityParentCompanyInput].forEach(element => {
    element.addEventListener('change', saveCurrentLocationData);
    element.addEventListener('input', saveCurrentLocationData);
  });
});