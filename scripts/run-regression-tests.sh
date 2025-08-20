#!/bin/bash

# Regression Test Runner for Gen Image Factory
# This script runs comprehensive tests to prevent regressions when making changes
# 
# Usage: ./scripts/run-regression-tests.sh [--fast] [--e2e] [--unit] [--integration]
# 
# Options:
#   --fast      Run only critical tests (faster)
#   --e2e       Run only E2E tests
#   --unit      Run only unit tests
#   --integration Run only integration tests
#   --all       Run all tests (default)

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Parse command line arguments
RUN_FAST=false
RUN_E2E=false
RUN_UNIT=false
RUN_INTEGRATION=false
RUN_ALL=true

while [[ $# -gt 0 ]]; do
  case $1 in
    --fast)
      RUN_FAST=true
      RUN_ALL=false
      shift
      ;;
    --e2e)
      RUN_E2E=true
      RUN_ALL=false
      shift
      ;;
    --unit)
      RUN_UNIT=true
      RUN_ALL=false
      shift
      ;;
    --integration)
      RUN_INTEGRATION=true
      RUN_ALL=false
      shift
      ;;
    --all)
      RUN_ALL=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--fast] [--e2e] [--unit] [--integration] [--all]"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}🚀 Gen Image Factory Regression Test Runner${NC}"
echo "=================================================="

# Function to run tests and track results
run_test_suite() {
  local suite_name="$1"
  local test_command="$2"
  local test_count=0
  
  echo -e "\n${YELLOW}🧪 Running $suite_name...${NC}"
  echo "Command: $test_command"
  
  # Run the tests and capture output
  if eval "$test_command"; then
    echo -e "${GREEN}✅ $suite_name passed${NC}"
    PASSED_TESTS=$((PASSED_TESTS + test_count))
  else
    echo -e "${RED}❌ $suite_name failed${NC}"
    FAILED_TESTS=$((FAILED_TESTS + test_count))
    return 1
  fi
  
  TOTAL_TESTS=$((TOTAL_TESTS + test_count))
}

# Function to check if tests exist
test_exists() {
  local test_path="$1"
  if [ -f "$test_path" ] || [ -d "$test_path" ]; then
    return 0
  else
    return 1
  fi
}

# Pre-flight checks
echo -e "\n${BLUE}🔍 Pre-flight checks...${NC}"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo -e "${RED}❌ Error: Not in project root directory${NC}"
  echo "Please run this script from the gen-image-factory project root"
  exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}⚠️  Dependencies not installed, installing...${NC}"
  npm install
fi

# Check if test files exist
if [ "$RUN_E2E" = true ] || [ "$RUN_ALL" = true ]; then
  if ! test_exists "tests/e2e/workflows/"; then
    echo -e "${RED}❌ Error: E2E tests not found${NC}"
    exit 1
  fi
fi

if [ "$RUN_UNIT" = true ] || [ "$RUN_ALL" = true ]; then
  if ! test_exists "tests/unit/"; then
    echo -e "${RED}❌ Error: Unit tests not found${NC}"
    exit 1
  fi
fi

if [ "$RUN_INTEGRATION" = true ] || [ "$RUN_ALL" = true ]; then
  if ! test_exists "tests/integration/"; then
    echo -e "${RED}❌ Error: Integration tests not found${NC}"
    exit 1
  fi
fi

echo -e "${GREEN}✅ Pre-flight checks passed${NC}"

# Run linting first (always run this)
echo -e "\n${BLUE}🔍 Running linting...${NC}"
if npm run lint; then
  echo -e "${GREEN}✅ Linting passed${NC}"
else
  echo -e "${RED}❌ Linting failed - fixing issues first${NC}"
  echo "Please fix linting issues before running tests"
  exit 1
fi

# Run tests based on options
if [ "$RUN_FAST" = true ]; then
  echo -e "\n${YELLOW}⚡ Running fast regression tests...${NC}"
  
  # Run only critical E2E tests
  run_test_suite "Critical E2E Tests" "npm run test:e2e -- tests/e2e/workflows/bulk-rerun-regression.e2e.test.ts"
  
  # Run only critical unit tests
  run_test_suite "Critical Unit Tests" "npm test -- tests/unit/database/ --run"
  
elif [ "$RUN_E2E" = true ]; then
  echo -e "\n${YELLOW}🧪 Running E2E tests...${NC}"
  
  run_test_suite "Bulk Rerun E2E Tests" "npm run test:e2e -- tests/e2e/workflows/bulk-rerun-regression.e2e.test.ts"
  run_test_suite "Single Job Run E2E Tests" "npm run test:e2e -- tests/e2e/workflows/single-job-run-regression.e2e.test.ts"
  run_test_suite "Single Job Rerun E2E Tests" "npm run test:e2e -- tests/e2e/workflows/single-job-rerun-regression.e2e.test.ts"
  
elif [ "$RUN_UNIT" = true ]; then
  echo -e "\n${YELLOW}🧪 Running unit tests...${NC}"
  
  run_test_suite "Database Unit Tests" "npm test -- tests/unit/database/ --run"
  run_test_suite "Services Unit Tests" "npm test -- tests/unit/services/ --run"
  
elif [ "$RUN_INTEGRATION" = true ]; then
  echo -e "\n${YELLOW}🧪 Running integration tests...${NC}"
  
  run_test_suite "Backend Integration Tests" "npm test -- tests/integration/backend/ --run"
  run_test_suite "API Integration Tests" "npm test -- tests/integration/api/ --run"
  
elif [ "$RUN_ALL" = true ]; then
  echo -e "\n${YELLOW}🧪 Running all regression tests...${NC}"
  
  # Run unit tests first (fastest)
  run_test_suite "Unit Tests" "npm test -- tests/unit/ --run"
  
  # Run integration tests
  run_test_suite "Integration Tests" "npm test -- tests/integration/ --run"
  
  # Run E2E tests last (slowest)
  run_test_suite "E2E Tests" "npm run test:e2e -- tests/e2e/workflows/ --run"
fi

# Summary
echo -e "\n${BLUE}📊 Test Results Summary${NC}"
echo "=========================="
echo -e "Total Tests: ${TOTAL_TESTS}"
echo -e "Passed: ${GREEN}${PASSED_TESTS}${NC}"
echo -e "Failed: ${RED}${FAILED_TESTS}${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "\n${GREEN}🎉 All tests passed! No regressions detected.${NC}"
  echo -e "${GREEN}✅ Your changes are safe to commit.${NC}"
  exit 0
else
  echo -e "\n${RED}❌ Some tests failed! Potential regressions detected.${NC}"
  echo -e "${RED}🚨 Please fix the failing tests before committing.${NC}"
  exit 1
fi
