from backend.src.components.accounts.repositories.ledger_head_repository import LedgerHeadRepository
# import httpx alternative of axios
from fastapi import HTTPException, status


class LedgerHeadService:
    def __init__(self, ledger_head_repo: LedgerHeadRepository):
        self.ledger_head_repo = ledger_head_repo
