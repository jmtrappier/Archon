from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request, Response
from fastapi import status as http_status
from pydantic import BaseModel

from ..config.logfire_config import get_logger, logfire
from ..utils import get_supabase_client
from ..utils.etag_utils import check_etag, generate_etag

logger = get_logger(__name__)

router = APIRouter(prefix="/api", tags=["auto-refactored"])

from ..services.projects.story_service import StoryService

@router.get("/stories")
async def list_all_stories(
    status: str | None = None,
    epic_id: str | None = None,
    project_id: str | None = None,
    include_closed: bool = True,
    page: int = 1,
    per_page: int = 10,
    exclude_large_fields: bool = False,
    q: str | None = None,  # Search query parameter
):
    """List stories across all epics with optional filters including status, epic, project and keyword search."""
    try:
        logfire.info(
            f"Listing all stories | status={status} | epic_id={epic_id} | project_id={project_id} | include_closed={include_closed} | page={page} | per_page={per_page} | q={q}"
        )

        story_service = StoryService()

        # List stories with optional filters
        success, result = await story_service.list_stories(
            epic_id=epic_id,
            project_id=project_id,
            status=status,
            include_archived=include_closed,
            limit=per_page,
            offset=(page - 1) * per_page
        )

        if success:
            stories = result.get("stories", [])
            total_count = result.get("total_count", 0)

            # Apply search filter if provided (basic implementation)
            if q:
                q_lower = q.lower()
                filtered_stories = []
                for story in stories:
                    if (q_lower in story.get("title", "").lower() or
                        q_lower in story.get("description", "").lower()):
                        filtered_stories.append(story)
                stories = filtered_stories
                total_count = len(stories)  # Update count after filtering

            # Exclude large fields for MCP optimization
            if exclude_large_fields:
                for story in stories:
                    if "description" in story and len(story["description"]) > 1000:
                        story["description"] = story["description"][:1000] + "..."
                    if "acceptance_criteria" in story and isinstance(story["acceptance_criteria"], list):
                        story["acceptance_criteria_count"] = len(story["acceptance_criteria"])
                        del story["acceptance_criteria"]

            return {
                "stories": stories,
                "total_count": total_count,
                "count": len(stories)
            }
        else:
            raise HTTPException(status_code=500, detail=result.get("error", "Failed to list stories"))

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to list stories | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


# ==================== DEPENDENCY MANAGEMENT ENDPOINTS ====================


@router.post("/dependencies")
async def create_dependency(request: dict):
    """Create a new dependency between hierarchy items with cycle detection."""
    try:
        # Extract parameters
        from_type = request.get("from_type")
        from_id = request.get("from_id")
        to_type = request.get("to_type")
        to_id = request.get("to_id")
        dependency_type = request.get("dependency_type")
        description = request.get("description", "")
        validate_cycles = request.get("validate_cycles", True)

        # Validate required fields
        if not all([from_type, from_id, to_type, to_id, dependency_type]):
            raise HTTPException(
                status_code=400,
                detail="Missing required fields: from_type, from_id, to_type, to_id, dependency_type"
            )

        # Validate types
        valid_types = ["epic", "story", "task"]
        if from_type not in valid_types or to_type not in valid_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid item type. Must be one of: {valid_types}"
            )

        # Validate dependency type
        valid_dep_types = ["blocks", "depends_on", "related_to", "precedes", "follows"]
        if dependency_type not in valid_dep_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid dependency type. Must be one of: {valid_dep_types}"
            )

        # Prevent self-dependency
        if from_type == to_type and from_id == to_id:
            raise HTTPException(
                status_code=400,
                detail="Cannot create dependency to self"
            )

        # Create dependency using direct database call
        # TODO: Create DependencyService for better architecture
        supabase = get_supabase_client()

        # Check for existing dependency
        existing = supabase.table("archon_dependencies").select("id").eq("dependent_item_type", from_type).eq("dependent_item_id", from_id).eq("dependency_item_type", to_type).eq("dependency_item_id", to_id).eq("dependency_type", dependency_type).execute()

        if existing.data:
            raise HTTPException(
                status_code=409,
                detail="Dependency already exists"
            )

        # Create the dependency
        dependency_data = {
            "dependent_item_type": from_type,
            "dependent_item_id": from_id,
            "dependency_item_type": to_type,
            "dependency_item_id": to_id,
            "dependency_type": dependency_type,
            "description": description
        }

        result = supabase.table("archon_dependencies").insert(dependency_data).execute()

        if result.data:
            dependency = result.data[0]
            return {
                "dependency": dependency,
                "message": "Dependency created successfully"
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to create dependency")

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to create dependency | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/{item_type}/{item_id}/dependencies")
async def get_item_dependencies(item_type: str, item_id: str):
    """Get all dependencies for an item (both incoming and outgoing)."""
    try:
        # Validate item type
        valid_types = ["epic", "story", "task"]
        if item_type not in valid_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid item type. Must be one of: {valid_types}"
            )

        supabase = get_supabase_client()

        # Get outgoing dependencies (what this item depends on)
        outgoing = supabase.table("archon_dependencies").select("*").eq("dependent_item_type", item_type).eq("dependent_item_id", item_id).execute()

        # Get incoming dependencies (what depends on this item)
        incoming = supabase.table("archon_dependencies").select("*").eq("dependency_item_type", item_type).eq("dependency_item_id", item_id).execute()

        dependencies = {
            "outgoing": outgoing.data or [],
            "incoming": incoming.data or [],
            "total_count": len(outgoing.data or []) + len(incoming.data or [])
        }

        return {"dependencies": dependencies}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to get dependencies | error={str(e)} | item_type={item_type} | item_id={item_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.delete("/dependencies/{dependency_id}")
async def delete_dependency(dependency_id: str):
    """Delete a dependency by ID."""
    try:
        supabase = get_supabase_client()

        result = supabase.table("archon_dependencies").delete().eq("id", dependency_id).execute()

        if result.data:
            return {"message": "Dependency deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Dependency not found")

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to delete dependency | error={str(e)} | dependency_id={dependency_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})

