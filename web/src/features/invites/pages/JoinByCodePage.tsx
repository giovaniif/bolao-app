import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../../shared/components/Layout';
import { Button } from '../../../shared/components/Button';

export function JoinByCodePage() {
  const [code, setCode] = useState('');
  const navigate = useNavigate();
  const clean = code.trim().toUpperCase();

  return (
    <Layout title="Entrar com código">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          navigate(`/convite/${clean}`);
        }}
      >
        <div className="space-y-1">
          <label htmlFor="invite-code" className="block text-sm text-text-muted">Código do bolão</label>
          <input
            id="invite-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="AMIGOS22"
            className="w-full px-3 py-3 rounded-lg bg-card border border-slate-600 text-white text-lg tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-text-muted">Peça o código para quem criou o bolão.</p>
        </div>
        <Button type="submit" className="w-full" disabled={clean.length < 4}>Continuar</Button>
      </form>
    </Layout>
  );
}
