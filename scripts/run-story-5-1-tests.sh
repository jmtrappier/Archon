#!/bin/bash

# TRAXIS Story 5.1 - Test Execution Script
# Executes E2E tests and generates comprehensive reports

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🎯 TRAXIS Story 5.1 - Test Execution Starting...${NC}"
echo -e "${BLUE}=================================================${NC}"

# Check if applications are running
echo -e "${YELLOW}🔍 Checking application status...${NC}"

# Check frontend
if curl -s http://localhost:3737 > /dev/null; then
    echo -e "${GREEN}✅ Frontend running on port 3737${NC}"
else
    echo -e "${RED}❌ Frontend not running on port 3737${NC}"
    echo -e "${YELLOW}💡 Start with: cd archon-ui-main && npm run dev${NC}"
    exit 1
fi

# Check backend
if curl -s http://localhost:8181/health > /dev/null; then
    echo -e "${GREEN}✅ Backend running on port 8181${NC}"
else
    echo -e "${RED}❌ Backend not running on port 8181${NC}"
    echo -e "${YELLOW}💡 Start with: cd python && uv run python -m server.main${NC}"
    exit 1
fi

# Create reports directory
mkdir -p test-results

echo -e "${YELLOW}🧪 Installing test dependencies...${NC}"
npm install @playwright/test --save-dev
npx playwright install chromium

echo -e "${YELLOW}🚀 Running Story 5.1 E2E Tests...${NC}"

# Run tests with comprehensive reporting
npx playwright test \
    --config=playwright.config.ts \
    tests/e2e/ tests/integration/ \
    || test_exit_code=$?

# Generate additional reports
echo -e "${YELLOW}📊 Generating test reports...${NC}"

# Create a simple summary if main reporter fails
if [ ! -f "test-results/traxis-test-report.json" ]; then
    echo -e "${YELLOW}⚠️  Creating fallback report...${NC}"

    # Count test files for summary
    total_tests=$(find tests/e2e tests/integration -name "*.spec.ts" -exec grep -h "test(" {} \; | wc -l)

    cat > test-results/fallback-summary.md << EOF
# STORY 5.1 - Fallback Test Summary

**Date**: $(date)
**Status**: Tests configured and ready
**Total Test Cases**: ${total_tests}

## Test Structure Created:
- ✅ Hierarchy Tests (Epic, Story, Task, Subtask)
- ✅ Navigation Tests (Breadcrumb)
- ✅ Dependency Tests
- ✅ Performance Tests
- ✅ MCP Integration Tests

## Files Created:
- playwright.config.ts
- tests/e2e/hierarchy/*.spec.ts
- tests/e2e/navigation/*.spec.ts
- tests/e2e/dependencies/*.spec.ts
- tests/e2e/performance/*.spec.ts
- tests/integration/mcp/*.spec.ts
- tests/fixtures/test-data.ts
- tests/reporters/custom-reporter.ts

## Next Steps:
1. Ensure frontend and backend are running
2. Execute: npx playwright test
3. View reports in test-results/

EOF
fi

# Display results
echo -e "${BLUE}📋 Test Execution Complete!${NC}"
echo -e "${BLUE}=========================${NC}"

if [ -f "test-results/traxis-test-report.html" ]; then
    echo -e "${GREEN}✅ HTML Report: test-results/traxis-test-report.html${NC}"
fi

if [ -f "test-results/traxis-test-report.json" ]; then
    echo -e "${GREEN}✅ JSON Report: test-results/traxis-test-report.json${NC}"
fi

if [ -f "test-results/archon-story-5.1-report.md" ]; then
    echo -e "${GREEN}✅ Archon Summary: test-results/archon-story-5.1-report.md${NC}"
fi

if [ -f "test-results/html/index.html" ]; then
    echo -e "${GREEN}✅ Playwright HTML Report: test-results/html/index.html${NC}"
fi

echo -e "${YELLOW}🌐 To view HTML report, run:${NC}"
echo -e "${BLUE}   npx playwright show-report test-results/html${NC}"

echo -e "${YELLOW}📊 To view TRAXIS report, open:${NC}"
echo -e "${BLUE}   test-results/traxis-test-report.html${NC}"

# Exit with original test exit code
exit ${test_exit_code:-0}