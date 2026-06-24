import {
    PDFDocument,
    rgb,
    LineCapStyle,
    type PDFPage,
    type PDFFont,
    type Color,
} from 'pdf-lib';
import axios from 'axios';
// ─────────────────────────────────────────────────────────────────────────────
//  Color palette
// ─────────────────────────────────────────────────────────────────────────────

export const COLORS = {
    black: rgb(0.1, 0.1, 0.18), // #1a1a2e
    darkGray: rgb(0.35, 0.38, 0.44), // #5a6070
    midGray: rgb(0.54, 0.56, 0.6), // #8a90a0
    lightGray: rgb(0.89, 0.91, 0.92), // #e2e5ea
    rowBorder: rgb(0.93, 0.94, 0.95), // #eef0f3
    bodyText: rgb(0.18, 0.19, 0.26), // #2d3142
    white: rgb(1, 1, 1),

    // Matched badge
    green: rgb(0.1, 0.49, 0.29), // #1a7d4a
    greenBg: rgb(0.92, 0.97, 0.94), // #eaf7f0
    greenBdr: rgb(0.71, 0.91, 0.81), // #b6e8ce

    // Unmatched badge
    red: rgb(0.75, 0.22, 0.17), // #c0392b
    redBg: rgb(1.0, 0.95, 0.95), // #fff2f2
    redBdr: rgb(0.96, 0.75, 0.74), // #f5c0bc
} as const;

// ─────────────────────────────────────────────────────────────────────────────
//  Utility: truncate text to fit within maxWidth pixels
// ─────────────────────────────────────────────────────────────────────────────

export function truncate(
    text: string,
    font: PDFFont,
    size: number,
    maxWidth: number,
): string {
    let t = String(text ?? '');
    while (t.length > 1 && font.widthOfTextAtSize(t, size) > maxWidth) {
        t = t.slice(0, -1);
    }
    return t;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Utility: draw a horizontal rule
// ─────────────────────────────────────────────────────────────────────────────

export function drawHRule(
    page: PDFPage,
    x: number,
    y: number,
    width: number,
    thickness: number,
    color: Color,
): void {
    page.drawLine({
        start: { x, y },
        end: { x: x + width, y },
        thickness,
        color,
        lineCap: LineCapStyle.Projecting,
    });
}

export async function embedImageFromUrl(pdfDoc: PDFDocument, url: string) {
    try {
        const res = await axios.get(url, {
            responseType: 'arraybuffer',
        });

        const bytes = new Uint8Array(res.data);

        const contentType = res.headers['content-type'];

        // Pick embed method based on content type or extension
        if (url.endsWith('.png') || contentType === 'image/png') {
            return pdfDoc.embedPng(bytes);
        } else {
            return pdfDoc.embedJpg(bytes);
        }
    } catch {
        console.log('Error while fetching logo buffer');
        return null;
    }
}
