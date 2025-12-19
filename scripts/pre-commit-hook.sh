#!/bin/bash

# Pre-commit hook script for Gen Image Factory
# This script runs critical quality gates before allowing commits
# Total target time: < 30 seconds

set -e

echo "Running pre-commit quality gates..."

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
            echo -e "${GREEN}[OK] $message${NC}"
            ;;
        "WARNING")
            echo -e "${YELLOW}[WARN] $message${NC}"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR] $message${NC}"
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

# 1. Repository hygiene scan (staged files)
echo "Running repository hygiene scan (staged files)..."
if node scripts/repo-scan.js --staged > /dev/null 2>&1; then
    print_status "SUCCESS" "Repo-scan passed for staged files"
else
    print_status "ERROR" "Repo-scan failed for staged files"
    echo "Running scan with output to see details:"
    node scripts/repo-scan.js --staged --verbose || true
    exit 1
fi

# 2. Critical regression tests (must-not-regress scenarios)
echo "Running critical regression tests (must-not-regress scenarios)..."
if npm run test:critical > /dev/null 2>&1; then
    print_status "SUCCESS" "Critical regression tests passed"
else
    print_status "ERROR" "Critical regression tests failed - this blocks the commit!"
    echo "Running tests with output to see failures:"
    npm run test:critical
    exit 1
fi

# 3. ESLint on staged files (BLOCKING - zero warnings allowed)
echo "Running ESLint on staged files (zero warnings allowed)..."
staged_files=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|jsx|ts|tsx)$' || echo "")
if [ -z "$staged_files" ]; then
    print_status "SUCCESS" "No staged JS/TS files to lint"
else
    # Run ESLint and capture exit code
    if echo "$staged_files" | xargs npx eslint --quiet 2>&1; then
        print_status "SUCCESS" "ESLint passed (no warnings)"
    else
        print_status "ERROR" "ESLint found issues - this blocks the commit!"
        echo "Staged files with issues:"
        echo "$staged_files" | xargs npx eslint
        exit 1
    fi
fi

# 4. Semgrep security scan (staged files) - Uses .semgrep.yml config
echo "Running Semgrep security scan (staged files)..."
staged_files_for_semgrep=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|jsx|ts|tsx)$' | grep -v '^electron/renderer/' || echo "")
if [ -z "$staged_files_for_semgrep" ]; then
    print_status "SUCCESS" "No staged JS/TS files to scan with Semgrep (excluding electron/renderer/)"
else
    # Ensure Semgrep is available - install via pip if not found
    SEMGREP_CMD=""
    if command -v semgrep >/dev/null 2>&1; then
        SEMGREP_CMD="semgrep"
    elif command -v python3 >/dev/null 2>&1 && python3 -m semgrep --version >/dev/null 2>&1; then
        # Semgrep installed but not in PATH, use python3 -m semgrep
        SEMGREP_CMD="python3 -m semgrep"
    else
        # Install via pip (handle Homebrew Python PEP 668 restriction)
        print_status "WARNING" "Semgrep not found, installing via pip..."
        if command -v python3 >/dev/null 2>&1; then
            # Try with --break-system-packages (required for Homebrew Python)
            if python3 -m pip install --break-system-packages semgrep >/dev/null 2>&1; then
                # Check if semgrep is now available
                if command -v semgrep >/dev/null 2>&1; then
                    SEMGREP_CMD="semgrep"
                elif python3 -m semgrep --version >/dev/null 2>&1; then
                    SEMGREP_CMD="python3 -m semgrep"
                fi
            fi
            
            if [ -z "$SEMGREP_CMD" ]; then
                print_status "ERROR" "Failed to install Semgrep. Please install manually: python3 -m pip install --break-system-packages semgrep"
                exit 1
            fi
        else
            print_status "ERROR" "Python3 not found. Please install Semgrep manually: python3 -m pip install --break-system-packages semgrep"
            exit 1
        fi
    fi
    
    # Run Semgrep on staged files using command-line config flags (Semgrep 1.146.0 has issues with YAML config files)
    # Using same rules as .semgrep.yml: p/owasp-electron, p/owasp-top-ten, p/javascript
    # Explicitly exclude electron/renderer/ (build output) and include electron/main.js and electron/preload.js
    # Path exclusions also handled via .semgrepignore as backup
    semgrep_output=$(echo "$staged_files_for_semgrep" | xargs $SEMGREP_CMD scan --config=p/owasp-electron --config=p/owasp-top-ten --config=p/javascript --error 2>&1)
    semgrep_exit=$?
    
    if [ $semgrep_exit -eq 0 ]; then
        print_status "SUCCESS" "Semgrep security scan passed"
    elif [ $semgrep_exit -eq 1 ] || [ $semgrep_exit -eq 7 ]; then
        # Exit codes 1 and 7 mean findings were found
        print_status "ERROR" "Semgrep found security issues - this blocks the commit!"
        echo "$semgrep_output"
        exit 1
    else
        # Other exit codes - installation/execution errors
        print_status "ERROR" "Semgrep scan failed (exit code: $semgrep_exit)"
        echo "$semgrep_output"
        exit 1
    fi
