import type { PDFFont } from "pdf-lib";
import { PLLineItem } from "src/accounts/types/profit_loss.types";
import { AccountRow } from "src/accounts/types/trial_balance.types";

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
// ─────────────────────────────────────────────────────────────────────────────
//  Column definition for P&L tables (4 cols: code | name | type | amount)
// ─────────────────────────────────────────────────────────────────────────────

export interface PLColDef {
  label: string;
  key: keyof PLLineItem;
  widthFraction: number;
  align: "left" | "right";
  /** resolved pixel width */
  w: number;
  /** resolved x origin */
  x: number;
}



