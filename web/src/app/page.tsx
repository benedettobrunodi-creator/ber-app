'use client';

// Tela inicial por perfil (08/10/26, Bruno: "a tela inicial deveria ser
// sempre comercial... só pra mim") — sócio cai no CRM, todo o resto segue
// caindo em Obras. Client-side porque o user vive no localStorage (authStore),
// o servidor não enxerga a sessão aqui.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    let role: string | null = null;
    try {
      role = (JSON.parse(localStorage.getItem('user') ?? 'null') as { role?: string } | null)?.role ?? null;
    } catch { /* user corrompido/ausente — segue o fluxo padrão */ }
    router.replace(role === 'socio' ? '/crm' : '/obras');
  }, [router]);
  return null;
}
