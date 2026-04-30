from src.components.accounts.services.ledger_head_type_service import LedgerHeadTypeService
from fastapi import APIRouter

router = APIRouter()


@router.get("")
async def listLedgerHeadTypes():
    return await LedgerHeadTypeService().getLedgerHeadTypes()
