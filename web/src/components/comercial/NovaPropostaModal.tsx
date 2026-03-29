'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v4';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '@/lib/api';
import { X } from 'lucide-react';

const schema = z.object({
  title: z.string().min(1, 'Título obrigatório'),
  clientName: z.string().min(1, 'Cliente obrigatório'),
  value: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export default function NovaPropostaModal({ onClose, onCreated }: Props) {
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
      const body: Record<string, string | number> = {
        title: data.title,
        clientName: data.clientName,
      };
      if (data.value) {
        const parsed = parseFloat(data.value.replace(/\./g, '').replace(',', '.'));
        if (!isNaN(parsed) && parsed > 0) body.value = parsed;
      }
      if (data.notes) body.notes = data.notes;
      await api.post('/proposals', body);
      onCreated();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Erro ao criar proposta';
      setError(message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-t-2xl md:rounded-lg bg-white shadow-xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-ber-offwhite px-6 py-4">
          <h2 className="text-lg font-black text-ber-carbon">Nova Proposta</h2>
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
              <label className="block text-sm font-medium text-ber-carbon">Cliente *</label>
              <input
                {...register('clientName')}
                className="mt-1 block w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none"
              />
              {errors.clientName && (
                <p className="mt-1 text-xs text-red-600">{errors.clientName.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-ber-carbon">Valor (R$)</label>
              <input
                {...register('value')}
                placeholder="0,00"
                inputMode="decimal"
                className="mt-1 block w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ber-carbon">Observações</label>
            <textarea
              {...register('notes')}
              rows={3}
              className="mt-1 block w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none"
            />
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
              {isSubmitting ? 'Criando...' : 'Criar Proposta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
