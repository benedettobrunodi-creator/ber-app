'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Construction } from 'lucide-react';

export default function MedicaoPlaceholderPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <Construction className="h-12 w-12 text-amber-500" />
      <h1 className="text-xl font-bold text-gray-900">Medição em reconstrução</h1>
      <p className="max-w-md text-sm text-gray-600">
        Estamos unificando o app de medição (<span className="font-mono">ber-medicao</span>)
        dentro do BÉR. O fluxo completo (etapas, fornecedores, medições quinzenais, NFs
        e portal do cliente) volta em breve.
      </p>
      <Link
        href={`/obras/${id}/gestao-360`}
        className="rounded-lg bg-[#06A99D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#058e83]"
      >
        Voltar para Gestão 360
      </Link>
    </div>
  );
}
