import html
import re
from typing import Any, Dict, Optional, Tuple
import httpx

from app.core.logging_config import get_logger
from app.tools.base import BaseTool, PermissionLevel, ToolResult
from app.agents.security import URLSafetyGuard

logger = get_logger(__name__)

MAX_PAGE_BYTES = 512 * 1024  # 512 KB
MAX_CONTENT_CHARS = 10000


class WebPageReaderTool(BaseTool):
    """Tool for reading and extracting clean, readable text from public web pages."""

    name = "web_reader"
    description = (
        "Fetch and read readable article text and documentation from a web URL. "
        "Strips HTML tags, ads, and scripts, returning structured markdown text."
    )
    permission_level = PermissionLevel.AUTO
    parameters_schema = {
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": "Full web URL to fetch (http:// or https://).",
            },
        },
        "required": ["url"],
    }

    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        url = params.get("url", "").strip()
        if not url:
            return False, "'url' parameter cannot be empty."
        if not (url.startswith("http://") or url.startswith("https://")):
            return False, "URL must start with http:// or https://"
        return True, None

    def _clean_html(self, raw_html: str) -> Tuple[str, str]:
        """Extract title and clean readable text paragraphs from HTML."""
        # Extract title
        title_match = re.search(r"<title[^>]*>(.*?)</title>", raw_html, re.IGNORECASE | re.DOTALL)
        title = html.unescape(title_match.group(1)).strip() if title_match else "Web Page"

        # Remove scripts, styles, svg, and metadata
        cleaned = re.sub(r"<(script|style|svg|noscript|header|footer|nav)[^>]*>.*?</\1>", "", raw_html, flags=re.IGNORECASE | re.DOTALL)
        # Convert break tags and paragraphs to newlines
        cleaned = re.sub(r"<br\s*/?>", "\n", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"</p>", "\n\n", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"</li>", "\n", cleaned, flags=re.IGNORECASE)
        # Strip all other HTML tags
        cleaned = re.sub(r"<[^>]+>", "", cleaned)
        # Unescape HTML entities
        text = html.unescape(cleaned)
        # Normalize excessive whitespace
        text = re.sub(r"\n{3,}", "\n\n", text).strip()

        if len(text) > MAX_CONTENT_CHARS:
            text = text[:MAX_CONTENT_CHARS] + "\n\n[...Content truncated for length...]"

        return title, text

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        url = params["url"].strip()

        # SSRF and private-network protection
        is_safe, error_reason, _ = URLSafetyGuard.validate_url(url)
        if not is_safe:
            return ToolResult(
                success=False,
                action_taken=f"Fetch webpage '{url}'",
                error=f"Security Block: {error_reason}",
            )

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) NERO-Companion/1.0",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }

        try:
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True, headers=headers) as client:
                resp = await client.get(url)
                if resp.status_code >= 400:
                    return ToolResult(
                        success=False,
                        action_taken=f"Fetch webpage '{url}'",
                        error=f"HTTP {resp.status_code}: {resp.reason_phrase}",
                    )

                raw_bytes = resp.content[:MAX_PAGE_BYTES]
                raw_html = raw_bytes.decode(resp.encoding or "utf-8", errors="replace")
                title, clean_text = self._clean_html(raw_html)

                word_count = len(clean_text.split())

                return ToolResult(
                    success=True,
                    action_taken=f"Extracted content from '{url}'",
                    output={
                        "url": url,
                        "title": title,
                        "word_count": word_count,
                        "content": clean_text,
                    },
                    metadata={"summary": f"Read '{title}' ({word_count} words)"},
                )

        except Exception as e:
            logger.error("WebPageReaderTool error fetching '%s': %s", url, e)
            return ToolResult(
                success=False,
                action_taken=f"Fetch webpage '{url}'",
                error=f"Network error: {str(e)}",
            )
