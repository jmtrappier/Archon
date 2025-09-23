"""
API package for Archon - modular FastAPI endpoints

This package organizes the API into logical modules:
- settings_api: Settings and credentials management
- mcp_api: MCP server management and tool execution
- knowledge_api: Knowledge base, crawling, and RAG operations
- projects_api: Core project management + MCP endpoints + admin (REFACTORED)
- epics_routes: Epic management endpoints (NEW)
- stories_routes: Story management endpoints (NEW)
- tasks_routes: Task and subtask management endpoints (NEW)
- documents_routes: Document and versioning endpoints (NEW)
"""

from .agent_chat_api import router as agent_chat_router
from .documents_routes import router as documents_router
from .epics_routes import router as epics_router
from .internal_api import router as internal_router
from .knowledge_api import router as knowledge_router
from .mcp_api import router as mcp_router
from .projects_api import router as projects_router
from .settings_api import router as settings_router
from .stories_routes import router as stories_router
from .tasks_routes import router as tasks_router

__all__ = [
    "settings_router",
    "mcp_router",
    "knowledge_router",
    "projects_router",
    "epics_router",
    "stories_router",
    "tasks_router",
    "documents_router",
    "agent_chat_router",
    "internal_router",
]