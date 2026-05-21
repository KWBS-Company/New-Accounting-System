from src.components.accounts.repositories.ledger_head_repository import LedgerHeadRepository
from src.components.accounts.services.ledger_head_service import LedgerHeadService
from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from src.utils.database import get_db

router = APIRouter()


def ledger_head_service(db):
    return LedgerHeadService(LedgerHeadRepository(db))


# @router.post("")
# async def chat(body: ChatDto, db: AsyncSession = Depends(get_db)):
#     return await ledger_head_service(db).chat(user, body)


@router.get("")
# later we pass pagination and filter
async def get_ledger_heads(db: AsyncSession = Depends(get_db)):
    return await ledger_head_service(db).getChatList()


# @router.get("/{chatId}")
# async def getChat(chatId: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
#     return await ledger_head_service(db).getChatDetail(user, chatId)


# @router.patch("/title")
# async def upsertChatTitle(body: ChatTitleDto, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
#     await ledger_head_service(db).updateChatTitle(user, body)
#     return {"message": "Chat title is updated successfully"}


# @router.delete("/{chatId}")
# async def deleteChat(chatId: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
#     return await _svc(db).deleteChat(user, chatId)
