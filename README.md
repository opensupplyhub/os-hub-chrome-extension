# Open Supply Hub Chrome Extension

This Chrome extension allows users to highlight production location information from any web page and submit it to Open Supply Hub.

## Features

- Highlight and capture production location information (name, address, country, product type, sector, parent company)
- Submit location data to Open Supply Hub via their REST API
- Save your Open Supply Hub API key for easy submission
- Switch between staging and production environments
- Country code dropdown with autocomplete functionality
- Sector and product type dropdown menus for standardized submissions

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension directory
5. The extension should now be installed and visible in your Chrome toolbar

## Usage

1. Click on the extension icon to open the popup
2. Enter your Open Supply Hub API key and save it
3. Browse to a webpage containing production location information
4. Highlight text on the page (e.g., a location name)
5. Right-click and select "Save to Open Supply Hub" > "Save as Location Name" (or other appropriate field)
6. Repeat for other fields (address, country, etc.)
7. Click the extension icon to open the popup and review the captured information
8. Click "Submit to Open Supply Hub" to send the data

## API Integration

This extension integrates with the Open Supply Hub API v1 as defined in the OpenAPI specification. It supports both the staging environment (`https://staging.opensupplyhub.org/api`) and production environment (`https://opensupplyhub.org/api`), using the `/v1/production-locations/` endpoint to submit new production locations.

The extension also includes integration with the parent company search API to help users select standardized parent company names.

## Required Fields

When submitting a production location to Open Supply Hub, the following fields are required:
- Name: The name of the production location
- Address: The street address of the production location
- Country: The country where the production location is located (preferably using the ISO 3166-1 alpha-2 code)

## Optional Fields

The following fields are optional:
- Product Types: Types of products produced/processed at the location (dropdown selection)
- Sectors: Industry sectors associated with the location (dropdown selection)
- Parent Company: The parent company associated with the production location
- Source & Timestamp: The website URL this production location is listed, and when it was submitted

## Privacy

This extension only sends data to Open Supply Hub when you explicitly click the "Submit" button. Your API keys are stored in Chrome's secure storage and are only used for authenticating with the Open Supply Hub API. Separate API keys are maintained for staging and production environments.

The extension includes a visible banner that clearly indicates which environment (staging or production) is currently active to prevent accidental submissions to the wrong environment.

## Development

This extension is built using standard web technologies:
- HTML/CSS for the popup interface
- JavaScript for the functionality
- Chrome Extension APIs for browser integration

## License

This project is open source and available under the MIT License.

## Contributing

Contributions to the Open Supply Hub Chrome Extension are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Maintainers

This extension is maintained by the Open Supply Hub team.
