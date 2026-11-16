from pydantic import BaseModel


class HealthStatus(BaseModel):
    status: str  # "healthy" | "degraded" | "error"
    version: str
    environment: str
    timestamp: str
    database: str  # "connected" | "disconnected"
    uptime_seconds: float
    services: dict[str, str]  # service name -> status
