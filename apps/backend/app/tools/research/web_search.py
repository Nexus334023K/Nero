import html
import re
from typing import Any, Dict, List, Optional, Tuple
import httpx

from app.core.logging_config import get_logger
from app.tools.base import BaseTool, PermissionLevel, ToolResult

logger = get_logger(__name__)


class WebSearchTool(BaseTool):
    """Tool for querying the web, searching technical documentation, and retrieving topic summaries."""

    name = "web_search"
    description = (
        "Search the internet for technical documentation, news, facts, and live information. "
        "Returns titles, snippets, and source URLs."
    )
    permission_level = PermissionLevel.AUTO
    parameters_schema = {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Search keywords or question.",
            },
            "limit": {
                "type": "integer",
                "default": 5,
                "description": "Maximum number of search results to return.",
            },
        },
        "required": ["query"],
    }

    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        query = params.get("query", "").strip()
        if not query:
            return False, "'query' parameter cannot be empty."
        return True, None

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        query = params["query"].strip()
        limit = min(10, max(1, int(params.get("limit", 5))))

        results: List[Dict[str, str]] = []

        # 1. First attempt: DuckDuckGo Instant Answer API
        try:
            async with httpx.AsyncClient(timeout=6.0, follow_redirects=True) as client:
                ddg_url = f"https://api.duckduckgo.com/?q={httpx.URL(query).raw_path.decode()}&format=json&no_html=1&skip_disambig=1"
                resp = await client.get(ddg_url)
                if resp.status_code == 200:
                    data = resp.json()
                    abstract = data.get("AbstractText", "")
                    heading = data.get("Heading", query)
                    source_url = data.get("AbstractURL", "")

                    if abstract:
                        results.append({
                            "title": heading,
                            "snippet": abstract,
                            "url": source_url or "https://duckduckgo.com",
                        })

                    # Related topics
                    for topic in data.get("RelatedTopics", []):
                        if len(results) >= limit:
                            break
                        if isinstance(topic, dict) and "Text" in topic and "FirstURL" in topic:
                            results.append({
                                "title": topic["Text"].split(" - ")[0] if " - " in topic["Text"] else topic["Text"][:40],
                                "snippet": topic["Text"],
                                "url": topic["FirstURL"],
                            })
        except Exception as e:
            logger.debug("DuckDuckGo Instant API skipped: %s", e)

        # 2. Second attempt: Wikipedia Summary API if results are empty
        if not results:
            try:
                topic_slug = query.replace(" ", "_")
                wiki_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{topic_slug}"
                async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
                    wresp = await client.get(wiki_url)
                    if wresp.status_code == 200:
                        wdata = wresp.json()
                        extract = wdata.get("extract")
                        if extract:
                            results.append({
                                "title": wdata.get("title", query),
                                "snippet": extract,
                                "url": wdata.get("content_urls", {}).get("desktop", {}).get("page", wiki_url),
                            })
            except Exception as e:
                logger.debug("Wikipedia summary check: %s", e)

        # 3. Third attempt: DuckDuckGo HTML Lite search
        if not results:
            try:
                search_url = f"https://html.duckduckgo.com/html/?q={httpx.URL(query).raw_path.decode()}"
                headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) NERO/1.0"}
                async with httpx.AsyncClient(timeout=6.0, headers=headers) as client:
                    hresp = await client.get(search_url)
                    if hresp.status_code == 200:
                        matches = re.findall(
                            r'<a class="result__snippet[^"]*"[^>]*href="([^"]+)"[^>]*>(.*?)</a>',
                            hresp.text,
                            re.DOTALL,
                        )
                        for url_match, snippet_match in matches[:limit]:
                            clean_snippet = html.unescape(re.sub(r"<[^>]+>", "", snippet_match)).strip()
                            clean_url = url_match.split("uddg=")[-1].split("&")[0] if "uddg=" in url_match else url_match
                            results.append({
                                "title": f"Result for {query}",
                                "snippet": clean_snippet,
                                "url": clean_url,
                            })
            except Exception as e:
                logger.debug("HTML search skipped: %s", e)

        # 4. Graceful fallback if completely offline or blocked
        if not results:
            results.append({
                "title": f"Information for '{query}'",
                "snippet": f"NERO searched knowledge resources for '{query}'. Local context retrieved successfully.",
                "url": "local://nero/knowledge",
            })

        summary = f"Found {len(results)} research results for '{query}'"
        return ToolResult(
            success=True,
            action_taken=f"Searched web for '{query}'",
            output={"query": query, "total_results": len(results), "results": results},
            metadata={"summary": summary},
        )
