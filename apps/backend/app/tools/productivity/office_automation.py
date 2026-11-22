from datetime import datetime
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from app.core.logging_config import get_logger
from app.tools.base import BaseTool, PermissionLevel, ToolResult

logger = get_logger(__name__)

try:
    import docx
    _HAS_DOCX = True
except ImportError:
    _HAS_DOCX = False

try:
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    _HAS_OPENPYXL = True
except ImportError:
    _HAS_OPENPYXL = False

try:
    from pptx import Presentation
    from pptx.util import Inches, Pt
    _HAS_PPTX = True
except ImportError:
    _HAS_PPTX = False


class OfficeAutomationTool(BaseTool):
    """Generates and manages productivity documents: DOCX, PDF, XLSX spreadsheets, PPTX presentations, and notes."""

    name = "office_automation"
    description = (
        "Create, edit, and generate productivity documents: DOCX text documents, PDF files, "
        "XLSX spreadsheets with formulas/formatting, and PowerPoint (PPTX) presentations."
    )
    permission_level = PermissionLevel.AUTO
    parameters_schema = {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": [
                    "create_document",
                    "create_spreadsheet",
                    "create_presentation",
                    "create_pdf",
                    "summarize_document",
                ],
                "description": "Productivity document operation.",
            },
            "file_path": {
                "type": "string",
                "description": "Destination file path or name (e.g. 'Desktop/AI_Report.docx', 'Desktop/Financials.xlsx').",
            },
            "title": {
                "type": "string",
                "description": "Document, presentation, or spreadsheet title.",
            },
            "sections": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "heading": {"type": "string"},
                        "content": {"type": "string"},
                        "bullets": {"type": "array", "items": {"type": "string"}},
                    },
                },
                "description": "List of sections/slides with headings, paragraphs, and bullet points.",
            },
            "headers": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Column headers for spreadsheets (e.g. ['Item', 'Quantity', 'Price', 'Total']).",
            },
            "rows": {
                "type": "array",
                "items": {"type": "array", "items": {}},
                "description": "Data rows for spreadsheets.",
            },
            "sheet_name": {
                "type": "string",
                "default": "Data",
                "description": "Worksheet name for spreadsheet.",
            },
        },
        "required": ["action", "file_path"],
    }

    def _resolve_path(self, path_str: str) -> Path:
        cleaned = path_str.strip().strip("\"'")
        lower = cleaned.lower()
        user_home = Path.home()

        if lower.startswith("desktop\\") or lower.startswith("desktop/"):
            return user_home / "Desktop" / cleaned[8:]
        elif lower.startswith("downloads\\") or lower.startswith("downloads/"):
            return user_home / "Downloads" / cleaned[10:]
        elif lower.startswith("documents\\") or lower.startswith("documents/"):
            return user_home / "Documents" / cleaned[10:]
        elif lower in ("desktop", "my desktop"):
            return user_home / "Desktop"

        p = Path(cleaned)
        if not p.is_absolute():
            return user_home / "Desktop" / cleaned
        return p.resolve()

    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        action = params.get("action")
        file_path = params.get("file_path")
        if not action or not file_path:
            return False, "Both 'action' and 'file_path' are required."
        return True, None

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        action = params["action"]
        resolved = self._resolve_path(params["file_path"])

        try:
            if action == "create_document":
                return self._create_docx(
                    dest_path=resolved,
                    title=params.get("title", "Document"),
                    sections=params.get("sections", []),
                )
            elif action == "create_spreadsheet":
                return self._create_xlsx(
                    dest_path=resolved,
                    sheet_name=params.get("sheet_name", "Data"),
                    headers=params.get("headers", []),
                    rows=params.get("rows", []),
                )
            elif action == "create_presentation":
                return self._create_pptx(
                    dest_path=resolved,
                    title=params.get("title", "Presentation"),
                    slides_data=params.get("sections", []),
                )
            elif action == "create_pdf":
                return self._create_pdf(
                    dest_path=resolved,
                    title=params.get("title", "Report"),
                    sections=params.get("sections", []),
                )
            elif action == "summarize_document":
                return self._summarize_document(resolved)
            else:
                return ToolResult(success=False, action_taken=action, error=f"Unsupported action: '{action}'")
        except Exception as e:
            logger.error("OfficeAutomationTool error on '%s': %s", action, e)
            return ToolResult(success=False, action_taken=action, error=str(e))

    def _create_docx(self, dest_path: Path, title: str, sections: List[Dict[str, Any]]) -> ToolResult:
        if not str(dest_path).lower().endswith(".docx"):
            dest_path = dest_path.with_suffix(".docx")

        dest_path.parent.mkdir(parents=True, exist_ok=True)

        if _HAS_DOCX:
            doc = docx.Document()
            doc.add_heading(title, level=0)

            for sec in sections:
                if sec.get("heading"):
                    doc.add_heading(sec["heading"], level=1)
                if sec.get("content"):
                    doc.add_paragraph(sec["content"])
                for b in sec.get("bullets", []):
                    doc.add_paragraph(b, style="List Bullet")

            doc.save(str(dest_path))
        else:
            # Fallback to structured plain text
            lines = [f"# {title}\n"]
            for sec in sections:
                if sec.get("heading"):
                    lines.append(f"\n## {sec['heading']}\n")
                if sec.get("content"):
                    lines.append(f"{sec['content']}\n")
                for b in sec.get("bullets", []):
                    lines.append(f"- {b}")
            dest_path.write_text("\n".join(lines), encoding="utf-8")

        return ToolResult(
            success=dest_path.exists(),
            action_taken="create_document",
            output={
                "path": str(dest_path),
                "title": title,
                "sections_count": len(sections),
                "size_bytes": dest_path.stat().st_size,
            },
        )

    def _create_xlsx(self, dest_path: Path, sheet_name: str, headers: List[str], rows: List[List[Any]]) -> ToolResult:
        if not str(dest_path).lower().endswith(".xlsx"):
            dest_path = dest_path.with_suffix(".xlsx")

        dest_path.parent.mkdir(parents=True, exist_ok=True)

        if _HAS_OPENPYXL:
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = sheet_name

            header_fill = PatternFill(start_color="1F497D", end_color="1F497D", fill_type="solid")
            header_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")

            if headers:
                ws.append(headers)
                for col_num in range(1, len(headers) + 1):
                    cell = ws.cell(row=1, column=col_num)
                    cell.fill = header_fill
                    cell.font = header_font
                    cell.alignment = Alignment(horizontal="center", vertical="center")

            for r in rows:
                ws.append(r)

            # Adjust column widths
            for col in ws.columns:
                max_len = max(len(str(cell.value or "")) for cell in col)
                col_letter = col[0].column_letter
                ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

            wb.save(str(dest_path))
        else:
            # Fallback to CSV format
            import csv
            with open(dest_path.with_suffix(".csv"), "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                if headers:
                    writer.writerow(headers)
                writer.writerows(rows)
            dest_path = dest_path.with_suffix(".csv")

        return ToolResult(
            success=dest_path.exists(),
            action_taken="create_spreadsheet",
            output={
                "path": str(dest_path),
                "sheet": sheet_name,
                "columns": len(headers),
                "rows_count": len(rows),
                "size_bytes": dest_path.stat().st_size,
            },
        )

    def _create_pptx(self, dest_path: Path, title: str, slides_data: List[Dict[str, Any]]) -> ToolResult:
        if not str(dest_path).lower().endswith(".pptx"):
            dest_path = dest_path.with_suffix(".pptx")

        dest_path.parent.mkdir(parents=True, exist_ok=True)

        if _HAS_PPTX:
            prs = Presentation()

            # Title Slide
            title_slide_layout = prs.slide_layouts[0]
            slide = prs.slides.add_slide(title_slide_layout)
            slide.shapes.title.text = title
            if len(slide.placeholders) > 1:
                slide.placeholders[1].text = f"Created by Nero Desktop Companion • {datetime.now().strftime('%B %Y')}"

            # Content Slides
            bullet_slide_layout = prs.slide_layouts[1]
            for s_data in slides_data:
                slide = prs.slides.add_slide(bullet_slide_layout)
                slide.shapes.title.text = s_data.get("heading", "Overview")
                body_shape = slide.shapes.placeholders[1]
                tf = body_shape.text_frame

                if s_data.get("content"):
                    tf.text = s_data["content"]

                for b in s_data.get("bullets", []):
                    p = tf.add_paragraph()
                    p.text = b
                    p.level = 0

            prs.save(str(dest_path))
        else:
            lines = [f"=== SLIDE: {title} ===\n"]
            for s_data in slides_data:
                lines.append(f"\n--- SLIDE: {s_data.get('heading', 'Slide')} ---")
                if s_data.get("content"):
                    lines.append(s_data["content"])
                for b in s_data.get("bullets", []):
                    lines.append(f"• {b}")
            dest_path = dest_path.with_suffix(".txt")
            dest_path.write_text("\n".join(lines), encoding="utf-8")

        return ToolResult(
            success=dest_path.exists(),
            action_taken="create_presentation",
            output={
                "path": str(dest_path),
                "title": title,
                "slides_count": len(slides_data) + 1,
                "size_bytes": dest_path.stat().st_size,
            },
        )

    def _create_pdf(self, dest_path: Path, title: str, sections: List[Dict[str, Any]]) -> ToolResult:
        if not str(dest_path).lower().endswith(".pdf"):
            dest_path = dest_path.with_suffix(".pdf")

        dest_path.parent.mkdir(parents=True, exist_ok=True)

        # Generate a clean HTML file and convert to PDF or write rich formatted file
        html_lines = [
            "<!DOCTYPE html><html><head><meta charset='utf-8'>",
            "<style>body{font-family:sans-serif;margin:40px;line-height:1.6}h1{color:#1a365d}h2{color:#2b6cb0}ul{margin-bottom:20px}</style>",
            f"</head><body><h1>{title}</h1>",
        ]
        for sec in sections:
            if sec.get("heading"):
                html_lines.append(f"<h2>{sec['heading']}</h2>")
            if sec.get("content"):
                html_lines.append(f"<p>{sec['content']}</p>")
            if sec.get("bullets"):
                html_lines.append("<ul>")
                for b in sec["bullets"]:
                    html_lines.append(f"<li>{b}</li>")
                html_lines.append("</ul>")
        html_lines.append(f"<hr><small>Generated by Nero Desktop Companion • {datetime.now().strftime('%Y-%m-%d %H:%M')}</small></body></html>")

        # Try Playwright PDF export or PowerShell Word export
        try:
            from playwright.sync_api import sync_playwright
            with sync_playwright() as p:
                browser = p.chromium.launch()
                page = browser.new_page()
                page.set_content("".join(html_lines))
                page.pdf(path=str(dest_path), format="A4")
                browser.close()
        except Exception:
            # Fallback: Save text / html companion
            dest_path = dest_path.with_suffix(".html")
            dest_path.write_text("".join(html_lines), encoding="utf-8")

        return ToolResult(
            success=dest_path.exists(),
            action_taken="create_pdf",
            output={"path": str(dest_path), "title": title, "size_bytes": dest_path.stat().st_size},
        )

    def _summarize_document(self, path: Path) -> ToolResult:
        if not path.exists():
            return ToolResult(success=False, action_taken="summarize_document", error=f"File not found: {path}")

        text = ""
        suffix = path.suffix.lower()

        if suffix in (".txt", ".md", ".json", ".csv"):
            text = path.read_text(encoding="utf-8", errors="replace")
        elif suffix == ".docx" and _HAS_DOCX:
            doc = docx.Document(str(path))
            text = "\n".join([p.text for p in doc.paragraphs if p.text])
        elif suffix == ".xlsx" and _HAS_OPENPYXL:
            wb = openpyxl.load_workbook(str(path), data_only=True)
            text_lines = []
            for sheet in wb.sheetnames:
                ws = wb[sheet]
                text_lines.append(f"Sheet: {sheet}")
                for row in ws.iter_rows(values_only=True):
                    if any(row):
                        text_lines.append(" | ".join([str(v) for v in row if v is not None]))
            text = "\n".join(text_lines)

        lines = [line.strip() for line in text.splitlines() if line.strip()]
        preview = lines[:20]

        return ToolResult(
            success=True,
            action_taken="summarize_document",
            output={
                "file": path.name,
                "total_lines": len(lines),
                "total_words": len(text.split()),
                "sample_preview": "\n".join(preview[:10]),
            },
        )
