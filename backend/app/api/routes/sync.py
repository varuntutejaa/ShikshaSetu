from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.sync import SyncRequest, SyncResponse
from app.services.sync_service import SyncService, get_sync_service

router = APIRouter(prefix="/api/sync", tags=["sync"])


@router.post("", response_model=SyncResponse)
async def sync_events(
    request: SyncRequest,
    db: AsyncSession = Depends(get_db),
    service: SyncService = Depends(get_sync_service),
) -> SyncResponse:
    processed, failed = await service.process_events(db, request.student_id, request.events)
    return SyncResponse(processed=processed, failed=failed)
