from sqlalchemy import Column, Numeric, String, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from src.utils.base_entity import BaseEntity


class JournalLine(BaseEntity):
    __tablename__ = "journallines"

    transaction_id = Column(
        UUID(as_uuid=True),
        ForeignKey("journaltransactions.id", ondelete="CASCADE"),
        nullable=False
    )

    ledger_head_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ledgerheads.id"),
        nullable=False
    )

    debit = Column(Numeric(15, 2), default=0)
    credit = Column(Numeric(15, 2), default=0)

    description = Column(String, nullable=True)

    transaction = relationship("JournalTransaction", backref="lines")
    ledgerhead = relationship("LedgerHead", backref="lines")
    __table_args__ = (
        CheckConstraint(
            "(debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)",
            name="check_debit_credit_rule"
        ),
    )