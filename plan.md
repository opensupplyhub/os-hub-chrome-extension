# Docker-based Playwright Testing Setup Plan

## Overview
Set up a Docker-based Playwright testing environment for the Chrome extension to test the multi-location functionality on LinkedIn pages using modern Docker practices and the latest Playwright features.

## Current State Analysis
- Chrome Extension (Manifest V3) with multi-location LinkedIn support
- No existing package.json or test infrastructure
- Need containerized testing without local Playwright installation

## Implementation Plan

### Phase 1: Project Foundation
1. **Create package.json**
   ```json
   {
     "name": "os-hub-chrome-tests",
     "version": "1.0.0", 
     "type": "module",
     "scripts": {
       "test": "playwright test",
       "test:docker": "docker compose run --rm playwright npm run test",
       "test:headed": "docker compose run --rm -e HEADED=true playwright npm run test"
     },
     "devDependencies": {
       "@playwright/test": "^1.40.0"
     }
   }
   ```

2. **Docker Configuration (Modern Multi-stage)**
   - Use official `mcr.microsoft.com/playwright:v1.40.0-jammy` image
   - Multi-stage build for optimization
   - Non-root user setup for security
   - Proper layer caching

### Phase 2: Docker Setup (Latest Practices)

1. **Dockerfile**
   ```dockerfile
   FROM mcr.microsoft.com/playwright:v1.40.0-jammy

   WORKDIR /app

   # Copy package files first for better caching
   COPY package*.json ./
   RUN npm ci --only=dev

   # Copy extension and test files
   COPY . .

   # Create non-root user
   USER pwuser

   # Install browsers (already included in base image)
   # RUN npx playwright install chromium

   CMD ["npm", "run", "test"]
   ```

2. **docker-compose.yml (Latest v3.8+ syntax)**
   ```yaml
   version: '3.8'
   services:
     playwright:
       build: .
       volumes:
         - .:/app:ro
         - ./test-results:/app/test-results
         - ./playwright-report:/app/playwright-report
       environment:
         - CI=true
         - HEADED=${HEADED:-false}
       networks:
         - test-network
     
   networks:
     test-network:
       driver: bridge
   
   volumes:
     test-results:
     playwright-report:
   ```

### Phase 3: Playwright Configuration

1. **playwright.config.js (Modern ESM)**
   ```javascript
   import { defineConfig, devices } from '@playwright/test';
   
   export default defineConfig({
     testDir: './tests',
     timeout: 30000,
     retries: process.env.CI ? 2 : 0,
     use: {
       headless: process.env.HEADED !== 'true',
       viewport: { width: 1280, height: 720 },
       actionTimeout: 10000,
       trace: 'on-first-retry',
       screenshot: 'only-on-failure'
     },
     projects: [
       {
         name: 'chrome-extension',
         use: {
           ...devices['Desktop Chrome'],
           channel: 'chrome'
         }
       }
     ],
     outputDir: 'test-results/',
     reporter: [
       ['html'],
       ['json', { outputFile: 'test-results/results.json' }]
     ]
   });
   ```

### Phase 4: Test Infrastructure

1. **Extension Loader Helper**
   ```javascript
   // tests/helpers/extension-loader.js
   import { chromium } from '@playwright/test';
   import path from 'path';
   
   export async function loadExtension() {
     const extensionPath = path.resolve('./');
     const context = await chromium.launchPersistentContext('', {
       headless: process.env.HEADED !== 'true',
       args: [
         `--disable-extensions-except=${extensionPath}`,
         `--load-extension=${extensionPath}`,
         '--no-sandbox'
       ]
     });
     return context;
   }
   ```

2. **Core Test Structure**
   ```javascript
   // tests/multi-location.spec.js
   import { test, expect } from '@playwright/test';
   import { loadExtension } from './helpers/extension-loader.js';
   
   test.describe('Multi-location LinkedIn Detection', () => {
     test('detects multiple locations on Point Reyes page', async () => {
       const context = await loadExtension();
       const page = await context.newPage();
       
       await page.goto('https://www.linkedin.com/company/point-reyes-farmstead-cheese-co/about/');
       
       // Test location detection
       const locationCount = await page.evaluate(() => {
         return window.osHubTestMultipleLocations();
       });
       
       expect(locationCount).toBeGreaterThan(1);
     });
   });
   ```

### Phase 5: Advanced Docker Features

1. **Build Optimization**
   - Use `.dockerignore` for faster builds
   - Multi-stage builds for smaller images
   - BuildKit features for parallel building

2. **Health Checks & Monitoring**
   ```dockerfile
   HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
     CMD node --version || exit 1
   ```

3. **Security Hardening**
   - Non-root user execution
   - Read-only filesystem where possible
   - Minimal attack surface

### Phase 6: CI/CD Integration

1. **GitHub Actions Integration**
   ```yaml
   # .github/workflows/test.yml
   name: Test Extension
   on: [push, pull_request]
   jobs:
     test:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - name: Run Playwright Tests
           run: docker compose run --rm playwright
         - uses: actions/upload-artifact@v4
           with:
             name: playwright-report
             path: playwright-report/
   ```

## Modern Docker Features Utilized
- **Multi-stage builds** for optimization
- **BuildKit** for parallel processing
- **Health checks** for container monitoring  
- **Networks** for service isolation
- **Volumes** for persistent test results
- **Environment variables** for configuration
- **Security contexts** (non-root user)

## Test Scenarios to Implement
1. **Extension Loading**: Verify extension loads in containerized Chrome
2. **LinkedIn Detection**: Test location detection logic
3. **Context Menu Dynamics**: Verify menu updates based on location count
4. **Popup Multi-location**: Test location selector functionality
5. **Data Persistence**: Test data storage across location switches
6. **API Mocking**: Test submission flows with mocked endpoints

## Execution Commands
```bash
# Build and run tests
docker compose run --rm playwright

# Run with headed browser (for debugging)
HEADED=true docker compose run --rm playwright

# Run specific test file
docker compose run --rm playwright npx playwright test multi-location.spec.js

# Generate and serve HTML report
docker compose run --rm playwright npx playwright show-report
```

This setup provides a modern, containerized testing environment using the latest Docker and Playwright best practices without requiring local installations.