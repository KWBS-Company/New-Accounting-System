export interface CompanyInfo {
    name: string;
    phone?: string;
    email?: string;
    website?: string;
    address?: string;
    vatNumber?: string;
    panNumber?: string;
    logoImage?: string
}

export interface FiscalYear {
    start: string;
    end: string;
}