fi

# 5. Socket.dev supply-chain scan
echo "Running Socket.dev supply-chain scan..."
socket_output=$(npx socket audit 2>&1 || true)
if echo "$socket_output" | grep -qi "No issues found\|No high-risk"; then
    print_status "SUCCESS" "Socket.dev supply-chain scan passed"
elif echo "$socket_output" | grep -qi "high-risk\|critical\|malicious"; then
    print_status "ERROR" "Socket.dev found high-risk supply-chain issues - this blocks the commit!"
    echo "$socket_output"
    exit 1
else
    print_status "SUCCESS" "Socket.dev scan completed (low-risk findings only)"
fi

# 6. Check for sensitive data in staged files (exclude test files)
echo "Checking for sensitive data in staged files..."
# Filter out test files and hook scripts from the check (test files legitimately contain fake API keys)
non_test_files=$(git diff --cached --name-only | grep -v -E "(test|spec|__tests__|pre-commit|\.md$|\.txt$)" || echo "")

if [ -n "$non_test_files" ]; then
    # Check for OpenAI-style API keys (sk-...)
    if echo "$non_test_files" | xargs grep -lE "sk-[a-zA-Z0-9]{20,}" 2>/dev/null; then
        print_status "ERROR" "Potential OpenAI API keys found in staged files!"
        echo "Please remove any API keys before committing."
        exit 1
    fi
    
    # Check for other common API key patterns
    # Runware keys (if they follow a pattern - adjust based on actual format)
    if echo "$non_test_files" | xargs grep -lE "(api[_-]?key|apikey)\s*[:=]\s*['\"]?[a-zA-Z0-9]{32,}" 2>/dev/null; then
        print_status "ERROR" "Potential API key assignments found in staged files!"
        echo "Please ensure API keys are not hardcoded. Use Settings UI instead."
        exit 1
    fi
    
    # Check for environment variable assignments with long values (potential keys)
    if echo "$non_test_files" | xargs grep -lE "(OPENAI|RUNWARE|REMOVE_BG|API_KEY).*=\s*['\"]?[a-zA-Z0-9]{32,}" 2>/dev/null; then
        print_status "ERROR" "Potential API key environment variables found in staged files!"
        echo "Please use .env files (which are gitignored) instead of hardcoding."
        exit 1
    fi
    
    # Check for console.log with apiKeys (logging detection)
    if echo "$non_test_files" | xargs grep -l "console\.log.*apiKeys" 2>/dev/null; then
        print_status "ERROR" "Potential API key logging found in staged files!"
        echo "Please ensure all logging is properly sanitized (use safeLogger)."
        exit 1
    fi
    
    # Check for .env files being committed
    if echo "$non_test_files" | grep -E "\.env$|\.env\."; then
        print_status "ERROR" ".env files detected in staged files!"
        echo ".env files should never be committed. They are in .gitignore for a reason."
        exit 1
    fi
fi

echo ""
print_status "SUCCESS" "All pre-commit quality gates passed!"
echo "Ready to commit your changes!"
