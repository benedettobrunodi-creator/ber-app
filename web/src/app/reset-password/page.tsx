'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import api from '@/lib/api';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        router.push('/login');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [success, router]);

  if (!token) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 text-center">
        Link inválido. Solicite um novo link de recuperação.
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/reset-password', { token, password });
      setSuccess(true);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Token inválido ou expirado. Solicite um novo link.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-md bg-green-50 p-4 text-sm text-green-700 text-center">
        Senha alterada! Redirecionando...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-ber-gray text-center">
        Crie uma nova senha para sua conta.
      </p>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-ber-carbon">
          Nova senha
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm shadow-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-ber-carbon">
          Confirmar senha
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="mt-1 block w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm shadow-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-ber-carbon px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ber-black focus:ring-2 focus:ring-ber-olive focus:ring-offset-2 focus:outline-none disabled:opacity-50"
      >
        {loading ? 'Salvando...' : 'Redefinir senha'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
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

        <Suspense
          fallback={
            <div className="text-center text-sm text-ber-gray">Carregando...</div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
