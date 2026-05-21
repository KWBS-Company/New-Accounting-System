import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { LedgerHeadRepository } from "../repositories/ledger_head.repo";

@Injectable()
export class JournalService {
    constructor(private readonly ledgerHeadRepo: LedgerHeadRepository) { }

    

}
