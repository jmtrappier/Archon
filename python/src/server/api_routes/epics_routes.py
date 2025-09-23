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

from ..services.projects.epic_service import EpicService
from ..services.projects.story_service import StoryService

@router.get("/projects/{project_id}/epics")
async def list_project_epics(
    project_id: str,
    request: Request,
    response: Response,
    status: str | None = None,
    priority: str | None = None,
    search: str | None = None,
    sort: str | None = "created_at",
    order: str | None = "desc",
    limit: int = 50,
    offset: int = 0,
    if_none_match: str | None = Header(None)
):
    """List all epics for a project with standardized pagination/filtering following API design standards."""
    try:
        # Validate pagination parameters
        limit = min(max(1, limit), 100)  # Between 1-100 as per standards
        offset = max(0, offset)

        logfire.debug(
            f"Listing project epics | project_id={project_id} | status={status} | search={search} | "
            f"sort={sort} | order={order} | limit={limit} | offset={offset} | etag={if_none_match}"
        )

        # Use EpicService with full filtering support
        epic_service = EpicService()
        try:
            # Get total count for pagination
            total_count = await epic_service.count_epics(
                project_id=project_id,
                status=status,
                priority=priority,
                search=search
            )

            # Get filtered and paginated epics
            epics = await epic_service.list_epics(
                project_id=project_id,
                status=status,
                priority=priority,
                search=search,
                sort=sort,
                order=order,
                limit=limit,
                offset=offset
            )
        except Exception as e:
            logger.error(f"Failed to list project epics | error={str(e)} | project_id={project_id}")
            raise HTTPException(status_code=500, detail={"error": str(e)})

        # Build standardized response with pagination
        response_data = {
            "data": epics,
            "pagination": {
                "total": total_count,
                "limit": limit,
                "offset": offset,
                "has_more": (offset + limit) < total_count
            },
            "filters_applied": {}
        }

        # Add applied filters to response
        if status:
            response_data["filters_applied"]["status"] = status
        if priority:
            response_data["filters_applied"]["priority"] = priority
        if search:
            response_data["filters_applied"]["search"] = search
        if sort != "created_at":
            response_data["filters_applied"]["sort"] = sort
        if order != "desc":
            response_data["filters_applied"]["order"] = order

        # Generate ETag from response data (excluding timestamps for consistency)
        etag_data = {
            "count": len(epics),
            "total": total_count,
            "project_id": project_id,
            "filters": response_data["filters_applied"],
            "pagination": {"limit": limit, "offset": offset}
        }
        current_etag = generate_etag(etag_data)

        # Check if client's ETag matches (304 Not Modified)
        if check_etag(if_none_match, current_etag):
            response.status_code = 304
            response.headers["ETag"] = current_etag
            response.headers["Cache-Control"] = "private, must-revalidate"
            response.headers["Last-Modified"] = datetime.utcnow().isoformat()
            logfire.debug(f"Epics unchanged, returning 304 | project_id={project_id} | etag={current_etag}")
            return None

        # Set ETag headers for successful response
        response.headers["ETag"] = current_etag
        response.headers["Cache-Control"] = "private, must-revalidate"
        response.headers["Last-Modified"] = datetime.utcnow().isoformat()

        logfire.debug(
            f"Project epics retrieved | project_id={project_id} | epic_count={len(epics)} | "
            f"total={total_count} | etag={current_etag}"
        )

        return response_data

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to list project epics | error={str(e)} | project_id={project_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.post("/projects/{project_id}/epics")
async def create_project_epic(project_id: str, request: CreateEpicRequest):
    """Create a new epic for a project."""
    try:
        logfire.info(
            f"Creating epic for project | project_id={project_id} | title={request.title}"
        )

        # Use EpicService to create epic
        epic_service = EpicService()
        success, result = await epic_service.create_epic(
            project_id=project_id,
            title=request.title,
            description=request.description or "",
            status=request.status or "todo",
            priority=request.priority or "medium",
            # mvp_flag=request.mvp_flag or False,  # Not in TRAXIS schema
            business_value=request.business_value,
        )

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=400, detail=result)

        logfire.info(
            f"Epic created successfully | project_id={project_id} | epic_id={result['epic']['id']}"
        )

        return {"message": "Epic created successfully", "epic": result["epic"]}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to create epic | error={str(e)} | project_id={project_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/epics/story-counts")
async def get_epics_story_counts(
    request: Request,
    response: Response,
):
    """
    Get story counts for all epics in a single batch query.
    Optimized endpoint to avoid N+1 query problem.

    Returns counts grouped by epic_id with todo, doing, review, waiting, and done counts.
    """
    try:
        # Get If-None-Match header for ETag comparison
        if_none_match = request.headers.get("If-None-Match")

        logfire.debug(f"Getting story counts for all epics | etag={if_none_match}")

        # Use StoryService to get batch story counts
        story_service = StoryService()
        success, result = await story_service.get_all_epic_story_counts()

        if not success:
            logfire.error(f"Failed to get story counts | error={result.get('error')}")
            raise HTTPException(status_code=500, detail=result)

        # Generate ETag from counts data
        etag_data = {
            "counts": result,
            "count": len(result)
        }
        current_etag = generate_etag(etag_data)

        # Check if client's ETag matches (304 Not Modified)
        if check_etag(if_none_match, current_etag):
            response.status_code = 304
            response.headers["ETag"] = current_etag
            response.headers["Cache-Control"] = "no-cache, must-revalidate"
            logfire.debug(f"Story counts unchanged, returning 304 | etag={current_etag}")
            return None

        # Set ETag headers for successful response
        response.headers["ETag"] = current_etag
        response.headers["Cache-Control"] = "no-cache, must-revalidate"
        response.headers["Last-Modified"] = datetime.utcnow().isoformat()

        logfire.debug(
            f"Story counts retrieved | epic_count={len(result)} | etag={current_etag}"
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to get story counts | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/epics/{epic_id}")
async def get_epic(epic_id: str):
    """Get a specific epic by ID."""
    try:
        logfire.info(f"Getting epic | epic_id={epic_id}")

        # Use EpicService to get the epic
        epic_service = EpicService()
        epic = await epic_service.get_epic(epic_id)

        logfire.info(
            f"Epic retrieved successfully | epic_id={epic_id} | project_id={epic.get('project_id')}"
        )

        return epic

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to get epic | error={str(e)} | epic_id={epic_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.put("/epics/{epic_id}")
async def update_epic(epic_id: str, request: UpdateEpicRequest):
    """Update an epic."""
    try:
        logfire.info(f"Updating epic | epic_id={epic_id}")

        # Build update fields dictionary
        update_fields = {}
        if request.title is not None:
            update_fields["title"] = request.title
        if request.description is not None:
            update_fields["description"] = request.description
        if request.status is not None:
            update_fields["status"] = request.status
        if request.priority is not None:
            update_fields["priority"] = request.priority
        # if request.mvp_flag is not None:  # Not in TRAXIS schema
        #     update_fields["mvp_flag"] = request.mvp_flag
        if request.business_value is not None:
            update_fields["business_value"] = request.business_value

        # Use EpicService to update the epic
        epic_service = EpicService()
        updated_epic = await epic_service.update_epic(epic_id, update_fields)

        logfire.info(
            f"Epic updated successfully | epic_id={epic_id} | project_id={updated_epic.get('project_id')} | updated_fields={list(update_fields.keys())}"
        )

        return {"message": "Epic updated successfully", "epic": updated_epic}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to update epic | error={str(e)} | epic_id={epic_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.delete("/epics/{epic_id}")
async def delete_epic(epic_id: str):
    """Delete an epic (soft delete)."""
    try:
        logfire.info(f"Deleting epic | epic_id={epic_id}")

        # Use EpicService to delete the epic
        epic_service = EpicService()
        success, result = await epic_service.delete_epic(epic_id)

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            elif "already archived" in result.get("error", "").lower():
                raise HTTPException(status_code=409, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        logfire.info(f"Epic deleted successfully | epic_id={epic_id}")

        return {"message": result.get("message", "Epic deleted successfully")}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to delete epic | error={str(e)} | epic_id={epic_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


# ==================== STORY MANAGEMENT ENDPOINTS ====================


@router.get("/epics/{epic_id}/stories")
async def list_epic_stories(
    epic_id: str,
    request: Request,
    response: Response,
    status: str | None = None,
    if_none_match: str | None = Header(None)
):
    """List all stories for a specific epic with ETag support and optional filtering."""
    try:
        logfire.debug(
            f"Listing epic stories | epic_id={epic_id} | status={status} | etag={if_none_match}"
        )

        # Use StoryService to list stories
        story_service = StoryService()
        success, result = await story_service.list_stories(
            epic_id=epic_id,
            status=status
        )

        if not success:
            raise HTTPException(status_code=500, detail=result)

        stories = result.get("stories", [])

        # Generate ETag from story data (excluding timestamps for consistency)
        etag_data = {
            "stories": [{
                "id": story.get("id"),
                "title": story.get("title"),
                "status": story.get("status"),
                "priority": story.get("priority"),
                "story_points": story.get("story_points"),
                # "mvp_flag": story.get("mvp_flag")  # Not in TRAXIS schema
            } for story in stories],
            "epic_id": epic_id,
            "count": len(stories)
        }
        current_etag = generate_etag(etag_data)

        # Check if client's ETag matches (304 Not Modified)
        if check_etag(if_none_match, current_etag):
            response.status_code = 304
            response.headers["ETag"] = current_etag
            response.headers["Cache-Control"] = "no-cache, must-revalidate"
            response.headers["Last-Modified"] = datetime.utcnow().isoformat()
            logfire.debug(f"Stories unchanged, returning 304 | epic_id={epic_id} | etag={current_etag}")
            return None

        # Set ETag headers for successful response
        response.headers["ETag"] = current_etag
        response.headers["Cache-Control"] = "no-cache, must-revalidate"
        response.headers["Last-Modified"] = datetime.utcnow().isoformat()

        logfire.debug(
            f"Epic stories retrieved | epic_id={epic_id} | story_count={len(stories)} | etag={current_etag}"
        )

        return stories

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to list epic stories | error={str(e)} | epic_id={epic_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.put("/epics/{epic_id}/stories/reorder")
async def reorder_epic_stories(epic_id: str, request: ReorderStoriesRequest):
    """Reorder stories within an epic."""
    try:
        story_service = StoryService()
        success, result = await story_service.reorder_stories_in_epic(epic_id, request.story_ids)

        if not success:
            detail = result.get("error") if isinstance(result, dict) else result
            # Treat missing stories as bad request to encourage clients to refresh
            raise HTTPException(status_code=400, detail=result if isinstance(result, dict) else {"error": detail})

        logfire.info(
            f"Stories reordered | epic_id={epic_id} | count={len(request.story_ids)}"
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to reorder stories | error={str(e)} | epic_id={epic_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.post("/epics/{epic_id}/stories")
async def create_epic_story(epic_id: str, request: CreateStoryRequest):
    """Create a new story for an epic."""
    try:
        logfire.info(
            f"Creating story for epic | epic_id={epic_id} | title={request.title}"
        )

        # Convert priority string to integer for service layer
        def convert_priority_to_int(priority_str: str | None) -> int:
            """Convert priority string to integer expected by service layer."""
            priority_map = {
                "low": 25,
                "medium": 50,
                "high": 75,
                "critical": 100
            }
            return priority_map.get(priority_str or "medium", 50)

        # Use StoryService to create story
        story_service = StoryService()
        result = await story_service.create_story(
            epic_id=epic_id,
            title=request.title,
            description=request.description or "",
            status=request.status or "todo",
            priority=convert_priority_to_int(request.priority),  # 🟢 FIXED: Convert to int
            story_points=request.story_points,
            acceptance_criteria=request.acceptance_criteria,
            # mvp_flag=request.mvp_flag or False,  # Not in TRAXIS schema
        )

        # Check if result indicates an error
        if "error" in result:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=400, detail=result.get("error"))

        logfire.info(
            f"Story created successfully | epic_id={epic_id} | story_id={result.get('id', 'unknown')}"
        )

        return {"message": "Story created successfully", "story": result}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to create story | error={str(e)} | epic_id={epic_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/stories/{story_id}")
async def get_story(story_id: str):
    """Get a specific story by ID."""
    try:
        logfire.info(f"Getting story | story_id={story_id}")

        # Use StoryService to get the story
        story_service = StoryService()
        success, result = story_service.get_story(story_id)

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        story = result["story"]

        logfire.info(
            f"Story retrieved successfully | story_id={story_id} | epic_id={story.get('epic_id')}"
        )

        return story

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to get story | error={str(e)} | story_id={story_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.put("/stories/{story_id}")
async def update_story(story_id: str, request: UpdateStoryRequest):
    """Update a story."""
    try:
        logfire.info(f"Updating story | story_id={story_id}")

        # Build update fields dictionary
        update_fields = {}
        if request.title is not None:
            update_fields["title"] = request.title
        if request.description is not None:
            update_fields["description"] = request.description
        if request.status is not None:
            update_fields["status"] = request.status
        if request.priority is not None:
            # Convert priority string to integer for service layer
            def convert_priority_to_int(priority_str: str | None) -> int:
                """Convert priority string to integer expected by service layer."""
                priority_map = {
                    "low": 25,
                    "medium": 50,
                    "high": 75,
                    "critical": 100
                }
                return priority_map.get(priority_str or "medium", 50)
            update_fields["priority"] = convert_priority_to_int(request.priority)
        if request.story_points is not None:
            update_fields["story_points"] = request.story_points
        if request.acceptance_criteria is not None:
            update_fields["acceptance_criteria"] = request.acceptance_criteria
        # if request.mvp_flag is not None:  # Not in TRAXIS schema
        #     update_fields["mvp_flag"] = request.mvp_flag

        # Use StoryService to update the story
        story_service = StoryService()
        success, result = await story_service.update_story(
            story_id=story_id,
            **update_fields  # 🟢 FIXED: Unpack dict to individual parameters
        )

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        updated_story = result["story"]

        logfire.info(
            f"Story updated successfully | story_id={story_id} | epic_id={updated_story.get('epic_id')} | updated_fields={list(update_fields.keys())}"
        )

        return {"message": "Story updated successfully", "story": updated_story}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to update story | error={str(e)} | story_id={story_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.put("/stories/{story_id}/move")
async def move_story(story_id: str, request: MoveStoryRequest):
    """Move a story to a different epic and optionally reposition it."""
    try:
        story_service = StoryService()
        success, result = await story_service.move_story_to_epic(
            story_id=story_id,
            target_epic_id=request.target_epic_id,
            target_position=request.target_position,
            moved_by=request.moved_by,
        )

        if not success:
            detail = result if isinstance(result, dict) else {"error": result}
            message = detail.get("error", "")
            if "not found" in message.lower():
                raise HTTPException(status_code=404, detail=detail)
            raise HTTPException(status_code=400, detail=detail)

        logfire.info(
            f"Story moved | story_id={story_id} | target_epic_id={request.target_epic_id} | position={request.target_position}"
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to move story | error={str(e)} | story_id={story_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.delete("/stories/{story_id}")
async def delete_story(story_id: str):
    """Delete a story (soft delete)."""
    try:
        logfire.info(f"Deleting story | story_id={story_id}")

        # Use StoryService to delete the story
        story_service = StoryService()
        success, result = await story_service.delete_story(story_id)

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            elif "already archived" in result.get("error", "").lower():
                raise HTTPException(status_code=409, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        logfire.info(f"Story deleted successfully | story_id={story_id}")

        return {"message": result.get("message", "Story deleted successfully")}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to delete story | error={str(e)} | story_id={story_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


# ==================== GENERIC HIERARCHICAL ENDPOINTS ====================


@router.get("/epics")
async def list_all_epics(
    status: str | None = None,
    project_id: str | None = None,
    include_closed: bool = True,
    page: int = 1,
    per_page: int = 10,
    exclude_large_fields: bool = False,
    q: str | None = None,  # Search query parameter
):
    """List epics across all projects with optional filters including status, project and keyword search."""
    try:
        logfire.info(
            f"Listing all epics | status={status} | project_id={project_id} | include_closed={include_closed} | page={page} | per_page={per_page} | q={q}"
        )

        epic_service = EpicService()

        # Build filters for epic service
        filters = {}
        if status:
            filters["status"] = status
        if not include_closed:
            filters["exclude_done"] = True

        # Use project-specific listing if project_id provided
        if project_id:
            try:
                epics = await epic_service.list_epics(
                    project_id=project_id,
                    status=status,
                    include_archived=include_closed,
                    limit=per_page,
                    offset=(page - 1) * per_page
                )
                total_count = len(epics)  # For now, basic count
            except Exception as e:
                logger.error(f"Failed to list epics | error={str(e)}")
                raise HTTPException(status_code=500, detail={"error": str(e)})
        else:
            # This would need a new method in EpicService to list across all projects
            # For now, return empty result with appropriate message
            return {
                "epics": [],
                "total_count": 0,
                "message": "Cross-project epic listing not yet implemented. Use project_id parameter."
            }

        # Apply search filter if provided (basic implementation)
        if q:
            q_lower = q.lower()
            filtered_epics = []
            for epic in epics:
                if (q_lower in epic.get("title", "").lower() or
                    q_lower in epic.get("description", "").lower()):
                    filtered_epics.append(epic)
            epics = filtered_epics
            total_count = len(epics)  # Update count after filtering

        # Exclude large fields for MCP optimization
        if exclude_large_fields:
            for epic in epics:
                if "description" in epic and len(epic["description"]) > 1000:
                    epic["description"] = epic["description"][:1000] + "..."

        return {
            "epics": epics,
            "total_count": total_count,
            "count": len(epics)
        }

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to list epics | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


