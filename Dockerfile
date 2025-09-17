# Use official Playwright image with Node.js
FROM mcr.microsoft.com/playwright:v1.48.0-noble

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Create directory for test results
RUN mkdir -p test-results

# Expose port for potential debugging
EXPOSE 9323

# Default command to run tests
CMD ["npx", "playwright", "test"]