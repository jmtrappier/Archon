"""
Task management tools for Archon MCP Server.

REFACTORED: This module now uses a modular structure with separate files:
- task_core.py: Core CRUD operations (find_tasks, manage_task, etc.)
- task_analytics.py: Analytics and health monitoring
- task_utils.py: Shared utilities and error handling

The old task_tools.py (2858 lines) has been split into smaller, focused modules.
"""

from .task_tools_refactored import register_task_tools

__all__ = ["register_task_tools"]
