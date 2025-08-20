#!/bin/bash

# Pre-commit Hook for Gen Image Factory
# This script runs automatically before each commit to prevent regressions
# 
# Installation:
# 1. Copy this file to .git/hooks/pre-commit
# 2. Make it executable: chmod +x .git/hooks/pre-commit
# 3. It will run automatically before each commit

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Pre-commit Hook: Running Regression Tests${NC}"
echo "=================================================="

# Get the list of staged files
STAGED_FILES=$(git diff --cached --name-only)

# Check if any critical files are being changed
CRITICAL_CHANGES=false

for file in $STAGED_FILES; do
  case $file in
    src/adapter/*)
      echo -e "${YELLOW}⚠️  Critical change detected: Backend adapter${NC}"
      CRITICAL_CHANGES=true
      ;;
    src/services/*)
      echo -e "${YELLOW}⚠️  Critical change detected: Services${NC}"
      CRITICAL_CHANGES=true
      ;;
    src/database/*)
      echo -e "${YELLOW}⚠️  Critical change detected: Database${NC}"
      CRITICAL_CHANGES=true
      ;;
    src/renderer/components/Jobs/*)
      echo -e "${YELLOW}⚠️  Critical change detected: Job management components${NC}"
      CRITICAL_CHANGES=true
      ;;
    src/renderer/components/Dashboard/*)
      echo -e "${YELLOW}⚠️  Critical change detected: Dashboard components${NC}"
      CRITICAL_CHANGES=true
      ;;
    electron/preload.js)
      echo -e "${YELLOW}⚠️  Critical change detected: Electron preload${NC}"
      CRITICAL_CHANGES=true
      ;;
    src/types/*)
      echo -e "${YELLOW}⚠️  Critical change detected: Type definitions${NC}"
      CRITICAL_CHANGES=true
      ;;
  esac
done

if [ "$CRITICAL_CHANGES" = true ]; then
  echo -e "\n${YELLOW}🚨 Critical files changed - running full regression tests${NC}"
  
  # Run linting first
  echo -e "\n${BLUE}🔍 Running linting...${NC}"
  if ! npm run lint; then
    echo -e "${RED}❌ Linting failed${NC}"
    echo "Please fix linting issues before committing"
    exit 1
  fi
  
  # Run fast regression tests
  echo -e "\n${BLUE}🧪 Running fast regression tests...${NC}"
  if ! npm run test:regression:fast; then
    echo -e "${RED}❌ Fast regression tests failed${NC}"
    echo "Please fix the failing tests before committing"
    echo "Run 'npm run test:regression:fast' to see detailed errors"
    exit 1
  fi
  
  echo -e "\n${GREEN}✅ Pre-commit checks passed${NC}"
  echo -e "${GREEN}✅ Your changes are safe to commit${NC}"
  
else
  echo -e "\n${GREEN}✅ No critical files changed${NC}"
  echo -e "${GREEN}✅ Skipping regression tests${NC}"
  
  # Still run linting for any file changes
  echo -e "\n${BLUE}🔍 Running linting...${NC}"
  if ! npm run lint; then
    echo -e "${RED}❌ Linting failed${NC}"
    echo "Please fix linting issues before committing"
    exit 1
  fi
  
  echo -e "\n${GREEN}✅ Pre-commit checks passed${NC}"
fi

echo -e "\n${GREEN}🎉 Commit allowed!${NC}"
exit 0
