from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, field_validator

# Form fields a draft may hold, per kind. Anything else is dropped.
DRAFT_FIELDS = {
    "listing": {
        "title", "category", "listing_type", "price", "mrp", "rent_days", "security_deposit", "condition", "description",
        "pickup_spot", "food_temp", "expiry_date",
    },
    "resource": {
        "title", "subject", "year", "copy_type", "offer_type", "price", "description",
        "delivery", "drive_url", "pickup_spot", "upi_id",
    },
}
MAX_FIELD_LENGTH = 2000

DraftValue = str | int | float | bool | None


class DraftIn(BaseModel):
    kind: Literal["listing", "resource"]
    data: dict[str, DraftValue]

    @field_validator("data")
    @classmethod
    def short_values(cls, data: dict[str, DraftValue]) -> dict[str, DraftValue]:
        for key, value in data.items():
            if isinstance(value, str) and len(value) > MAX_FIELD_LENGTH:
                raise ValueError(f"'{key}' is too long for a draft")
        return data

    def clean_data(self) -> dict[str, DraftValue]:
        allowed = DRAFT_FIELDS[self.kind]
        return {k: v for k, v in self.data.items() if k in allowed}


class DraftOut(BaseModel):
    id: int
    kind: str
    data: dict[str, DraftValue]
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, d) -> "DraftOut":
        # Stored as naive UTC; send it with the zone so browsers read it right.
        return cls(
            id=d.id, kind=d.kind, data=d.data or {},
            created_at=d.created_at.replace(tzinfo=timezone.utc),
            updated_at=d.updated_at.replace(tzinfo=timezone.utc),
        )
