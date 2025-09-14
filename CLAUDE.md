# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

This is a Chrome extension built with standard web technologies - no build system is required.

### Testing the Extension
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select this directory
4. The extension will be loaded and can be tested immediately

### Reloading After Changes
- After making code changes, click the reload button on the extension card in `chrome://extensions/`
- No build or compilation steps are necessary

## Architecture

This Chrome extension allows users to highlight and submit production location data to the Open Supply Hub API.

### Core Components

**manifest.json** - Chrome Extension Manifest V3 configuration
- Defines permissions: activeTab, storage, contextMenus
- Specifies content scripts and background service worker
- References popup.html for the extension UI

**background.js** - Service Worker (background script)
- Creates context menu items for capturing different data fields (name, address, country, etc.)
- Handles context menu clicks and messages between content scripts
- Manages communication between popup and content scripts

**content.js** - Content Script (injected into web pages)
- Handles text selection and highlighting functionality
- Stores captured data in Chrome local storage
- Listens for messages from background script to save selected text to specific fields

**popup.js** - Extension Popup Logic
- Manages the main UI for data entry and submission
- Handles API key storage (separate keys for staging/production environments)
- Contains hardcoded country codes, sectors, and product types based on Open Supply Hub data
- Implements parent company search with autocomplete
- Submits data to Open Supply Hub REST API v1

**popup.html** - Extension Popup UI
- Form interface for reviewing and editing captured data
- Environment switcher (staging vs production)
- API key management interface

**content.css** - Styles for content script elements
- CSS for highlighting selected text on web pages

### Data Flow

1. User highlights text on any webpage
2. Right-click context menu allows saving text to specific fields (name, address, country, etc.)
3. Data is stored in Chrome local storage
4. User opens popup to review, edit, and submit data
5. Data is sent to Open Supply Hub API with authentication

### API Integration

- **Staging Environment**: `https://staging.opensupplyhub.org/api`
- **Production Environment**: `https://opensupplyhub.org/api`
- **Main Endpoint**: `/v1/production-locations/` (POST)
- **Parent Company Search**: `/v1/parent-companies/` (GET)
- Authentication via Token-based headers

### Key Features

- **Context Menu Integration**: Right-click to save selected text to specific fields
- **Multi-Environment Support**: Separate API keys and endpoints for staging/production
- **Data Validation**: Country code validation and standardized dropdowns for sectors/product types
- **Visual Feedback**: Highlights selected text temporarily when captured
- **Secure Storage**: API keys stored in Chrome's secure storage system