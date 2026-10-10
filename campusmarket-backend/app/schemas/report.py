from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

# Must match REPORT_REASONS in src/data/sample.js.
REPORT_REASONS = ("Scam / suspicious", "Prohibited item", "Incorrect information", "Spam", "Other")


class ReportIn(BaseModel):
    listing_id: Optional[int] = None
    resource_id: Optional[int] = None
    reason: str
    details: Optional[str] = Field(default=None, max_length=300)

    @field_validator("reason")
    @classmethod
    def known_reason(cls, value: str) -> str:
        if value not in REPORT_REASONS:
            raise ValueError("Pick one of the listed reasons")
        return value

    @field_validator("details")
    @classmethod
    def tidy(cls, value: str | None) -> str | None:
        value = " ".join((value or "").split())
        return value or None

    @model_validator(mode="after")
    def exactly_one_target(self):
        if (self.listing_id is None) == (self.resource_id is None):
            raise ValueError("Report either a listing or a resource")
        return self


class ReportStatusIn(BaseModel):
    status: Literal["open", "resolved"]


class ReportPersonOut(BaseModel):
    id: str
    name: str
    email: str


class AdminReportOut(BaseModel):
    id: int
    target_type: str
    target_id: int
    target_title: str
    target_exists: bool
    reason: str
    details: str | None = None
    status: str
    created_at: datetime
    resolved_at: datetime | None = None
    reporter: ReportPersonOut
    owner: ReportPersonOut
    reports_on_item: int  # how many students reported this same item


class AdminReportsOut(BaseModel):
    items: list[AdminReportOut]
    open: int
