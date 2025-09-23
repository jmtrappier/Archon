# STORY 3.3 - MCP Functions Correction Specification

**Project**: Archon - TRAXIS
**Date**: 2025-09-23
**Status**: Draft Technical Specification

## 🎯 Executive Summary

Following Stories 4.8-4.9 implementation of the unified Kanban/EPICs interface, the MCP server instructions contain severely outdated guidance that misrepresents the current UX patterns, leading to poor user experience (audit score 6.65/10).

## 🔍 Investigation Findings

### ✅ What Changed in Stories 4.8-4.9

| **BEFORE (Obsolete)** | **AFTER (Stories 4.8-4.9)** |
|---|---|
| Separate EPIC and Task interfaces | **Unified Kanban interface** with EPICs integrated |
| Navigation confusion EPICs ↔ Kanban | **Toggle filter system**: EPICs/Tasks/Stories/All |
| Blocked user workflows | **Mixed mode**: EPICs and Tasks in same board |
| Separate creation flows | **Conditional buttons**: Add Epic/Task/Story based on filter |

### 🚨 MCP Instructions Problems Identified

**Location**: `/python/src/mcp_server/mcp_server.py:192-277`

#### Critical Issues:
1. **Obsolete Interface References**: Instructions reference separate EPIC management that no longer exists
2. **Missing Unified Patterns**: No guidance on toggle filter system (EPICs/Tasks/Stories/All)
3. **Wrong Context Awareness**: Functions don't understand current hierarchical integration
4. **Outdated Examples**: All workflow examples reflect old UI patterns

#### Specific Problems:
- Line 206: `"Get current task"` - doesn't mention unified view context
- Line 207: `"Search/List tasks"` - missing EPIC integration patterns
- Line 213: `"Get next task"` - doesn't describe filter-aware workflows
- Missing: Guidance on mixed mode EPICs + Tasks views
- Missing: Context about TasksTab unified interface
- Missing: Toggle filter implications for MCP workflows

## 📋 Technical Correction Plan

### Phase 1: MCP Instructions Update

**File**: `/python/src/mcp_server/mcp_server.py`
**Section**: `MCP_INSTRUCTIONS` (lines 192-277)

#### 1.1 Core Workflow Section Update (lines 203-214)
```yaml
BEFORE: Separate task management workflow
AFTER: Unified hierarchical workflow with filter awareness
```

**New Content**:
```markdown
## 📋 Core Workflow - Unified Kanban Interface

### Hierarchical Task Management Cycle
1. **Get current context**: Check current view filter (EPICs/Tasks/Stories/All)
2. **Navigate unified interface**: All hierarchy levels visible in TasksTab
3. **Filter-aware operations**: Operations adapt to current filter context
4. **Mixed mode awareness**: EPICs and Tasks can coexist in same view
5. **Context-driven actions**: Creation buttons appear based on active filters
```

#### 1.2 New Section: Interface Pattern Guidance
```markdown
## 🎯 Unified Kanban/EPICs Interface (Stories 4.8-4.9)

### Current UI Architecture:
- **TasksTab**: Central unified interface for all hierarchy levels
- **Toggle System**: EPICs | Tasks | Stories | All filter options
- **Mixed Mode**: EPICs and Tasks displayed together when filter = "All"
- **Conditional Actions**: Add buttons appear based on active filter context
- **Breadcrumb Navigation**: Seamless navigation between hierarchy levels

### MCP Context Awareness:
- When user mentions "Kanban" → refers to unified TasksTab interface
- EPICs are NOT separate → integrated in main Kanban board
- Filter context affects which items are visible/actionable
- Creation workflows depend on current filter state
```

#### 1.3 Tool Description Updates

**Enhanced find_tasks description**:
```markdown
- `find_tasks(query=None, task_id=None, filter_by=None, filter_value=None, per_page=10)`
  - **UNIFIED INTERFACE**: Works with TasksTab Kanban board showing EPICs + Tasks
  - **Filter Aware**: Results adapt to current view filter (EPICs/Tasks/All)
  - **Mixed Mode**: Can return both EPICs and Tasks when filter="All"
  - **Context Sensitive**: Respects current TasksTab filter selection
```

