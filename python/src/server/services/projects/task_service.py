"""
Task Service - Refactored main orchestrator
Delegates to specialized services to maintain clean separation of concerns

This refactored service acts as a facade that delegates operations to:
- TaskCRUDService: Basic CRUD operations
- TaskAnalyticsService: Listing, counting, and metrics
- TaskHierarchyService: Subtasks and hierarchy operations
- TaskMoveService: Task movement and reordering
"""

from typing import Any, Dict, List, Optional
from ...utils import get_supabase_client
from ...config.logfire_config import logfire

from .task_crud_service import TaskCRUDService
from .task_analytics import TaskAnalyticsService
from .task_hierarchy_service import TaskHierarchyService
from .task_move_service import TaskMoveService


class TaskService:
    """
    Main TaskService that delegates to specialized services.
    Maintains backward compatibility while providing modular architecture.
    """

    def __init__(self, supabase_client=None):
        self.supabase_client = supabase_client or get_supabase_client()

        # Initialize specialized services
        self.crud = TaskCRUDService(self.supabase_client)
        self.analytics = TaskAnalyticsService(self.supabase_client)
        self.hierarchy = TaskHierarchyService(self.supabase_client)
        self.move = TaskMoveService(self.supabase_client)

    # ==================== CRUD OPERATIONS ====================

    async def create_task(self, *args, **kwargs) -> tuple[bool, dict[str, Any]]:
        """Create a new task - delegates to TaskCRUDService"""
        return await self.crud.create_task(*args, **kwargs)

    async def get_task(self, task_id: str) -> tuple[bool, dict[str, Any]]:
        """Get a single task - delegates to TaskCRUDService"""
        return await self.crud.get_task(task_id)

    async def update_task(self, *args, **kwargs) -> tuple[bool, dict[str, Any]]:
        """Update a task - delegates to TaskCRUDService"""
        return await self.crud.update_task(*args, **kwargs)

    async def archive_task(self, task_id: str) -> tuple[bool, dict[str, Any]]:
        """Archive a task - delegates to TaskCRUDService"""
        return await self.crud.archive_task(task_id)

    def validate_priority(self, priority: str) -> tuple[bool, str]:
        """Validate task priority - delegates to TaskCRUDService"""
        return self.crud.validate_priority(priority)

    def validate_status(self, status: str) -> tuple[bool, str]:
        """Validate task status - delegates to TaskCRUDService"""
        return self.crud.validate_status(status)

    def validate_assignee(self, assignee: str) -> tuple[bool, str]:
        """Validate task assignee - delegates to TaskCRUDService"""
        return self.crud.validate_assignee(assignee)

    # ==================== ANALYTICS & LISTING ====================

    async def list_tasks(self, *args, **kwargs) -> tuple[bool, dict[str, Any]]:
        """List tasks with filtering - delegates to TaskAnalyticsService"""
        return await self.analytics.list_tasks(*args, **kwargs)

    async def get_all_project_task_counts(self) -> tuple[bool, Dict[str, Dict[str, int]]]:
        """Get task counts for all projects - delegates to TaskAnalyticsService"""
        return await self.analytics.get_all_project_task_counts()

    async def get_tasks_by_story(self, story_id: str, include_archived: bool = False) -> tuple[bool, dict[str, Any]]:
        """Get tasks for a story - delegates to TaskAnalyticsService"""
        return await self.analytics.get_tasks_by_story(story_id, include_archived)

    async def get_tasks_with_epic_story_info(self, *args, **kwargs) -> tuple[bool, dict[str, Any]]:
        """Get tasks with epic/story info - delegates to TaskAnalyticsService"""
        return await self.analytics.get_tasks_with_epic_story_info(*args, **kwargs)

    # ==================== HIERARCHY OPERATIONS ====================

    async def create_subtask(self, *args, **kwargs) -> tuple[bool, dict[str, Any]]:
        """Create a subtask - delegates to TaskHierarchyService"""
        return await self.hierarchy.create_subtask(*args, **kwargs)

    async def get_subtasks_by_parent(self, parent_task_id: str, include_archived: bool = False) -> tuple[bool, dict[str, Any]]:
        """Get subtasks for a parent - delegates to TaskHierarchyService"""
        return await self.hierarchy.get_subtasks_by_parent(parent_task_id, include_archived)

    async def get_task_subtasks_recursive(self, task_id: str, include_archived: bool = False) -> tuple[bool, dict[str, Any]]:
        """Get all subtasks recursively - delegates to TaskHierarchyService"""
        return await self.hierarchy.get_task_subtasks_recursive(task_id, include_archived)

    async def get_task_hierarchy_path(self, task_id: str) -> tuple[bool, dict[str, Any]]:
        """Get hierarchy path for a task - delegates to TaskHierarchyService"""
        return await self.hierarchy.get_task_hierarchy_path(task_id)

    async def archive_task_with_subtasks(self, task_id: str, archived_by: str = "system") -> tuple[bool, dict[str, Any]]:
        """Archive task and all subtasks - delegates to TaskHierarchyService"""
        return await self.hierarchy.archive_task_with_subtasks(task_id, archived_by)

    async def get_task_hierarchy(self, project_id: str, include_archived: bool = False) -> tuple[bool, dict[str, Any]]:
        """Get complete task hierarchy - delegates to TaskHierarchyService"""
        return await self.hierarchy.get_task_hierarchy(project_id, include_archived)

    async def validate_hierarchy_consistency(self, project_id: str = None) -> tuple[bool, dict[str, Any]]:
        """Validate hierarchy integrity - delegates to TaskHierarchyService"""
        return await self.hierarchy.validate_hierarchy_consistency(project_id)

    async def get_subtasks_by_task(self, task_id: str, include_archived: bool = False) -> tuple[bool, dict[str, Any]]:
        """Get subtasks for a task - delegates to TaskHierarchyService"""
        return await self.hierarchy.get_subtasks_by_task(task_id, include_archived)

    # ==================== MOVE & REORDER OPERATIONS ====================

    async def update_task_with_hierarchy_validation(self, *args, **kwargs) -> tuple[bool, dict[str, Any]]:
        """Update task with hierarchy validation - delegates to TaskMoveService"""
        return await self.move.update_task_with_hierarchy_validation(*args, **kwargs)

    async def reorder_tasks_in_story(self, story_id: str, task_ids: List[str], moved_by: str = "User") -> tuple[bool, dict[str, Any]]:
        """Reorder tasks in a story - delegates to TaskMoveService"""
        return await self.move.reorder_tasks_in_story(story_id, task_ids, moved_by)

    async def reorder_subtasks_in_task(self, parent_task_id: str, subtask_ids: List[str], moved_by: str = "User") -> tuple[bool, dict[str, Any]]:
        """Reorder subtasks in a task - delegates to TaskMoveService"""
        return await self.move.reorder_subtasks_in_task(parent_task_id, subtask_ids, moved_by)

    async def move_task_to_story(self, *args, **kwargs) -> tuple[bool, dict[str, Any]]:
        """Move task to different story - delegates to TaskMoveService"""
        return await self.move.move_task_to_story(*args, **kwargs)

    async def move_subtask_to_parent(self, *args, **kwargs) -> tuple[bool, dict[str, Any]]:
        """Move subtask to different parent - delegates to TaskMoveService"""
        return await self.move.move_subtask_to_parent(*args, **kwargs)

    # ==================== UTILITY METHODS ====================

    async def _execute_query(self, query_func):
        """Common error handling wrapper - delegates to TaskCRUDService"""
        return await self.crud._execute_query(query_func)

    # Add property for backward compatibility with existing code that accesses db_pool
    @property
    def db_pool(self):
        """Backward compatibility property for database pool access"""
        # This is a placeholder - if existing code needs db_pool, we need to implement it
        # For now, log a warning if this is accessed
        logfire.warning("TaskService.db_pool accessed - consider refactoring to use supabase_client instead")
        return getattr(self.supabase_client, 'db_pool', None)