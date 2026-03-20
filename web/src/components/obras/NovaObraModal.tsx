'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v4';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '@/lib/api';
import { X } from 'lucide-react';

const novaObraSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  client: z.string().optional(),
  address: z.string().optional(),
  coordinatorId: z.string().optional(),
  startDate: z.string().optional(),
  expectedEndDate: z.string().optional(),
});

type NovaObraForm = z.infer<typeof novaObraSchema>;

interface UserOption {
  id: string;
  name: string;
}

interface NovaObraModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export default function NovaObraModal({ onClose, onCreated }: NovaObraModalProps) {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NovaObraForm>({
    resolver: zodResolver(novaObraSchema),
  });

  useEffect(() => {
    api
      .get('/users', { params: { limit: 100 } })
      .then((res) => setUsers(res.data.data))
      .catch(() => {});
  }, []);

  async function onSubmit(data: NovaObraForm) {
    setError('');
    try {
      const body: Record<string, string> = { name: data.name };
      if (data.client) body.client = data.client;
      if (data.address) body.address = data.address;
      if (data.coordinatorId) body.coordinatorId = data.coordinatorId;
      if (data.startDate) body.startDate = new Date(data.startDate).toISOString();
      if (data.expectedEndDate) body.expectedEndDate = new Date(data.expectedEndDate).toISOString();
      await api.post('/obras', body);
      onCreated();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Erro ao criar obra';
      setError(message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ber-offwhite px-6 py-4">
          <h2 className="text-lg font-black text-ber-carbon">Nova Obra</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-ber-gray transition-colors hover:bg-ber-offwhite hover:text-ber-carbon"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-6 py-5">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-ber-carbon">
              Nome da obra *
            </label>
            <input
              {...register('name')}
              className="mt-1 block w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ber-carbon">
                Cliente
              </label>
              <input
                {...register('client')}
                className="mt-1 block w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ber-carbon">
                Coordenador
              </label>
              <select
                {...register('coordinatorId')}
                className="mt-1 block w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none"
              >
                <option value="">Selecionar...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ber-carbon">
              Endereço
            </label>
            <input
              {...register('address')}
              className="mt-1 block w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ber-carbon">
                Data de início
              </label>
              <input
                type="date"
                {...register('startDate')}
                className="mt-1 block w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ber-carbon">
                Previsão de entrega
              </label>
              <input
                type="date"
                {...register('expectedEndDate')}
                className="mt-1 block w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none"
              />
            </div>
          </div>

          {/* Actions */}
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
              {isSubmitting ? 'Criando...' : 'Criar Obra'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
