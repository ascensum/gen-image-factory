#!/bin/bash

# Pre-commit hook script for Gen Image Factory
# This script runs critical regression tests before allowing commits

set -e

echo "🔒 Running pre-commit regression tests..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    
    case $status in
        "SUCCESS")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "WARNING")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        "ERROR")
            echo -e "${RED}❌ $message${NC}"
            ;;
    esac
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_status "ERROR" "Must run from project root directory"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    print_status "WARNING" "node_modules not found, installing dependencies..."
    npm install
fi

echo "🧪 Running critical regression tests..."

# 1. Run retry functionality tests (CRITICAL - prevent regression)
echo "🔄 Testing Retry Functionality (CRITICAL)..."
if npm run test:retry > /dev/null 2>&1; then
    print_status "SUCCESS" "Retry functionality tests passed"
else
    print_status "ERROR" "Retry functionality tests failed - this is CRITICAL!"
    echo "Running tests with output to see failures:"
    npm run test:retry
    exit 1
fi

# 2. Run security tests
echo "🔒 Testing Security (API Key Exposure Prevention)..."
if npm run test:security > /dev/null 2>&1; then
    print_status "SUCCESS" "Security tests passed"
else
    print_status "ERROR" "Security tests failed - potential API key exposure!"
    echo "Running tests with output to see failures:"
    npm run test:security
    exit 1
fi

# 3. Run basic functionality tests
echo "🔧 Testing Basic Functionality..."
if npm run test:basic > /dev/null 2>&1; then
    print_status "SUCCESS" "Basic functionality tests passed"
else
    print_status "WARNING" "Basic functionality tests failed"
    echo "Running tests with output to see failures:"
    npm run test:basic
    # Don't exit 1 for basic tests, just warn
fi

# 4. Check for sensitive data in staged files
echo "🔍 Checking for sensitive data in staged files..."
if git diff --cached --name-only | xargs grep -l "sk-" 2>/dev/null; then
    print_status "ERROR" "Potential API keys found in staged files!"
    echo "Please remove any API keys before committing."
    exit 1
fi

if git diff --cached --name-only | xargs grep -l "console.log.*apiKeys" 2>/dev/null; then
    print_status "ERROR" "Potential API key logging found in staged files!"
    echo "Please ensure all logging is properly sanitized."
    exit 1
fi

print_status "SUCCESS" "All pre-commit checks passed!"

# 5. Run linting if available
if [ -f "eslint.config.js" ]; then
    echo "🔍 Running ESLint..."
    if npx eslint src/ --ext .js,.jsx,.ts,.tsx --quiet; then
        print_status "SUCCESS" "ESLint passed"
    else
        print_status "WARNING" "ESLint found issues - consider fixing them"
    fi
fi

echo ""
print_status "SUCCESS" "Pre-commit hook completed successfully!"
echo "🚀 Ready to commit your changes!"
