from src.components.accounts.types.ledger_head_type_enum import LedgerHeadType

class LedgerHeadTypeService:
    def __init__(self):
        pass

    async def getLedgerHeadTypes(self):
         return [
        {
            "label": item.name,
            "value": item.value
        }
        for item in LedgerHeadType
    ]
