import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class SyncEventIn(BaseModel):
    event_id: str = Field(..., min_length=1, max_length=255)
    type: str = Field(..., min_length=1, max_length=64)
    timestamp: datetime | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


class SyncRequest(BaseModel):
    student_id: uuid.UUID
    events: list[SyncEventIn]


class SyncResponse(BaseModel):
    processed: list[str]
    failed: list[str]
