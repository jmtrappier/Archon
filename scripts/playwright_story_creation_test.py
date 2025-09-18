#!/usr/bin/env python3
"""Ad-hoc Playwright scenario to validate story creation visibility without live backend."""

from __future__ import annotations

import asyncio
import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict
from urllib.parse import parse_qs, urlparse

import http.client

from playwright.async_api import async_playwright, expect

ROOT = Path(__file__).resolve().parent.parent
UI_DIR = ROOT / "archon-ui-main"
PREVIEW_PORT = 4173
BASE_URL = f"http://127.0.0.1:{PREVIEW_PORT}"
PROJECT_ID = "demo-project"
EPIC_ID = "epic-1"


def wait_for_preview(timeout: float = 30.0) -> None:
    """Wait until Vite preview server responds."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            conn = http.client.HTTPConnection("127.0.0.1", PREVIEW_PORT, timeout=2)
            conn.request("GET", "/")
            response = conn.getresponse()
            if response.status < 500:
                return
        except OSError:
            time.sleep(0.5)
        finally:
            try:
                conn.close()
            except Exception:
                pass
    raise RuntimeError("Preview server was not ready in time")


async def run_story_creation_test() -> None:
    project_payload: Dict[str, Any] = {
        "id": PROJECT_ID,
        "title": "Demo Project",
        "description": "Playwright stub project",
        "github_repo": "https://example.com/demo",
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-01-01T00:00:00Z",
        "pinned": False,
        "progress": 0,
    }

    now = "2025-01-01T00:00:00Z"
    epic_payload: Dict[str, Any] = {
        "id": EPIC_ID,
        "project_id": PROJECT_ID,
        "code": "E-01",
        "title": "Demo Epic",
        "description": "",
        "status": "todo",
        "priority": 50,
        "mvp_flag": False,
        "progress": 0,
        "created_at": now,
        "updated_at": now,
    }

    stories: Dict[str, Any] = {}

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        async def handler(route):  # type: ignore[no-untyped-def]
            url = route.request.url
            parsed = urlparse(url)
            path = parsed.path
            method = route.request.method

            headers = {"Content-Type": "application/json"}

            def fulfill(body: Any, status: int = 200) -> None:
                route.fulfill(status=status, body=json.dumps(body), headers=headers)

            if path == "/api/projects":
                fulfill({"projects": [project_payload]})
                return

            if path == f"/api/projects/{PROJECT_ID}/epics":
                payload = {
                    "data": [epic_payload],
                    "pagination": {"total": 1, "limit": 50, "offset": 0, "has_more": False},
                    "filters_applied": {},
                }
                fulfill(payload)
                return

            if path == f"/api/projects/{PROJECT_ID}/tasks":
                fulfill([])
                return

            if path == f"/api/projects/{PROJECT_ID}/features":
                fulfill({"features": [], "count": 0})
                return

            if path == f"/api/projects/{PROJECT_ID}/documents":
                fulfill({"documents": [], "count": 0})
                return

            if path == "/api/stories":
                query = parse_qs(parsed.query)
                if query.get("project_id", [None])[0] == PROJECT_ID:
                    fulfill({"stories": list(stories.values())})
                    return

            if method == "POST" and path == f"/api/epics/{EPIC_ID}/stories":
                payload = await route.request.post_data_json()
                story_id = f"story-{int(time.time() * 1000)}"
                new_story = {
                    "id": story_id,
                    "epic_id": EPIC_ID,
                    "project_id": PROJECT_ID,
                    "code": "S-01-01",
                    "title": payload.get("title", "Untitled"),
                    "description": payload.get("description", ""),
                    "status": payload.get("status", "todo"),
                    "priority": payload.get("priority", "medium"),
                    "mvp_flag": payload.get("mvp_flag", False),
                    "progress": 0,
                    "created_at": now,
                    "updated_at": now,
                }
                stories[story_id] = new_story
                fulfill(new_story, status=201)
                return

            fulfill({"detail": f"Unhandled stub for {method} {path}"}, status=404)

        await page.route("**/api/**", handler)

        await page.goto(f"{BASE_URL}/projects/{PROJECT_ID}?view=board&filter=stories")

        # Ensure the Stories filter is active (idempotent)
        await page.get_by_role("button", name="Stories").click()

        # Open the creation modal
        await page.get_by_role("button", name="Add Story").click()

        await page.get_by_label("Title *").fill("Playwright Story")

        # Select the Epic in the Radix select dropdown
        await page.get_by_role("button", name="Select an EPIC").click()
        await page.get_by_role("option", name="Demo Epic").click()

        await page.get_by_label("Description").fill("Story created via Playwright stub test")

        await page.get_by_role("button", name="Create Story").click()

        # Wait for mutation + refetch to complete (toast visible)
        await expect(page.get_by_text("Story created successfully!")).to_be_visible()

        # Ensure the new story card shows up in the board immediately
        await expect(page.get_by_text("Playwright Story")).to_be_visible()

        await browser.close()


def main() -> int:
    preview_cmd = [
        "npm",
        "run",
        "preview",
        "--",
        f"--port={PREVIEW_PORT}",
        "--host=127.0.0.1",
    ]

    env = dict(os.environ, NODE_ENV="production")
    preview_proc = subprocess.Popen(
        preview_cmd,
        cwd=str(UI_DIR),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    try:
        wait_for_preview()
        asyncio.run(run_story_creation_test())
        print("Playwright story creation check succeeded.")
        return 0
    except Exception as exc:
        print(f"Playwright story creation check failed: {exc}", file=sys.stderr)
        return 1
    finally:
        preview_proc.send_signal(signal.SIGINT)
        try:
            preview_proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            preview_proc.kill()


if __name__ == "__main__":
    sys.exit(main())
