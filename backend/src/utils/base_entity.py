import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from src.utils.database import Base


class BaseEntity(Base):
    __abstract__ = True

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    createdDate = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    isDeleted = Column(Boolean, default=False, nullable=False)
    modifiedDate = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                          onupdate=lambda: datetime.now(timezone.utc), nullable=False)
