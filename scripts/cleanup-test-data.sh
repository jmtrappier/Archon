#!/bin/bash

# TRAXIS Test Data Cleanup Utility
# Emergency cleanup for test projects and orphaned data

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🧹 TRAXIS Test Data Cleanup Utility${NC}"
echo -e "${BLUE}====================================${NC}"

# Check if backend is running
if ! curl -s http://localhost:8181/health > /dev/null; then
    echo -e "${RED}❌ Backend not running on port 8181${NC}"
    echo -e "${YELLOW}💡 Start with: cd python && uv run python -m server.main${NC}"
    exit 1
fi

echo -e "${YELLOW}🔍 Searching for test projects...${NC}"

# Function to delete projects by name pattern (without jq dependency)
cleanup_projects() {
    local pattern=$1
    local description=$2

    echo -e "${YELLOW}Cleaning up ${description}...${NC}"

    # Get all projects and extract IDs with grep/sed
    response=$(curl -s "http://localhost:8181/api/projects")

    # Extract project IDs that match the pattern
    projects=$(echo "$response" | grep -o '"id":"[^"]*"' | grep -B5 -A5 "$pattern" | grep -o '"id":"[^"]*"' | sed 's/"id":"//g' | sed 's/"//g' | head -50)

    if [ -z "$projects" ]; then
        echo -e "${GREEN}✅ No ${description} found${NC}"
        return
    fi

    count=0
    for project_id in $projects; do
        if [ ! -z "$project_id" ]; then
            echo -e "  🗑️  Deleting project: $project_id"
            if curl -s -X DELETE "http://localhost:8181/api/projects/$project_id" > /dev/null; then
                count=$((count + 1))
            else
                echo -e "${RED}❌ Failed to delete project: $project_id${NC}"
            fi
        fi
    done

    echo -e "${GREEN}✅ Deleted $count ${description}${NC}"
}

# Cleanup different types of test projects
cleanup_projects "Performance Test|E2E.*Test|Test.*Epic|Test.*Story|Test.*Task" "performance test projects"
cleanup_projects ".*E-P[0-9]+.*|.*E-SC[0-9]+.*|.*E-TC[0-9]+.*" "load test projects"
cleanup_projects "Frontend.*Test|Backend.*Test|Mobile.*Test" "category test projects"
cleanup_projects "Temporary.*|Temp.*|Test.*Project" "temporary test projects"

echo -e "${YELLOW}🔍 Cleaning up orphaned EPICs...${NC}"

# Get all EPICs with test patterns
orphaned_epics=$(curl -s "http://localhost:8181/api/epics" | jq -r '.[] | select(.title | test("Performance.*Epic|Test.*Epic|.*E-P[0-9]+.*|.*Container.*Epic")) | .id')

if [ ! -z "$orphaned_epics" ]; then
    count=0
    for epic_id in $orphaned_epics; do
        echo -e "  🗑️  Deleting orphaned EPIC: $epic_id"
        if curl -s -X DELETE "http://localhost:8181/api/epics/$epic_id" > /dev/null; then
            count=$((count + 1))
        fi
    done
    echo -e "${GREEN}✅ Deleted $count orphaned EPICs${NC}"
else
    echo -e "${GREEN}✅ No orphaned EPICs found${NC}"
fi

echo -e "${YELLOW}🔍 Cleaning up orphaned STORIEs...${NC}"

# Get all STORIEs with test patterns
orphaned_stories=$(curl -s "http://localhost:8181/api/stories" | jq -r '.[] | select(.title | test("Performance.*Story|Test.*Story|.*Container.*Story")) | .id')

if [ ! -z "$orphaned_stories" ]; then
    count=0
    for story_id in $orphaned_stories; do
        echo -e "  🗑️  Deleting orphaned STORY: $story_id"
        if curl -s -X DELETE "http://localhost:8181/api/stories/$story_id" > /dev/null; then
            count=$((count + 1))
        fi
    done
    echo -e "${GREEN}✅ Deleted $count orphaned STORIEs${NC}"
else
    echo -e "${GREEN}✅ No orphaned STORIEs found${NC}"
fi

echo -e "${YELLOW}🔍 Cleaning up orphaned TASKs...${NC}"

# Get all TASKs with test patterns
orphaned_tasks=$(curl -s "http://localhost:8181/api/tasks" | jq -r '.[] | select(.title | test("Performance.*Task|Test.*Task")) | .id')

if [ ! -z "$orphaned_tasks" ]; then
    count=0
    for task_id in $orphaned_tasks; do
        echo -e "  🗑️  Deleting orphaned TASK: $task_id"
        if curl -s -X DELETE "http://localhost:8181/api/tasks/$task_id" > /dev/null; then
            count=$((count + 1))
        fi
    done
    echo -e "${GREEN}✅ Deleted $count orphaned TASKs${NC}"
else
    echo -e "${GREEN}✅ No orphaned TASKs found${NC}"
fi

echo -e "${BLUE}📊 Cleanup Summary${NC}"
echo -e "${BLUE}=================${NC}"
echo -e "${GREEN}✅ Test data cleanup completed successfully${NC}"
echo -e "${YELLOW}💡 Run this script anytime to clean up test data${NC}"
echo -e "${YELLOW}💡 Add to package.json: npm run cleanup:test-data${NC}"

echo -e "${BLUE}🔍 Current database state:${NC}"
project_count=$(curl -s "http://localhost:8181/api/projects" | jq length)
epic_count=$(curl -s "http://localhost:8181/api/epics" | jq length)
story_count=$(curl -s "http://localhost:8181/api/stories" | jq length)
task_count=$(curl -s "http://localhost:8181/api/tasks" | jq length)

echo -e "📁 Projects: $project_count"
echo -e "🏗️  EPICs: $epic_count"
echo -e "📋 STORIEs: $story_count"
echo -e "✅ TASKs: $task_count"