import uuid

from sqlalchemy import select

from app.core.logging_config import get_logger
from app.database.models import AIProvider, ToolPermission
from app.database.session import AsyncSessionLocal, Base, engine

logger = get_logger(__name__)

_DEFAULT_AI_PROVIDERS = [
    {
        "name": "gemini",
        "provider_type": "cloud",
        "model_name": "gemini-1.5-pro",
        "is_active": False,
        "is_available": False,
        "config": "{}",
    },
    {
        "name": "openai",
        "provider_type": "cloud",
        "model_name": "gpt-4o",
        "is_active": False,
        "is_available": False,
        "config": "{}",
    },
    {
        "name": "ollama",
        "provider_type": "local",
        "model_name": "llama3.2",
        "is_active": False,
        "is_available": False,
        "config": "{}",
    },
]

_DEFAULT_TOOL_PERMISSIONS = [
    {"tool_name": "get_system_time", "permission_level": "auto", "is_enabled": True},
    {"tool_name": "read_system_status", "permission_level": "auto", "is_enabled": True},
    {"tool_name": "launch_application", "permission_level": "permission_required", "is_enabled": True},
    {"tool_name": "create_file", "permission_level": "permission_required", "is_enabled": True},
    {"tool_name": "delete_file", "permission_level": "explicit_confirmation", "is_enabled": True},
    {"tool_name": "execute_command", "permission_level": "explicit_confirmation", "is_enabled": True},
]


async def init_database() -> None:
    """Create all tables and seed initial data."""
    logger.info("Initialising database …")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    logger.info("Tables created.")

    async with AsyncSessionLocal() as session:
        # Seed AI providers
        for provider_data in _DEFAULT_AI_PROVIDERS:
            result = await session.execute(
                select(AIProvider).where(AIProvider.name == provider_data["name"])
            )
            if result.scalar_one_or_none() is None:
                session.add(AIProvider(id=str(uuid.uuid4()), **provider_data))
                logger.info("Seeded AI provider: %s", provider_data["name"])

        # Seed tool permissions
        for perm_data in _DEFAULT_TOOL_PERMISSIONS:
            result = await session.execute(
                select(ToolPermission).where(
                    ToolPermission.tool_name == perm_data["tool_name"]
                )
            )
            if result.scalar_one_or_none() is None:
                session.add(ToolPermission(id=str(uuid.uuid4()), **perm_data))
                logger.info("Seeded tool permission: %s", perm_data["tool_name"])

        await session.commit()

    logger.info("Database initialisation complete.")
