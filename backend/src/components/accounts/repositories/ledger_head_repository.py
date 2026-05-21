from src.components.accounts.entities.ledger_head_entity import LedgerHead
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload


class LedgerHeadRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def save(self, ledger_head: LedgerHead) -> LedgerHead:
        self.db.add(ledger_head)
        await self.db.commit()
        await self.db.refresh(ledger_head)
        return ledger_head

    async def getOneById(self, ledger_head_id: str):
        result = await self.db.execute(
            select(LedgerHead)
            .options(selectinload(LedgerHead.lines))
            .where(LedgerHead.id == ledger_head_id, LedgerHead.isDeleted == False)
        )
        return result.scalars().first()

    async def getAllWithFilters():
        pass
