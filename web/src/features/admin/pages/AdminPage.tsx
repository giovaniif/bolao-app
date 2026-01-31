import { useState } from 'react';
import { Layout } from '../../../shared/components/Layout';
import { AdminUsers } from '../components/AdminUsers';
import { AdminMatches } from '../components/AdminMatches';

type Tab = 'users' | 'matches';

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('users');

  return (
    <Layout title="Admin">
      <div className="flex gap-2 mb-4 border-b border-slate-700">
        <button
          onClick={() => setTab('users')}
          className={`px-4 py-2 text-sm font-medium ${
            tab === 'users'
              ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
              : 'text-[var(--color-text-muted)]'
          }`}
        >
          Usuários
        </button>
        <button
          onClick={() => setTab('matches')}
          className={`px-4 py-2 text-sm font-medium ${
            tab === 'matches'
              ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
              : 'text-[var(--color-text-muted)]'
          }`}
        >
          Jogos
        </button>
      </div>
      {tab === 'users' && <AdminUsers />}
      {tab === 'matches' && <AdminMatches />}
    </Layout>
  );
}
