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

from ..services.projects.document_service import DocumentService
from ..services.projects.versioning_service import VersioningService

@router.get("/projects/{project_id}/docs")
async def list_project_documents(project_id: str, include_content: bool = False):
    """
    List all documents for a specific project.
    
    Args:
        project_id: Project UUID
        include_content: If True, includes full document content.
                        If False (default), returns metadata only.
    """
    try:
        logfire.info(
            f"Listing documents for project | project_id={project_id} | include_content={include_content}"
        )

        # Use DocumentService to list documents
        document_service = DocumentService()
        success, result = document_service.list_documents(project_id, include_content=include_content)

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        logfire.info(
            f"Documents listed successfully | project_id={project_id} | count={result.get('total_count', 0)} | lightweight={not include_content}"
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to list documents | error={str(e)} | project_id={project_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.post("/projects/{project_id}/docs")
async def create_project_document(project_id: str, request: CreateDocumentRequest):
    """Create a new document for a project."""
    try:
        logfire.info(
            f"Creating document for project | project_id={project_id} | title={request.title}"
        )

        # Use DocumentService to create document
        document_service = DocumentService()
        success, result = document_service.add_document(
            project_id=project_id,
            document_type=request.document_type,
            title=request.title,
            content=request.content,
            tags=request.tags,
            author=request.author,
        )

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=400, detail=result)

        logfire.info(
            f"Document created successfully | project_id={project_id} | doc_id={result['document']['id']}"
        )

        return {"message": "Document created successfully", "document": result["document"]}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to create document | error={str(e)} | project_id={project_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/projects/{project_id}/docs/{doc_id}")
async def get_project_document(project_id: str, doc_id: str):
    """Get a specific document from a project."""
    try:
        logfire.info(f"Getting document | project_id={project_id} | doc_id={doc_id}")

        # Use DocumentService to get document
        document_service = DocumentService()
        success, result = document_service.get_document(project_id, doc_id)

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        logfire.info(f"Document retrieved successfully | project_id={project_id} | doc_id={doc_id}")

        return result["document"]

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(
            f"Failed to get document | error={str(e)} | project_id={project_id} | doc_id={doc_id}"
        )
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.put("/projects/{project_id}/docs/{doc_id}")
async def update_project_document(project_id: str, doc_id: str, request: UpdateDocumentRequest):
    """Update a document in a project."""
    try:
        logfire.info(f"Updating document | project_id={project_id} | doc_id={doc_id}")

        # Build update fields
        update_fields = {}
        if request.title is not None:
            update_fields["title"] = request.title
        if request.content is not None:
            update_fields["content"] = request.content
        if request.tags is not None:
            update_fields["tags"] = request.tags
        if request.author is not None:
            update_fields["author"] = request.author

        # Use DocumentService to update document
        document_service = DocumentService()
        success, result = document_service.update_document(project_id, doc_id, update_fields)

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        logfire.info(f"Document updated successfully | project_id={project_id} | doc_id={doc_id}")

        return {"message": "Document updated successfully", "document": result["document"]}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(
            f"Failed to update document | error={str(e)} | project_id={project_id} | doc_id={doc_id}"
        )
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.delete("/projects/{project_id}/docs/{doc_id}")
async def delete_project_document(project_id: str, doc_id: str):
    """Delete a document from a project."""
    try:
        logfire.info(f"Deleting document | project_id={project_id} | doc_id={doc_id}")

        # Use DocumentService to delete document
        document_service = DocumentService()
        success, result = document_service.delete_document(project_id, doc_id)

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        logfire.info(f"Document deleted successfully | project_id={project_id} | doc_id={doc_id}")

        return {"message": "Document deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(
            f"Failed to delete document | error={str(e)} | project_id={project_id} | doc_id={doc_id}"
        )
        raise HTTPException(status_code=500, detail={"error": str(e)})


# ==================== VERSION MANAGEMENT ENDPOINTS ====================


@router.get("/projects/{project_id}/versions")
async def list_project_versions(project_id: str, field_name: str = None):
    """List version history for a project's JSONB fields."""
    try:
        logfire.info(
            f"Listing versions for project | project_id={project_id} | field_name={field_name}"
        )

        # Use VersioningService to list versions
        versioning_service = VersioningService()
        success, result = versioning_service.list_versions(project_id, field_name)

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        logfire.info(
            f"Versions listed successfully | project_id={project_id} | count={result.get('total_count', 0)}"
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to list versions | error={str(e)} | project_id={project_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.post("/projects/{project_id}/versions")
async def create_project_version(project_id: str, request: CreateVersionRequest):
    """Create a version snapshot for a project's JSONB field."""
    try:
        logfire.info(
            f"Creating version for project | project_id={project_id} | field_name={request.field_name}"
        )

        # Use VersioningService to create version
        versioning_service = VersioningService()
        success, result = versioning_service.create_version(
            project_id=project_id,
            field_name=request.field_name,
            content=request.content,
            change_summary=request.change_summary,
            change_type=request.change_type,
            document_id=request.document_id,
            created_by=request.created_by,
        )

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=400, detail=result)

        logfire.info(
            f"Version created successfully | project_id={project_id} | version_number={result['version_number']}"
        )

        return {"message": "Version created successfully", "version": result["version"]}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to create version | error={str(e)} | project_id={project_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/projects/{project_id}/versions/{field_name}/{version_number}")
async def get_project_version(project_id: str, field_name: str, version_number: int):
    """Get a specific version's content."""
    try:
        logfire.info(
            f"Getting version | project_id={project_id} | field_name={field_name} | version_number={version_number}"
        )

        # Use VersioningService to get version content
        versioning_service = VersioningService()
        success, result = versioning_service.get_version_content(
            project_id, field_name, version_number
        )

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        logfire.info(
            f"Version retrieved successfully | project_id={project_id} | field_name={field_name} | version_number={version_number}"
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(
            f"Failed to get version | error={str(e)} | project_id={project_id} | field_name={field_name} | version_number={version_number}"
        )
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.post("/projects/{project_id}/versions/{field_name}/{version_number}/restore")
async def restore_project_version(
    project_id: str, field_name: str, version_number: int, request: RestoreVersionRequest
):
    """Restore a project's JSONB field to a specific version."""
    try:
        logfire.info(
            f"Restoring version | project_id={project_id} | field_name={field_name} | version_number={version_number}"
        )

        # Use VersioningService to restore version
        versioning_service = VersioningService()
        success, result = versioning_service.restore_version(
            project_id=project_id,
            field_name=field_name,
            version_number=version_number,
            restored_by=request.restored_by,
        )

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        logfire.info(
            f"Version restored successfully | project_id={project_id} | field_name={field_name} | version_number={version_number}"
        )

        return {
            "message": f"Successfully restored {field_name} to version {version_number}",
            **result,
        }

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(
            f"Failed to restore version | error={str(e)} | project_id={project_id} | field_name={field_name} | version_number={version_number}"
        )
        raise HTTPException(status_code=500, detail={"error": str(e)})


# ==================== MIGRATION ENDPOINT (TEMPORARY) ====================

