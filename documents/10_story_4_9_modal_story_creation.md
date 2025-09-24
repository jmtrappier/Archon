# STORY 4.9 - Modal Story Creation

**Auteur:** Bob (Scrum Master)  
**Tags:** STORY, EPIC-4-Frontend, Modal, Story-Creation  
**Status:** draft  
**Version:** 1.0  
**Type:** spec  

## Epic
EPIC-4-Frontend

## Story Number
4.9

## Priority
HIGH

## Effort Estimate
3-4 hours

## Dependencies
- EpicView component
- StoryService API
- Existing modal patterns

## Story Statement
**As a** Product Owner managing EPICs in the TRAXIS system  
**I want** a functional story creation modal that allows me to create new STORIEs within EPICs  
**So that** I can efficiently break down EPICs into actionable stories without navigating away from my current context

## Context
- **User Need:** Product Owners need efficient way to break down EPICs into stories
- **Identified Gap:** Story creation functionality was identified as missing/incomplete during audit
- **Critical Requirement:** Context preservation - maintain EPIC context during story creation

## User Experience Flow
1. User clicks 'Create Story' button in EPIC view
2. Modal opens with EPIC context preserved
3. User fills required fields (title, description, priority)
4. Form validates in real-time
5. User clicks 'Create Story'
6. Loading state shown during API call
7. Success: Modal closes, story appears in EPIC view
8. Error: Error message shown, modal remains open

## Technical Specifications

### New Files
- src/features/projects/stories/components/StoryModal.tsx
- src/features/projects/stories/components/StoryCreationForm.tsx
- src/features/projects/stories/hooks/useCreateStory.ts
- src/features/projects/stories/types/story-modal.ts

### Modified Files
- src/features/projects/epics/components/EpicView.tsx (add Create Story button)
- src/features/projects/epics/components/EpicDetailView.tsx (if applicable)

### API Integration
- **Endpoint:** POST /api/epics/{epicId}/stories
- **Request Type:** CreateStoryRequest
- **Response Type:** Story (created story object)

### Form Validation
- **Title:** min 3 chars, max 100 chars
- **Description:** min 10 chars, max 1000 chars
- **Priority:** enum: low|medium|high|critical
- **Status:** enum: todo|doing|review|waiting|done, default: todo
- **MVP Flag:** boolean, default: false

## Tasks

### Task 1: Create StoryModal Component
**Subtasks:**
- Create StoryModal.tsx component with proper modal structure
- Implement modal overlay and dialog with accessible markup
- Add keyboard navigation support (ESC, Tab, Enter)
- Ensure mobile-responsive design
- Add proper focus management and ARIA labels

### Task 2: Implement Story Creation Form
**Subtasks:**
- Create form fields: Title (required), Description (required), Priority
- Add optional fields: MVP flag, Status (default: todo), Assignee
- Implement Zod validation schema for STORY creation
- Add real-time field validation with error messages
- Create form state management with React Hook Form

### Task 3: EPIC Context Integration
**Subtasks:**
- Pass EPIC ID automatically to modal from parent component
- Pre-populate EPIC reference in form
- Implement story creation API integration
- Handle successful creation: update parent view, show success message
- Close modal and refresh EPIC stories list

### Task 4: Error Handling and UX
**Subtasks:**
- Implement API error handling with user-friendly messages
- Add loading states during creation process
- Show validation errors inline with form fields
- Add success confirmation before closing modal
- Handle network errors and retry mechanisms

### Task 5: Integration with EpicView
**Subtasks:**
- Add 'Create Story' button in EpicView component
- Implement modal state management in parent component
- Pass EPIC context to modal when opening
- Update EpicView stories list after successful creation
- Ensure modal doesn't interfere with existing functionality

### Task 6: Testing and Validation
**Subtasks:**
- Unit tests for StoryModal component
- Form validation testing (required fields, formats)
- Integration tests with API calls
- Keyboard navigation testing
- Mobile responsiveness testing
- Error handling scenario testing

## Success Metrics
- Modal opens and closes correctly
- Form validation prevents invalid submissions
- Stories created successfully appear in EPIC view
- Keyboard navigation works properly
- Mobile responsiveness confirmed

## Acceptance Criteria
1. **Story Creation Modal:** Functional modal dialog for creating STORIEs within EPICs
2. **Form Validation:** Complete form validation with error handling and user feedback
3. **EPIC Context:** Modal maintains EPIC context and automatically links new STORY to current EPIC
4. **Required Fields:** Title, Description, Priority fields with proper validation
5. **Optional Fields:** MVP flag, Status, Assignee with sensible defaults
6. **Success Flow:** Successful creation updates EPIC view and closes modal
7. **Error Handling:** Clear error messages for validation failures and API errors
8. **UI Integration:** Modal integrates seamlessly with existing EPIC interface
9. **Keyboard Navigation:** Full keyboard accessibility (ESC to close, Tab navigation)
10. **Mobile Responsive:** Modal works properly on mobile devices