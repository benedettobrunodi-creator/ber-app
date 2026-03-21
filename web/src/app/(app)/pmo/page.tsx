'use client';

import { useRouter } from 'next/navigation';
import { FolderOpen, FileText, Camera, CheckSquare, BookOpen, Hammer, ClipboardList, FileCheck } from 'lucide-react';

const modules = [
  { title: 'Canteiro', icon: Hammer, href: '/canteiro', available: true, description: 'Checklists semanais do canteiro de obras' },
  { title: 'Atas de Reunião', icon: FileText, href: '/pmo/atas', available: false, description: 'Registro de reuniões e deliberações' },
  { title: 'Projetos', icon: FolderOpen, href: '/pmo/projetos', available: false, description: 'Arquitetura e projetos complementares' },
  { title: 'Documentos', icon: FileText, href: '/pmo/documentos', available: false, description: 'Documentos gerais da obra' },
  { title: 'Relatórios de Vistoria', icon: Camera, href: '/pmo/vistorias', available: false, description: 'Relatórios fotográficos de vistoria' },
  { title: 'Aprovação de Amostras', icon: CheckSquare, href: '/pmo/amostras', available: false, description: 'Checklists de aprovação de amostras' },
  { title: 'Aprovação de Shopdrawings', icon: FileCheck, href: '/pmo/shopdrawings', available: false, description: 'Checklists de aprovação de shopdrawings' },
  { title: 'As Builts', icon: ClipboardList, href: '/pmo/as-builts', available: false, description: 'Documentação as built da obra' },
  { title: 'Manual do Proprietário', icon: BookOpen, href: '/pmo/manual', available: false, description: 'Manual de uso e manutenção' },
];

export default function PMOPage() {
  const router = useRouter();
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--ber-carbon)]">PMO</h1>
        <p className="text-sm text-[var(--ber-carbon-light)] mt-1">Gestão de documentos e processos da obra</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <div key={mod.title} onClick={() => mod.available && router.push(mod.href)}
              className={`bg-white rounded-xl border border-[var(--ber-border)] p-6 transition-all ${mod.available ? 'cursor-pointer hover:border-[var(--ber-olive)] hover:shadow-md' : 'cursor-not-allowed opacity-60'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--ber-offwhite)] flex items-center justify-center">
                  <Icon size={20} className="text-[var(--ber-olive)]" />
                </div>
                {!mod.available && <span className="text-xs bg-[var(--ber-offwhite)] text-[var(--ber-carbon-light)] px-2 py-1 rounded-full">Em breve</span>}
              </div>
              <h3 className="font-semibold text-[var(--ber-carbon)] mb-1">{mod.title}</h3>
              <p className="text-xs text-[var(--ber-carbon-light)]">{mod.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
