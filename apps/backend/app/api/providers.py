import json
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging_config import get_logger
from app.database.models import AIProvider
from app.database.session import get_db
from app.intelligence.router import ai_router

logger = get_logger(__name__)

router = APIRouter(prefix="/providers", tags=["providers"])


class ProviderTestRequest(BaseModel):
    provider: str


class ProviderConfigRequest(BaseModel):
    provider: str
    api_key: Optional[str] = None
    model: Optional[str] = None
    base_url: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("")
async def list_providers(db: AsyncSession = Depends(get_db)) -> dict:
    """List all AI providers with active and configuration status."""
    router_providers = await ai_router.list_providers()

    # Query database to synchronize persisted states
    result = await db.execute(select(AIProvider))
    db_providers = {p.name: p for p in result.scalars().all()}

    providers_info = []
    for p in router_providers:
        name = p["name"]
        db_p = db_providers.get(name)
        is_active = (db_p.is_active if db_p else False) or p["is_active"]
        providers_info.append({
            "name": name,
            "provider_type": p["provider_type"],
            "default_model": (db_p.model_name if db_p and db_p.model_name else p["default_model"]),
            "is_configured": p["is_configured"],
            "is_active": is_active,
        })

    return {
        "providers": providers_info,
        "active_provider": ai_router.get_active_provider_name(),
    }


@router.post("/test")
async def test_provider(request: ProviderTestRequest) -> dict:
    """Test connection to a specific AI provider."""
    result = await ai_router.test_provider(request.provider)
    return result


@router.post("/config")
async def configure_provider(
    request: ProviderConfigRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Configure credentials, model, or active status for a provider."""
    name = request.provider.strip().lower()
    provider_inst = ai_router.get_provider(name)
    if not provider_inst:
        raise HTTPException(status_code=404, detail=f"Provider '{name}' not found")

    # Update provider instance
    if request.api_key is not None and hasattr(provider_inst, "set_api_key"):
        provider_inst.set_api_key(request.api_key)

    if request.model is not None and hasattr(provider_inst, "set_model"):
        provider_inst.set_model(request.model)

    if request.base_url is not None and hasattr(provider_inst, "set_base_url"):
        provider_inst.set_base_url(request.base_url)

    if request.is_active:
        ai_router.set_active_provider(name)
        # Deactivate all in DB, activate this one
        await db.execute(update(AIProvider).values(is_active=False))

    # Persist or update in DB
    result = await db.execute(select(AIProvider).where(AIProvider.name == name))
    db_record = result.scalar_one_or_none()
    if db_record:
        if request.model:
            db_record.model_name = request.model
        if request.is_active is not None:
            db_record.is_active = request.is_active
        db_record.is_available = provider_inst.is_configured
        cfg = json.loads(db_record.config or "{}")
        if request.base_url:
            cfg["base_url"] = request.base_url
        db_record.config = json.dumps(cfg)
    else:
        db.add(
            AIProvider(
                id=str(uuid.uuid4()),
                name=name,
                provider_type=provider_inst.provider_type,
                model_name=request.model or provider_inst.default_model,
                is_active=bool(request.is_active),
                is_available=provider_inst.is_configured,
                config=json.dumps({"base_url": request.base_url} if request.base_url else {}),
            )
        )

    await db.commit()

    return {
        "status": "success",
        "provider": name,
        "is_configured": provider_inst.is_configured,
        "is_active": name == ai_router.get_active_provider_name(),
        "model": provider_inst.default_model,
    }
