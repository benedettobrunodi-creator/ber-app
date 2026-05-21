'use client';

import { useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
    } catch {
      // Mostrar mensagem genérica para não revelar se o email existe
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ber-offwhite px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-black tracking-wider text-ber-carbon">
            BER
          </h1>
          <p className="mt-0.5 text-[10px] font-semibold tracking-[0.2em] text-ber-gray uppercase">
            Engenharia e Gerenciamento
          </p>
        </div>

        {submitted ? (
          <div className="space-y-4 text-center">
            <div className="rounded-md bg-green-50 p-4 text-sm text-green-700">
              Se o email estiver cadastrado, você receberá as instruções em instantes.
            </div>
            <Link
              href="/login"
              className="block text-xs text-ber-gray hover:text-ber-teal transition-colors"
            >
              ← Voltar para o login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-ber-gray text-center">
              Informe seu email para receber o link de recuperação de senha.
            </p>

            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ber-carbon">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm shadow-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-ber-carbon px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ber-black focus:ring-2 focus:ring-ber-olive focus:ring-offset-2 focus:outline-none disabled:opacity-50"
            >
              {loading ? 'Enviando...' : 'Enviar link de recuperação'}
            </button>

            <div className="text-center">
              <Link
                href="/login"
                className="text-xs text-ber-gray hover:text-ber-teal transition-colors"
              >
                ← Voltar para o login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
