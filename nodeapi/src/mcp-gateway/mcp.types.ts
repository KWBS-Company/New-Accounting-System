
export enum ActionType {

    LIST_ACCOUNT = 'list_account',
    LIST_JOURNALENTRY = 'list_journalentry',
    LIST_TRANSACTIONTYPE = 'list_transactiontype',
    GET_ACCOUNT_DETAIL = 'get_account_detail',
    GET_ACCOUNT_BALANCE = 'get_account_balance',
    GET_JOURNALENTRY_DETAIL = 'get_journalentry_detail',
    GET_TRANSACTIONTYPE_DETAIL = 'get_transactiontype_detail',
    GENERATE_REPORT = 'generate_report'
}


export enum ReportType {
    TRIAL_BALANCE = 'trial_balance',
    PROFIT_LOSS = 'profit_loss',
    BALANCE_SHEET = 'balance_sheet',
    LEDGER = 'ledger',
    JOURNAL_ENTRY = 'journal_entry'
}