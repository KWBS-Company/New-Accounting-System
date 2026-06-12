import type { PDFFont, PDFPage } from "pdf-lib";

// ─────────────────────────────────────────────────────────────────────────────
//  Domain types
// ─────────────────────────────────────────────────────────────────────────────

export interface CompanyInfo {
  name: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  vatNumber?: string;
  panNumber?: string;
  /** Pass a pre-embedded PDFImage if you want a real logo rendered */
  logoImage?: string
}

export interface FiscalYear {
  start: string;
  end: string;
}

export interface AccountRow {
  code: string;
  name: string;
  balance:string;
  accountType: string;
  debit: string;
  credit: string;
}

export interface Totals {
  debit: string;
  credit: string;
}

export interface TrialBalanceData {
  company: CompanyInfo;
  fiscalYear?: FiscalYear;
  reportDate: string;
  asOf: string;
  currency?: string;
  accounts: AccountRow[];
  totals: Totals;
  isMatched: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Rendering context shared across header / body / footer
// ─────────────────────────────────────────────────────────────────────────────

export interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
}

export interface PageLayout {
  pageW: number;
  pageH: number;
  margin: number;
  contentW: number;
}

export interface DrawContext {
  fonts: Fonts;
  layout: PageLayout;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Column definition (resolved with pixel widths)
// ─────────────────────────────────────────────────────────────────────────────

export interface ColDef {
  label: string;
  key: keyof AccountRow;
  /** fraction of contentW */
  widthFraction: number;
  align: "left" | "right";
  /** resolved pixel width – set by buildColumns() */
  w: number;
  /** resolved x origin – set by buildColumns() */
  x: number;
}
