import platform
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple
import psutil

from app.core.logging_config import get_logger
from app.tools.base import BaseTool, PermissionLevel, ToolResult

logger = get_logger(__name__)


def _format_bytes_to_gb(bytes_val: int) -> float:
    return round(bytes_val / (1024**3), 2)


def _format_seconds(seconds: float) -> str:
    hours, rem = divmod(int(seconds), 3600)
    minutes, secs = divmod(rem, 60)
    if hours > 0:
        return f"{hours}h {minutes}m {secs}s"
    elif minutes > 0:
        return f"{minutes}m {secs}s"
    return f"{secs}s"


class SystemMonitorTool(BaseTool):
    """Tool for reading live Windows system telemetry including CPU, RAM,

    disk usage, battery level, and uptime.
    """

    name = "system_monitor"
    description = (
        "Monitor real-time system metrics: CPU usage %, RAM %, battery status, "
        "disk space, and system uptime."
    )
    permission_level = PermissionLevel.AUTO
    parameters_schema = {
        "type": "object",
        "properties": {
            "metrics": {
                "type": "array",
                "items": {"type": "string", "enum": ["cpu", "memory", "battery", "disk", "uptime", "all"]},
                "default": ["all"],
                "description": "Specific metrics to collect. Defaults to 'all'.",
            }
        },
    }

    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        return True, None

    def get_quick_stats(self) -> Dict[str, Any]:
        """Synchronous quick extraction of critical stats for fast polling."""
        # Non-blocking CPU reading
        cpu_percent = psutil.cpu_percent(interval=None)
        mem = psutil.virtual_memory()

        battery_info = None
        try:
            battery = psutil.sensors_battery()
            if battery:
                battery_info = {
                    "percent": battery.percent,
                    "power_plugged": battery.power_plugged,
                    "secs_left": battery.secsleft if battery.secsleft > 0 else None,
                }
        except Exception:
            pass

        # Disks
        disks = []
        for part in psutil.disk_partitions(all=False):
            try:
                usage = psutil.disk_usage(part.mountpoint)
                disks.append({
                    "device": part.device,
                    "mountpoint": part.mountpoint,
                    "total_gb": _format_bytes_to_gb(usage.total),
                    "used_gb": _format_bytes_to_gb(usage.used),
                    "free_gb": _format_bytes_to_gb(usage.free),
                    "percent": usage.percent,
                })
            except (PermissionError, OSError):
                continue

        uptime_seconds = time.time() - psutil.boot_time()

        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "cpu_percent": cpu_percent,
            "memory": {
                "total_gb": _format_bytes_to_gb(mem.total),
                "used_gb": _format_bytes_to_gb(mem.used),
                "available_gb": _format_bytes_to_gb(mem.available),
                "percent": mem.percent,
            },
            "battery": battery_info,
            "disks": disks,
            "uptime": {
                "seconds": int(uptime_seconds),
                "formatted": _format_seconds(uptime_seconds),
            },
            "platform": {
                "system": platform.system(),
                "release": platform.release(),
                "machine": platform.machine(),
            },
        }

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        try:
            stats = self.get_quick_stats()
            summary = (
                f"CPU: {stats['cpu_percent']}% | "
                f"RAM: {stats['memory']['percent']}% ({stats['memory']['used_gb']}/{stats['memory']['total_gb']} GB) | "
                f"Uptime: {stats['uptime']['formatted']}"
            )
            if stats["battery"]:
                status = "Charging" if stats["battery"]["power_plugged"] else "Discharging"
                summary += f" | Battery: {stats['battery']['percent']}% ({status})"

            return ToolResult(
                success=True,
                action_taken="read_system_telemetry",
                output=stats,
                metadata={"summary": summary},
            )
        except Exception as e:
            logger.error("SystemMonitorTool execution failed: %s", e)
            return ToolResult(
                success=False,
                action_taken="read_system_telemetry",
                error=str(e),
            )
