from sqlalchemy import Column, String, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from src.components.accounts.ledger_head_type_enum import LedgerHeadType
from src.utils.base_entity import BaseEntity


class LedgerHead(BaseEntity):
    __tablename__ = "ledgerheads"

    name = Column(String, nullable=False)
    code = Column(String, nullable=False)
    ledger_head_type = Column(Enum(LedgerHeadType, name="ledgerheadtype_enum", create_constraint=True, native_enum=False),
                  nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("ledgerheads.id"), nullable=False)

    lines = relationship("JournalLine", back_populates="ledgerhead", cascade="all, delete-orphan",
                           order_by="LedgerHead.created_date.desc()")
