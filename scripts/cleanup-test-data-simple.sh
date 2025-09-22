#!/bin/bash

# Simple TRAXIS Test Data Cleanup Utility
# Emergency cleanup for test projects (simplified version without jq)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🧹 TRAXIS Test Data Cleanup (Simple)${NC}"
echo -e "${BLUE}====================================${NC}"

# Check if backend is running
if ! curl -s http://localhost:8181/health > /dev/null; then
    echo -e "${RED}❌ Backend not running on port 8181${NC}"
    echo -e "${YELLOW}💡 Start with: cd python && uv run python -m server.main${NC}"
    exit 1
fi

echo -e "${YELLOW}🔍 Getting all projects...${NC}"

# Get all projects and show them
response=$(curl -s "http://localhost:8181/api/projects")
echo "$response" > /tmp/all_projects.json

# Count total projects
total_projects=$(echo "$response" | grep -o '"id":' | wc -l)
echo -e "${BLUE}📊 Found $total_projects total projects${NC}"

# Show projects containing "test", "performance", "temp" patterns
echo -e "${YELLOW}🔍 Projects that look like test data:${NC}"
echo "$response" | grep -i -E "(test|performance|temp|demo|example)" || echo "No obvious test projects found"

echo -e "${YELLOW}💡 Manual cleanup instructions:${NC}"
echo "1. Review the projects above"
echo "2. Use the frontend UI to delete unwanted projects"
echo "3. Or use curl commands like:"
echo "   curl -X DELETE http://localhost:8181/api/projects/PROJECT_ID"

# Simple bulk delete option (with confirmation)
echo -e "${YELLOW}⚠️  Would you like to delete ALL projects? (y/N)${NC}"
read -p "This will delete EVERYTHING: " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}🚨 DELETING ALL PROJECTS...${NC}"

    # Extract all project IDs (simple approach)
    project_ids=$(echo "$response" | grep -o '"id":"[^"]*"' | sed 's/"id":"//g' | sed 's/"//g')

    count=0
    for project_id in $project_ids; do
        if [ ! -z "$project_id" ]; then
            echo -e "  🗑️  Deleting project: $project_id"
            if curl -s -X DELETE "http://localhost:8181/api/projects/$project_id" > /dev/null; then
                count=$((count + 1))
            fi
        fi
    done

    echo -e "${GREEN}✅ Deleted $count projects${NC}"
else
    echo -e "${BLUE}ℹ️  No projects deleted${NC}"
fi

# Final count
final_response=$(curl -s "http://localhost:8181/api/projects")
final_count=$(echo "$final_response" | grep -o '"id":' | wc -l)
echo -e "${BLUE}📊 Remaining projects: $final_count${NC}"

echo -e "${GREEN}✅ Cleanup process completed${NC}"