**Enhanced manage_task description**:
```markdown
- `manage_task(action, task_id=None, project_id=None, ...)`
  - **Hierarchy Aware**: Respects EPIC → STORY → TASK hierarchy
  - **Filter Context**: Creation considers current TasksTab filter
  - **Mixed Operations**: Can operate alongside EPICs in unified board
```

### Phase 2: Function Context Enhancement

#### 2.1 Add New Context-Aware Tools

**New Tool**: `get_interface_context`
```python
@mcp.tool()
async def get_interface_context(ctx: Context, project_id: str) -> str:
    """
    Get current TasksTab interface context and filter state.

    Args:
        project_id: Project UUID to get context for

    Returns:
        JSON with current filter state, view mode, and available actions

    Context Information:
        - Current filter: "epics" | "tasks" | "stories" | "all"
        - View mode: "board" | "table" | "tree"
        - Available actions: Which Add buttons are visible
        - Mixed mode status: Whether EPICs + Tasks shown together
    """
```

#### 2.2 Enhanced Tool Descriptions

**All hierarchy tools** (`find_tasks`, `find_epics`, `find_stories`) get enhanced descriptions:
- Mention unified TasksTab interface
- Explain filter context implications
- Describe mixed mode behavior
- Reference toggle system

### Phase 3: Documentation Integration

#### 3.1 Best Practices Section Update
```markdown
## 🎯 Updated Best Practices

1. **Unified Interface Awareness**: All operations consider TasksTab unified view
2. **Filter Context**: Always consider current filter when suggesting actions
3. **Mixed Mode Support**: Handle EPICs + Tasks coexistence gracefully
4. **Hierarchical Navigation**: Leverage breadcrumb navigation patterns
5. **Context-Driven Guidance**: Adapt suggestions to current view state
```

#### 3.2 Example Workflows Update
```markdown
## 📚 Example Workflows - Post Stories 4.8-4.9

### Epic Management in Unified Interface:
1. `find_epics(project_id="p-1")` → EPICs shown in main Kanban
2. Toggle filter to "EPICs" view → only EPICs visible
3. `manage_epic("create", ...)` → new EPIC appears in unified board

### Mixed Mode Operations:
1. Set filter to "All" → EPICs + Tasks displayed together
2. `find_tasks(project_id="p-1")` → returns both in unified context
3. Drag & drop between hierarchy levels in same interface

### Context-Aware Creation:
1. Filter = "EPICs" → Add Epic button visible
2. Filter = "Tasks" → Add Task button visible
3. Filter = "All" → Both buttons available
```

## 🧪 Validation Criteria

### Technical Validation:
- [ ] All MCP instructions reference unified TasksTab interface
- [ ] No obsolete separate EPIC interface references
- [ ] Filter context mentioned in all relevant tools
- [ ] Mixed mode behavior documented
- [ ] Examples reflect current UI patterns

### UX Validation:
- [ ] User guidance aligns with actual interface behavior
- [ ] Context-aware suggestions improve workflow
- [ ] No conflicting interface mental models
- [ ] Audit score improvement > 7.5/10

### Functional Validation:
- [ ] All MCP tools work correctly with unified interface
- [ ] Filter context properly handled
- [ ] Mixed mode operations function as expected
- [ ] Hierarchical navigation guidance accurate

## 📊 Success Metrics

| Metric | Current | Target |
|---|---|---|
| UX Audit Score | 6.65/10 | > 7.5/10 |
| Obsolete References | 100% | 0% |
| Context Awareness | Missing | Complete |
| User Confusion | High | Low |

## 🚀 Implementation Timeline

- **Phase 1**: MCP Instructions Update (30 min)
- **Phase 2**: Function Context Enhancement (45 min)
- **Phase 3**: Documentation Integration (15 min)
- **Testing**: Validation with Traxis server (30 min)

**Total Estimated Time**: 2 hours

## 📝 Next Steps

1. **Implement corrections** in `mcp_server.py`
2. **Test with Traxis** server to validate changes
3. **Measure improvement** in audit score
4. **Document lessons learned** for future Stories

---

**Critical Success Factor**: Complete alignment between MCP guidance and actual TasksTab unified interface post Stories 4.8-4.9.