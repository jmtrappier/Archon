# CLAUDE.md - Unified Instructions Archon + Serena

This file provides directives for Claude Code when working on the **Archon - TRAXIS** project, strictly enforcing BMAD methodology with MCP integration.

---

## CRITICAL RULE: ARCHON-FIRST
Before any action, for ALL task management scenarios:

1. **VERIFY** MCP Archon server availability.  
2. **USE** Archon as the primary system of record (projects, epics, stories, tasks, docs).  
3. **FORBIDDEN**: managing or storing tasks/docs locally in the repo.  
4. **REMEMBER** project name and ID across sessions to avoid confusion.  

---

## Project Information Location

### `/traxis` and subfolders
All project instructions are referenced here:  

- `/traxis/PRPs/` - Planning docs and specifications  
- `/traxis/architecture/` - Technical architecture documentation  
- `/traxis/brainstorming/` - Brainstorming sessions and ideas  
- `/traxis/migration/` - Migration scripts and plans  
- `/traxis/tests/` - Test plans and validations  

### Critical Sources of Information
- **MCP Archon**: project progress state (*Archon - TRAXIS*) — tasks, EPICs, stories, roadmap, linked docs.  
- **MCP Serena**: codebase and technical memory — structure, patterns, conventions, code analysis.  

### TEST ONLY
- **MCP Traxis**: This MCP is only for testing purpose, it is the tool we are developing. DO NOT USE FOR PRODUCTION !!!

If key documentation is missing in Archon:  
1. Report it explicitly.  
2. Suggest adding it to Archon via `manage_document`.  
3. Propose creating the missing doc.  

---

## Archon Project Identification

### Critical Variables
```
PROJECT_NAME: "Archon - TRAXIS"
PROJECT_ID: a37b53ff-e647-44a4-998b-e920582ed376
GITHUB_REPO: "https://github.com/jmtrappier/Archon"
BRANCH="traxis"
```

**MANDATORY**: These must be maintained in EVERY session.

### Project Verification
```bash
# Always verify the current project
archon:find_projects(project_id="[PROJECT_ID]")

# Or search by name if ID unknown
archon:find_projects(query="Archon - TRAXIS")
```

---

## Integrated BMAD-Archon-Serena Workflow

### Typical Session
1. **Init**: verify project and tasks via Archon.  
2. **Research**: use Serena to analyze codebase.  
3. **Implement**: code based on research.  
4. **Update**: task status in Archon.  
5. **Validate**: run tests, optionally Playwright for visual validation.  
6. **Commit/Push**: after each work session.  

---

## Commits and Git Push

- **MANDATORY** after every work session.  
- **DETAILED**: include all changes, reasons, tests, links to Archon tasks.  
- **FREQUENT**: never accumulate large sessions without commits.  

Expected format:  
- Clear commit message referencing Archon STORY/TASK.  
- Additional doc in `/traxis/YYYY-MM-DD_commit.md`.  
- Always push to `traxis` branch.  

---

## Agent Discipline

- **Always** use Archon for project tracking.  
- **Always** use Serena for codebase analysis.  
- **Never** create or modify local tracking files.  
- **Always** update Archon after modifications.  
- **Always** commit/push after session, with full details.  

---

## Project Architecture Reminder

### Services
- **Archon MCP (8051)**: project/tasks/docs management.  
- **Serena MCP**: codebase memory and search.  
- **Frontend**: React + TypeScript (3737).  
- **Backend**: FastAPI (8181).  
- **Database**: Supabase (Postgres + pgvector).  

---

**CRITICAL REMINDER**:  
- Project *Archon - TRAXIS* is tracked **only in Archon**.  
- Code and research are handled via **Serena**.  
- Project instructions are referenced in `/traxis`.  
- After every session → **detailed commit + push is mandatory**.  
