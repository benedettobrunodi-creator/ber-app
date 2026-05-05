/**
 * Service: pdf-converter.ts
 * Propósito: Converte PDFs em PNGs e faz upload no R2.
 * Usado pelo módulo de plantas pra ter um pin estável (imagem estática).
 */

import { pdfToPng } from 'pdf-to-png-converter';
import { uploadToR2, isR2Configured } from './storage';

export interface ConvertedPage {
  pageIndex: number;
  imageUrl: string;
  width: number;
  height: number;
}

const PNG_DPI = 150;

export async function convertPdfToPages(
  pdfBuffer: Buffer,
  baseFilename: string,
): Promise<ConvertedPage[]> {
  if (!isR2Configured()) {
    throw new Error('R2 nao configurado — conversao de PDF requer storage R2');
  }

  const pngs = await pdfToPng(pdfBuffer, {
    viewportScale: PNG_DPI / 72,
    disableFontFace: false,
    useSystemFonts: false,
  });

  const pages: ConvertedPage[] = [];
  for (let i = 0; i < pngs.length; i++) {
    const png = pngs[i];
    if (!png.content) continue;
    const pageName = `${baseFilename.replace(/\.pdf$/i, '')}-p${i + 1}.png`;
    const url = await uploadToR2(png.content, pageName, 'image/png');
    pages.push({
      pageIndex: i,
      imageUrl: url,
      width: png.width,
      height: png.height,
    });
  }

  return pages;
}
