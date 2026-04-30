from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime, timezone
import uuid

from sqlalchemy.orm import relationship

from src.utils.base_entity import BaseEntity


class JournalTransaction(BaseEntity):
    __tablename__ = "journaltransactions"

    uuid = Column(UUID(as_uuid=True), default=uuid.uuid4, unique=True, nullable=False)

    reference = Column(String(100), nullable=True)  # INV-1001, PAY-01 etc.
    description = Column(Text, nullable=True)

    transaction_date = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    # lines array
    lines = relationship("JournalLine", back_populates="transaction", cascade="all, delete-orphan",
                           order_by="JournalLine.created_date.desc()")