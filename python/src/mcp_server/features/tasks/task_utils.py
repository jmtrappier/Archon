"""
Shared utilities for task management MCP tools.
"""

import os
import traceback
from typing import Dict, Any
import httpx

# Import the proper modules from existing infrastructure
from src.server.config.service_discovery import get_api_url
from src.mcp_server.utils.timeout_config import get_default_timeout
from src.mcp_server.utils.error_handling import MCPErrorFormatter


DEFAULT_PAGE_SIZE = 10


async def normalize_api_response(response_data: Any, data_key: str) -> list:
    """
    Normalize API response format to extract the actual data array.

    Args:
        response_data: Raw response from API
        data_key: Expected key name (e.g., "tasks", "epics", "stories")

    Returns:
        Normalized list of items
    """
    if isinstance(response_data, list):
        return response_data
    elif isinstance(response_data, dict):
        if data_key in response_data:
            return response_data[data_key]
        elif "data" in response_data:
            return response_data["data"]
        else:
            return []
    else:
        return []


async def make_api_request(
    client: httpx.AsyncClient,
    endpoint: str,
    params: Dict[str, Any] | None = None,
    data_key: str | None = None
) -> tuple[bool, Any]:
    """
    Make a standardized API request with error handling.

    Args:
        client: HTTP client
        endpoint: API endpoint path
        params: Request parameters
        data_key: Expected data key for normalization

    Returns:
        Tuple of (success, result)
    """
    try:
        api_url = get_api_url()
        from urllib.parse import urljoin

        url = urljoin(api_url, endpoint)
        response = await client.get(url, params=params or {})
        response.raise_for_status()

        result = response.json()

        if data_key:
            normalized_data = await normalize_api_response(result, data_key)
            return True, {"data": normalized_data, "raw": result}
        else:
            return True, result

    except Exception as e:
        return False, {
            "error": str(e),
            "exception_type": type(e).__name__,
            "traceback": traceback.format_exc()
        }