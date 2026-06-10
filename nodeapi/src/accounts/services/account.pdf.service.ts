import { Injectable } from "@nestjs/common";
import { CommonService } from "src/common/utils/common";
import { Transaction } from "../entities/transactions.entity";
import { User } from "src/auth/entities/user.entity";

@Injectable()
export class AccountPDFService {
    constructor(private readonly commonService: CommonService) { }

    async journalVoucherPdfGenerator(txnData: Transaction, backendUrl: string, user: User) {

        const totalDebit = txnData.lines.reduce((s, l) => s + Number(l.debit), 0);
        const totalCredit = txnData.lines.reduce((s, l) => s + Number(l.credit), 0);
        const company = user.userRoles[0].customer;
        const context = {
            backendUrl: backendUrl,
            company: {
                ...user.userRoles[0].customer,   // name, companyLogo, vatNumber, panNumber,
                // fiscalStartDate, fiscalEndDate,
                // transactionCurrencyCode
                phone: company.companyPhone,
                email: company.companyEmail,
                website: company.companyWebsite,
                address: company.companyAddress,
            },
            txn: {
                ...txnData,
                totalDebit,
                totalCredit,
                isBalanced: totalDebit === totalCredit,
            },
        };
        const html = await this.commonService.generateTemplate(
            'journal-voucher.hbs',
            context,
        );
        const pdfBuffer = await this.commonService.pdfGenerateByHtml(html);
        return pdfBuffer;
    }
}