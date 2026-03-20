'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v4';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '@/lib/api';
import { X } from 'lucide-react';

const schema = z.object({
  title: z.string().min(1, 'Título obrigatório'),
  clientName: z.string().optional(),
  location: z.string().optional(),
  startTime: z.string().min(1, 'Data/hora de início obrigatória'),
  endTime: z.string().min(1, 'Data/hora de fim obrigatória'),
  proposalId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface ProposalOption {
  id: string;
  title: string;
  clientName: string;
}

interface Props {
  proposals: ProposalOption[];
  onClose: () => void;
  onCreated: () => void;
}

export default function NovaReuniaoModal({ proposals, onClose, onCreated }: Props) {
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setError('');
    try {
      const body: Record<string, string> = {
        title: data.title,
        startTime: new Date(data.startTime).toISOString(),
        endTime: new Date(data.endTime).toISOString(),
      };
      if (data.clientName) body.clientName = data.clientName;
      if (data.location) body.location = data.location;
      if (data.proposalId) body.proposalId = data.proposalId;
      await api.post('/meetings', body);
      onCreated();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Erro ao criar reunião';
      setError(message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-ber-offwhite px-6 py-4">
          <h2 className="text-lg font-black text-ber-carbon">Nova Reunião</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-ber-gray transition-colors hover:bg-ber-offwhite hover:text-ber-carbon"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-6 py-5">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-ber-carbon">Título *</label>
            <input
              {...register('title')}
              className="mt-1 block w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none"
            />
            {errors.title && (
              <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ber-carbon">Cliente</label>
              <input
                {...register('clientName')}
                className="mt-1 block w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ber-carbon">Local</label>
              <input
                {...register('location')}
                className="mt-1 block w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ber-carbon">Início *</label>
              <input
                type="datetime-local"
                {...register('startTime')}
                className="mt-1 block w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none"
              />
              {errors.startTime && (
                <p className="mt-1 text-xs text-red-600">{errors.startTime.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-ber-carbon">Fim *</label>
              <input
                type="datetime-local"
                {...register('endTime')}
                className="mt-1 block w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none"
              />
              {errors.endTime && (
                <p className="mt-1 text-xs text-red-600">{errors.endTime.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ber-carbon">Proposta vinculada</label>
            <select
              {...register('proposalId')}
              className="mt-1 block w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none"
            >
              <option value="">Nenhuma</option>
              {proposals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.clientName} — {p.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray transition-colors hover:bg-ber-offwhite"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-ber-carbon px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ber-black disabled:opacity-50"
            >
              {isSubmitting ? 'Criando...' : 'Criar Reunião'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
