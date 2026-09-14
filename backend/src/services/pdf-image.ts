/**
 * Prepara imagem externa pra embutir em PDF do react-pdf (14/09/26).
 * O decoder JPEG do @react-pdf (jay-peg) falha silenciosamente com fotos de
 * celular ("Unknown version 0" — EXIF/progressivo): a foto some do PDF.
 * Solução: baixar e reprocessar com sharp — respeita rotação EXIF, limita a
 * 1400px e regrava como JPEG baseline. Falhou? Retorna null (foto fica fora,
 * PDF sai mesmo assim).
 */
import sharp from 'sharp';

export async function imagemParaPdf(url: string): Promise<Buffer | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) return null;
    const raw = Buffer.from(await r.arrayBuffer());
    return await sharp(raw)
      .rotate() // aplica orientação EXIF
      .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 78, progressive: false, mozjpeg: true })
      .toBuffer();
  } catch (e) {
    console.error('[pdf-image] falha ao preparar imagem:', url, (e as Error).message);
    return null;
  }
}
