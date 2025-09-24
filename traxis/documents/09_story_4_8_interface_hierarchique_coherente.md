# STORY 4.8 - Interface Hiérarchique Cohérente

**Auteur:** Bob (Scrum Master)  
**Tags:** STORY, EPIC-4-Frontend, UX-Critical, Audit-Remediation  
**Status:** draft  
**Version:** 1.0  
**Type:** spec  

## Epic
EPIC-4-Frontend

## Story Number
4.8

## Priority
CRITICAL

## Effort Estimate
4-6 hours (Phase 1 plan remédiation audit)

## Dependencies
Stories 4.1-4.7 completed providing solid foundation

## Story Statement
**As a** Product Owner navigating through project EPICs and managing tasks  
**I want** a cohesive interface that seamlessly displays EPICs within the Kanban view and provides clear navigation between hierarchy levels  
**So that** I can efficiently move from EPIC overview to TASK management without losing context or getting trapped in separate interface silos

## Critical Context
- **User Impact:** Users get 'trapped' in EPICs view with no clear path back to project Kanban
- **Core Problem:** déconnexion entre la hiérarchie EPICs/Stories et l'affichage Kanban au niveau projet
- **Audit Findings:** Score 6.65/10 (below 7.0 threshold) - EPICs absent from Kanban interface causing user navigation frustration

## Technical Context

### API Integration
- **Requirement:** Parallel API calls in TasksTab component
- **Current Working:** GET /api/projects/{id}/tasks
- **Missing Integration:** GET /api/projects/{id}/epics not integrated in Kanban

### Affected Components
- TasksTab.tsx - Primary component needing EPIC integration
- EpicDetailView.tsx - Needs 'View Project Kanban' button
- HierarchyBreadcrumb.tsx - Needs 'Project Kanban' link option
- KanbanColumn.tsx - Must handle both EPIC and TASK cards

### Performance Constraints
- ETag caching proven effective (304 responses in audit)
- Response time < 200ms maintained
- No regression in existing TASK functionality

## Tasks

### Task 1: Integrate EPICs into Kanban Interface
**Subtasks:**
- Modify TasksTab to fetch and display EPICs alongside TASKs
- Create EpicCard component compatible with KanbanColumn layout
- Map EPIC status to appropriate Kanban columns
- Add API call to /projects/{id}/epics in TasksTab
- Implement filter toggle (EPICs/TASKs/ALL)

### Task 2: Enhanced Navigation Between Views
**Subtasks:**
- Add 'View Project Kanban' button in EpicDetailView
- Update HierarchyBreadcrumb to include 'Project Kanban' link
- Implement direct navigation from EPIC view to project Kanban
- Ensure navigation maintains project context

### Task 3: Visual and UX Coherence
**Subtasks:**
- Ensure EPICs and TASKs have consistent visual styling in Kanban
- Resolve 'No tasks' display when EPICs are present
- Implement consistent drag & drop behavior for both EPICs and TASKs
- Add visual indicators to distinguish EPICs from TASKs

### Task 4: Interface State Management
**Subtasks:**
- Implement filter state persistence across navigation
- Add URL query parameters to maintain view preferences
- Ensure consistent loading states for both EPICs and TASKs

### Task 5: E2E Testing & Validation
**Subtasks:**
- Test navigation flow EPICs → Kanban → EPICs
- Verify EPICs display correctly in Kanban interface
- Validate filter toggle functionality
- Test breadcrumb navigation completeness
- Confirm UX issues from audit 2.50 are resolved

## Success Metrics
- EPICs visible in Kanban interface
- Navigation flow EPICs ↔ Kanban functioning
- User satisfaction score > 7.0/10 (audit remediation)
- No 'trapped in EPICs view' user feedback

## Acceptance Criteria
1. **EPICs Integration in Kanban:** EPICs are visible and manageable within the main project Kanban interface
2. **Navigation Coherence:** Clear navigation path between EPICs view and project Kanban view
3. **Interface Consistency:** Unified interface that handles both EPICs and TASKs coherently
4. **Context Preservation:** User maintains navigation context when moving between hierarchy levels
5. **UX Flow Resolution:** Fix critical UX issues identified in Story 2.50 audit
6. **Breadcrumb Enhancement:** Enhanced navigation breadcrumb including 'Project Kanban' option
7. **Filter Toggle:** Interface toggle to show EPICs/TASKs/ALL in Kanban view
8. **Visual Coherence:** Consistent visual treatment between EPICs and TASKs in Kanban