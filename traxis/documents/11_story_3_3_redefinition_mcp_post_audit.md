# STORY 3.3 - Redéfinition MCP Functions post-audit

**Auteur:** Bob (Scrum Master)  
**Tags:** STORY, EPIC-3-MCP, Post-Audit, MCP-Realignment  
**Status:** draft  
**Version:** 1.0  
**Type:** spec  

## Epic
EPIC-3-MCP

## Story Number
3.3

## Priority
HIGH

## Effort Estimate
2-3 hours

## Dependencies
- Story 4.8 implementation (unified Kanban/EPICs interface)
- Story 4.9 implementation (story creation modal)
- Epic 3 MCP tools foundation (Stories 3.1-3.2)

## Story Statement
**As an** AI Agent working with the TRAXIS system through MCP integration  
**I want** MCP functions that properly align with the new project organization and interface improvements  
**So that** I can effectively assist users after the critical UX fixes identified in Story 2.50 audit are implemented

## Critical Context
- **Urgency:** Must realign MCP with corrected UX patterns from Stories 4.8-4.9
- **Audit Impact:** MCP functions may guide users into problematic UX patterns that scored 6.65/10
- **User Statement:** "MCP work was done prematurely before interface was functional, creating a disconnect"
- **Problem Identified:** MCP work was done prematurely before interface was functional, creating disconnect

## Post-Audit UX Context

### New UX Patterns
- Unified EPICs/TASKs Kanban interface
- 'View Project Kanban' button in EpicDetailView
- Filter toggle EPICs/TASKs/ALL
- Context-preserving navigation

### Resolved by Story 4.8
- EPICs now visible in Kanban interface (was: 'No tasks' display)
- Navigation EPICs ↔ Kanban corrected (was: users 'trapped' in EPICs view)
- Interface coherence improved (was: disconnected interfaces)
- Breadcrumb navigation enhanced

## Tasks

### Task 1: Review and Update MCP Tool Descriptions
**Subtasks:**
- Audit current MCP tool descriptions for accuracy post-UX fixes
- Update tool descriptions to reflect unified Kanban/EPICs interface
- Remove references to problematic UX patterns identified in audit
- Add guidance for new navigation flows
- Update examples to reflect corrected user workflows

### Task 2: Enhance Navigation-Related MCP Functions
**Subtasks:**
- Update project navigation tools to reference unified interface
- Add guidance for EPICs visibility in Kanban context
- Include navigation patterns that avoid user 'trapping' in EPICs view
- Update breadcrumb navigation references
- Add support for new filter toggle functionality

### Task 3: Integrate Story Creation Workflow
**Subtasks:**
- Update EPIC-related MCP functions to mention story creation modal
- Add guidance for efficient EPIC → Story breakdown workflows
- Include story creation best practices in MCP tool descriptions
- Update project management workflows to include modal usage

### Task 4: Context-Aware Error Prevention
**Subtasks:**
- Add warnings about previous UX issues to prevent regression
- Include context about audit findings in relevant tool descriptions
- Add guidance to avoid patterns that led to audit score 6.65/10
- Include best practices for maintaining UX coherence

### Task 5: MCP Function Testing and Validation
**Subtasks:**
- Test MCP functions with corrected interface workflows
- Validate tool descriptions match actual interface behavior
- Ensure AI can guide users through new UX patterns effectively
- Test integration with Stories 4.8 and 4.9 implementations

## Risk Mitigation

### Preventing UX Regression
- Document audit findings in tool descriptions as warnings
- Include explicit guidance about new navigation patterns
- Add context about interface coherence requirements
- Reference unified Kanban/EPICs approach in all relevant tools

## Technical Files to Update
- python/src/server/mcp/tools/epic_tools.py
- python/src/server/mcp/tools/story_tools.py
- python/src/server/mcp/tools/project_tools.py
- python/src/server/mcp/tools/hierarchy_tools.py
- python/src/server/mcp/server.py (tool descriptions)

## Story Creation Integration

### MCP Guidance Flow
1. To add stories to an EPIC, navigate to the EPIC in the unified Kanban interface
2. Use the 'Create Story' button within the EPIC view
3. The story creation modal will maintain EPIC context automatically
4. After creation, the story will appear in the EPIC's story list

## MCP Function Updates Required

### Existing MCP Tools
- find_epics() and manage_epic() tools
- find_stories() and manage_story() tools
- find_subtasks() and manage_subtask() tools
- get_hierarchy() for navigation complete
- manage_dependencies() for dependencies
- Extension find_tasks() for integration

### Tool Description Example
**Before (Problematic):** "Navigate to EPICs view to manage project components"  
**After (Corrected):** "Access EPICs through the unified project Kanban interface, where EPICs are displayed alongside tasks. Use the filter toggle to focus on EPICs specifically, or view all project components together."

## Testing Requirements
- Test tool descriptions match corrected interface behavior
- Validate AI can guide users through new UX patterns
- Ensure no references to problematic pre-audit workflows
- Test integration with Stories 4.8 and 4.9 features
- Verify context-aware error prevention works

## Success Metrics
- MCP tool descriptions accurately reflect corrected interface
- AI agents guide users through proper UX patterns
- No user feedback about confusing MCP guidance
- Integration with Stories 4.8-4.9 seamless
- UX regression prevention confirmed

## Acceptance Criteria
1. **MCP Function Alignment:** MCP functions properly reflect the interface hierarchy changes from Story 4.8
2. **Updated Documentation:** MCP function descriptions updated to reflect new UX workflows
3. **Interface Integration:** MCP functions work seamlessly with the unified Kanban/EPICs interface
4. **Navigation Support:** MCP functions support the new navigation patterns (EPICs ↔ Kanban)
5. **Context Awareness:** MCP functions understand the resolved UX context from audit findings
6. **Story Creation Integration:** MCP functions support the new story creation modal from Story 4.9
7. **Error Prevention:** MCP functions prevent user confusion by aligning with fixed interface patterns
8. **Workflow Optimization:** MCP functions guide users through the corrected UX flows