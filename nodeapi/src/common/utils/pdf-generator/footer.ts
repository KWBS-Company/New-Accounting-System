import { type PDFPage } from "pdf-lib";
import { COLORS, drawHRule } from "./utils";
import type { DrawContext } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
//  drawFooter
//
//  Renders "Prepared By" and "Approved By" signature blocks near the bottom
//  of the given page.  Call this on every page that needs the footer,
//  including mid-document overflow pages.
// ─────────────────────────────────────────────────────────────────────────────

export interface SignatureBlock {
  label: string;
  /** "left" anchors to margin; "right" anchors to margin + contentW */
  anchor: "left" | "right";
}

const DEFAULT_BLOCKS: SignatureBlock[] = [
  { label: "Prepared By", anchor: "left"  },
  { label: "Approved By", anchor: "right" },
];

export function drawFooter(
  page: PDFPage,
  ctx: DrawContext,
  blocks: SignatureBlock[] = DEFAULT_BLOCKS,
): void {
  const { fonts, layout } = ctx;
  const { bold } = fonts;
  const { margin, contentW } = layout;

  const SIG_WIDTH   = 130;
  const FOOTER_BASE = margin + 60; // distance from page bottom
  const LINE_Y      = FOOTER_BASE + 20;
  const LABEL_Y     = FOOTER_BASE + 6;
  const LABEL_SIZE  = 8;

  for (const block of blocks) {
    const sx =
      block.anchor === "left"
        ? margin
        : margin + contentW - SIG_WIDTH;

    // Signature underline
    drawHRule(page, sx, LINE_Y, SIG_WIDTH, 1.2, COLORS.black);

    // Centered label
    const lW = bold.widthOfTextAtSize(block.label, LABEL_SIZE);
    page.drawText(block.label, {
      x:    sx + (SIG_WIDTH - lW) / 2,
      y:    LABEL_Y,
      size: LABEL_SIZE,
      font:  bold,
      color: COLORS.darkGray,
    });
  }
}
