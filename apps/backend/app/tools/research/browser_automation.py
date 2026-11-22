import asyncio
import os
from pathlib import Path
import subprocess
import urllib.parse
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.core.logging_config import get_logger
from app.tools.base import BaseTool, PermissionLevel, ToolResult

logger = get_logger(__name__)


class BrowserAutomationTool(BaseTool):
    """Automates web browsing: open URLs, Google search, extract content, download files."""

    name = "browser_automation"
    description = (
        "Interact with web browsers: open URLs, perform web searches, navigate pages, "
        "download files from the internet, and extract webpage contents."
    )
    permission_level = PermissionLevel.AUTO
    parameters_schema = {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["open_url", "search_web", "download_file", "extract_content"],
                "description": "Browser action to execute.",
            },
            "url": {
                "type": "string",
                "description": "Target webpage URL to open or download.",
            },
            "query": {
                "type": "string",
                "description": "Search query for search_web.",
            },
            "download_path": {
                "type": "string",
                "description": "Target save path for downloaded files (e.g. 'Downloads/file.pdf').",
            },
            "browser": {
                "type": "string",
                "enum": ["default", "chrome", "edge"],
                "default": "default",
                "description": "Browser application to use.",
            },
        },
        "required": ["action"],
    }

    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        action = params.get("action")
        if not action:
            return False, "Missing 'action' parameter."
        if action == "open_url" and not params.get("url"):
            return False, "Action 'open_url' requires 'url'."
        if action == "search_web" and not params.get("query"):
            return False, "Action 'search_web' requires 'query'."
        if action == "download_file" and not params.get("url"):
            return False, "Action 'download_file' requires 'url'."
        return True, None

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        action = params["action"]

        try:
            if action == "open_url":
                return self._open_url(params["url"], params.get("browser", "default"))
            elif action == "search_web":
                return await self._search_web(params["query"], params.get("browser", "default"))
            elif action == "download_file":
                return await self._download_file(params["url"], params.get("download_path"))
            elif action == "extract_content":
                return await self._extract_content(params["url"])
            else:
                return ToolResult(success=False, action_taken=action, error=f"Unknown action '{action}'")
        except Exception as e:
            logger.error("BrowserAutomationTool error on '%s': %s", action, e)
            return ToolResult(success=False, action_taken=action, error=str(e))

    def _open_url(self, url: str, browser: str = "default") -> ToolResult:
        target_url = url.strip()
        if not target_url.startswith(("http://", "https://")):
            target_url = f"https://{target_url}"

        if browser == "chrome":
            res = subprocess.run(["cmd", "/c", "start", "chrome", target_url], check=False)
        elif browser == "edge":
            res = subprocess.run(["cmd", "/c", "start", "msedge", target_url], check=False)
        else:
            import webbrowser
            webbrowser.open(target_url)

        return ToolResult(
            success=True,
            action_taken="open_url",
            output={"url": target_url, "browser": browser, "verified": True},
        )

    async def _search_web(self, query: str, browser: str = "default") -> ToolResult:
        encoded = urllib.parse.quote(query)
        search_url = f"https://www.google.com/search?q={encoded}"
        self._open_url(search_url, browser)

        # Also perform background search fetch for AI synthesis
        from app.tools.research.web_search import WebSearchTool
        search_tool = WebSearchTool()
        fetch_res = await search_tool.execute({"query": query})

        return ToolResult(
            success=True,
            action_taken="search_web",
            output={
                "query": query,
                "opened_url": search_url,
                "browser": browser,
                "quick_results": fetch_res.output if fetch_res.success else None,
            },
        )

    async def _download_file(self, url: str, custom_dest: Optional[str] = None) -> ToolResult:
        user_home = Path.home()
        dest_dir = user_home / "Downloads"
        dest_dir.mkdir(parents=True, exist_ok=True)

        if custom_dest:
            target_path = Path(custom_dest)
            if not target_path.is_absolute():
                target_path = dest_dir / custom_dest
        else:
            filename = url.split("/")[-1].split("?")[0] or "downloaded_file"
            target_path = dest_dir / filename

        target_path.parent.mkdir(parents=True, exist_ok=True)

        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return ToolResult(
                    success=False,
                    action_taken="download_file",
                    error=f"Download failed with HTTP status {resp.status_code}",
                )
            target_path.write_bytes(resp.content)

        return ToolResult(
            success=target_path.exists(),
            action_taken="download_file",
            output={
                "saved_to": str(target_path),
                "size_bytes": len(resp.content),
                "url": url,
            },
        )

    async def _extract_content(self, url: str) -> ToolResult:
        from app.tools.research.web_reader import WebPageReaderTool
        reader = WebPageReaderTool()
        return await reader.execute({"url": url})
