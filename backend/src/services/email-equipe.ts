/**
 * Destinatários INTERNOS de uma obra (Bruno 25/09/26): membros do app na obra
 * (obra_members) + coordenador + engenheiro residente — todos users ativos com
 * e-mail. Clientes/externos (ObraStakeholder, cliente-acesso) ficam DE FORA.
 * Usado pelos avisos de upload no Controle de Documentos e de relatório de
 * Qualidade.
 */

import { prisma } from '../config/database';

export async function emailsEquipeInternaDaObra(obraId: string): Promise<string[]> {
  const obra = await prisma.obra.findUnique({
    where: { id: obraId },
    select: {
      coordinator: { select: { email: true, isActive: true } },
      residentEngineer: { select: { email: true, isActive: true } },
      members: { select: { user: { select: { email: true, isActive: true } } } },
    },
  });
  if (!obra) return [];
  const candidatos = [
    obra.coordinator,
    obra.residentEngineer,
    ...obra.members.map(m => m.user),
  ];
  const emails = new Set<string>();
  for (const u of candidatos) {
    if (u?.isActive && u.email && u.email.includes('@')) emails.add(u.email.toLowerCase());
  }
  return Array.from(emails);
}

/** Casca visual padrão BÈR pros avisos internos (mesmo estilo dos alertas). */
export function htmlAvisoInterno(tituloEmoji: string, corpoHtml: string, rodape: string): string {
  return `
  <div style="font-family:'Montserrat',Arial,sans-serif;max-width:560px;margin:0 auto;background:#F7F7F5;padding:24px;">
    <div style="background:#2D2D2D;padding:24px 28px;border-radius:12px 12px 0 0;text-align:center;">
      <h1 style="color:#fff;font-size:22px;font-weight:900;letter-spacing:3px;margin:0;">BÈR</h1>
      <p style="color:#868686;font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin:4px 0 0;">Engenharia e Gerenciamento</p>
    </div>
    <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;">
      <h2 style="color:#2D2D2D;font-size:17px;margin:0 0 10px;">${tituloEmoji}</h2>
      ${corpoHtml}
    </div>
    <p style="color:#8B8D82;font-size:11px;text-align:center;margin:16px 0 0;">${rodape}</p>
  </div>`;
}
