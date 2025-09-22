#!/bin/bash

# TRAXIS Test Report Viewer
# Quick access to all test reports

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}📊 TRAXIS Test Reports Viewer${NC}"
echo -e "${BLUE}==============================${NC}"

# Check if test-results directory exists
if [ ! -d "test-results" ]; then
    echo -e "${YELLOW}⚠️  No test-results directory found${NC}"
    echo -e "${YELLOW}💡 Run tests first: ./scripts/run-story-5-1-tests.sh${NC}"
    exit 1
fi

echo -e "${GREEN}Available Reports:${NC}"
echo ""

# Function to check and display report availability
check_report() {
    local file=$1
    local name=$2
    local description=$3

    if [ -f "$file" ]; then
        echo -e "✅ ${name}"
        echo -e "   📁 ${file}"
        echo -e "   📋 ${description}"
        echo ""
        return 0
    else
        echo -e "❌ ${name} - Not found"
        echo ""
        return 1
    fi
}

# Check all possible reports
html_report=false
json_report=false
archon_report=false
playwright_report=false
example_report=false

if check_report "test-results/traxis-test-report.html" "TRAXIS HTML Report" "Comprehensive visual report with charts and details"; then
    html_report=true
fi

if check_report "test-results/traxis-test-report.json" "TRAXIS JSON Report" "Machine-readable detailed test results"; then
    json_report=true
fi

if check_report "test-results/archon-story-5.1-report.md" "Archon Summary Report" "Summary for updating Story 5.1 in Archon"; then
    archon_report=true
fi

if check_report "test-results/html/index.html" "Playwright HTML Report" "Standard Playwright test report"; then
    playwright_report=true
fi

if check_report "test-results/example-report.html" "Example Report" "Sample report showing expected structure"; then
    example_report=true
fi

# Interactive menu
echo -e "${YELLOW}What would you like to do?${NC}"
echo ""
echo "1) View TRAXIS HTML Report (recommended)"
echo "2) View Playwright HTML Report"
echo "3) View Example Report"
echo "4) Show Archon Summary"
echo "5) Open JSON Report in editor"
echo "6) Open all HTML reports"
echo "7) Generate new reports"
echo "8) Exit"
echo ""

read -p "Enter your choice (1-8): " choice

case $choice in
    1)
        if [ "$html_report" = true ]; then
            echo -e "${GREEN}🌐 Opening TRAXIS HTML Report...${NC}"
            if command -v xdg-open > /dev/null; then
                xdg-open test-results/traxis-test-report.html
            elif command -v open > /dev/null; then
                open test-results/traxis-test-report.html
            else
                echo "📁 Open this file in your browser: test-results/traxis-test-report.html"
            fi
        else
            echo -e "${YELLOW}⚠️  TRAXIS HTML report not found. Run tests first.${NC}"
        fi
        ;;
    2)
        if [ "$playwright_report" = true ]; then
            echo -e "${GREEN}🌐 Opening Playwright HTML Report...${NC}"
            npx playwright show-report test-results/html
        else
            echo -e "${YELLOW}⚠️  Playwright HTML report not found. Run tests first.${NC}"
        fi
        ;;
    3)
        if [ "$example_report" = true ]; then
            echo -e "${GREEN}🌐 Opening Example Report...${NC}"
            if command -v xdg-open > /dev/null; then
                xdg-open test-results/example-report.html
            elif command -v open > /dev/null; then
                open test-results/example-report.html
            else
                echo "📁 Open this file in your browser: test-results/example-report.html"
            fi
        else
            echo -e "${YELLOW}⚠️  Example report not found.${NC}"
        fi
        ;;
    4)
        if [ "$archon_report" = true ]; then
            echo -e "${GREEN}📋 Archon Summary Report:${NC}"
            echo -e "${BLUE}========================${NC}"
            cat test-results/archon-story-5.1-report.md
        else
            echo -e "${YELLOW}⚠️  Archon summary not found. Run tests first.${NC}"
        fi
        ;;
    5)
        if [ "$json_report" = true ]; then
            echo -e "${GREEN}📝 Opening JSON Report...${NC}"
            if command -v code > /dev/null; then
                code test-results/traxis-test-report.json
            elif command -v nano > /dev/null; then
                nano test-results/traxis-test-report.json
            else
                echo "📁 JSON report location: test-results/traxis-test-report.json"
            fi
        else
            echo -e "${YELLOW}⚠️  JSON report not found. Run tests first.${NC}"
        fi
        ;;
    6)
        echo -e "${GREEN}🌐 Opening all available HTML reports...${NC}"

        if [ "$html_report" = true ]; then
            if command -v xdg-open > /dev/null; then
                xdg-open test-results/traxis-test-report.html
            elif command -v open > /dev/null; then
                open test-results/traxis-test-report.html
            fi
        fi

        if [ "$playwright_report" = true ]; then
            npx playwright show-report test-results/html &
        fi

        if [ "$example_report" = true ]; then
            if command -v xdg-open > /dev/null; then
                xdg-open test-results/example-report.html
            elif command -v open > /dev/null; then
                open test-results/example-report.html
            fi
        fi
        ;;
    7)
        echo -e "${GREEN}🚀 Running test execution script...${NC}"
        ./scripts/run-story-5-1-tests.sh
        ;;
    8)
        echo -e "${GREEN}👋 Goodbye!${NC}"
        exit 0
        ;;
    *)
        echo -e "${YELLOW}⚠️  Invalid choice. Please try again.${NC}"
        ;;
esac