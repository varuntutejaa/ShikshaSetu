"""Offline sync: idempotent ingestion of events queued by the Android app.

Each event carries a client-generated `event_id`. Re-submitting the same
(student_id, event_id) pair is a no-op — it's recognised as already
processed and reported back as such, rather than re-applied. This is what
lets the Android app safely retry a sync batch after a dropped connection.
"""

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.progress import StudentProgress, SyncEvent
from app.schemas.sync import SyncEventIn

logger = logging.getLogger("shikshasetu.sync")


class SyncService:
    async def process_events(
        self, db: AsyncSession, student_id: uuid.UUID, events: list[SyncEventIn]
    ) -> tuple[list[str], list[str]]:
        processed: list[str] = []
        failed: list[str] = []

        for event in events:
            existing = await db.execute(
                select(SyncEvent).where(
                    SyncEvent.student_id == student_id, SyncEvent.event_id == event.event_id
                )
            )
            existing_row = existing.scalar_one_or_none()
            if existing_row is not None:
                # Already seen — idempotent success regardless of prior outcome
                # so the client can stop retrying it either way.
                processed.append(event.event_id)
                continue

            sync_row = SyncEvent(
                student_id=student_id,
                event_id=event.event_id,
                event_type=event.type,
                payload=event.payload,
                occurred_at=event.timestamp or datetime.now(timezone.utc),
            )

            try:
                await self._apply_event(db, student_id, event)
                sync_row.status = "processed"
                sync_row.processed_at = datetime.now(timezone.utc)
                db.add(sync_row)
                await db.commit()
                processed.append(event.event_id)
            except Exception as exc:  # noqa: BLE001 — must not abort the batch
                await db.rollback()
                logger.warning("Sync event %s failed: %s", event.event_id, exc)
                sync_row.status = "failed"
                sync_row.error_message = str(exc)[:500]
                db.add(sync_row)
                await db.commit()
                failed.append(event.event_id)

        return processed, failed

    async def _apply_event(
        self, db: AsyncSession, student_id: uuid.UUID, event: SyncEventIn
    ) -> None:
        db.add(
            StudentProgress(
                student_id=student_id,
                event_type=event.type,
                score=event.payload.get("score"),
                extra_data=event.payload,
            )
        )


sync_service = SyncService()


def get_sync_service() -> SyncService:
    return sync_service
