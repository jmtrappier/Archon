"""
REFACTORED: Task management tools for Archon MCP Server.

This file now acts as a bridge to the new modular structure:
- task_core.py: Core CRUD operations (find_tasks, manage_task, etc.)
- task_analytics.py: Analytics and health monitoring
- task_utils.py: Shared utilities and error handling

The original 2858-line file has been backed up as task_tools_backup_2858_lines.py
and split into smaller, focused modules for better maintainability.
"""

# Import the refactored registration function - version with cleaner structure
from .task_tools_refactored import register_task_tools

# Export the same interface as before
__all__ = ["register_task_tools"]

# This uses the refactored modular version with proper function organization