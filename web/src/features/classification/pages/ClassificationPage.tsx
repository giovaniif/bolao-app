import { useState } from 'react';
import { Layout } from '../../../shared/components/Layout';
import { useClassification } from '../hooks/useClassification';
import { useRounds } from '../../matches/hooks/useMatches';
import { useBoloes } from '../../boloes/hooks/useBoloes';
import { downloadExportRound, downloadExportAll } from '../api/exportApi';
import { ClassificationRow } from '../components/ClassificationRow';

export function ClassificationPage() {
  const [selectedBolaoId, setSelectedBolaoId] = useState<string>('');
  const [selectedRound, setSelectedRound] = useState<number | ''>('');
  const [exporting, setExporting] = useState<'round' | 'all' | null>(null);

  const { data: boloes = [] } = useBoloes();
  const bolaoId = selectedBolaoId || undefined;

  const { data: rounds = [] } = useRounds(bolaoId);
  const maxRound = rounds.length > 0 ? Math.max(...rounds) : 0;
  const displayRound = selectedRound === '' ? maxRound : selectedRound;
  // "Todas" = classificação acumulada (backend round=0/999). Rodada específica = só aquela rodada.
  const roundForQuery = selectedRound === '' ? undefined : selectedRound;
  const isCumulative = selectedRound === '';

  const { data: classification = [], isLoading, error } = useClassification(roundForQuery, bolaoId);

  return (
    <Layout title="Classificação">
      <div className="space-y-4">
        {boloes.length > 1 && (
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-1">Bolão</label>
            <select
              value={selectedBolaoId}
              onChange={(e) => {
                setSelectedBolaoId(e.target.value);
                setSelectedRound('');
              }}
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-card)] border border-slate-600 text-white"
            >
              <option value="">Bolão atual</option>
              {boloes
                .filter((b) => b.status === 'finished')
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </select>
          </div>
        )}

        {rounds.length > 0 && (
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-1">
              {isCumulative ? 'Classificação geral' : `Classificação da Rodada ${displayRound}`}
            </label>
            <select
              value={selectedRound}
              onChange={(e) =>
                setSelectedRound(e.target.value ? Number(e.target.value) : '')
              }
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-card)] border border-slate-600 text-white"
            >
              <option value="">Geral</option>
              {rounds.map((r) => (
                <option key={r} value={r}>
                  Rodada {r}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={async () => {
              setExporting('round');
              try {
                await downloadExportRound(Number(displayRound) || 1, bolaoId);
              } catch (e) {
                alert(e instanceof Error ? e.message : 'Erro ao exportar');
              } finally {
                setExporting(null);
              }
            }}
            disabled={exporting !== null || rounds.length === 0}
            className="text-sm px-3 py-1.5 rounded-lg bg-[var(--color-card)] border border-slate-600 text-[var(--color-primary)] hover:border-[var(--color-primary)] disabled:opacity-50"
          >
            {exporting === 'round' ? 'Exportando...' : 'Exportar rodada'}
          </button>
          <button
            onClick={async () => {
              setExporting('all');
              try {
                await downloadExportAll(bolaoId);
              } catch (e) {
                alert(e instanceof Error ? e.message : 'Erro ao exportar');
              } finally {
                setExporting(null);
              }
            }}
            disabled={exporting !== null || rounds.length === 0}
            className="text-sm px-3 py-1.5 rounded-lg bg-[var(--color-card)] border border-slate-600 text-[var(--color-primary)] hover:border-[var(--color-primary)] disabled:opacity-50"
          >
            {exporting === 'all' ? 'Exportando...' : 'Exportar todas'}
          </button>
        </div>

        {error && (
          <p className="text-red-400 text-sm text-center py-4">
            {error instanceof Error ? error.message : 'Erro ao carregar'}
          </p>
        )}

        {isLoading ? (
          <p className="text-center py-8 text-[var(--color-text-muted)]">
            Carregando...
          </p>
        ) : (
          <div className="space-y-2">
            {classification.map((u, i) => (
              <ClassificationRow
                key={u.id}
                rank={i + 1}
                user={u}
                isChamp={i === 0 && displayRound > 0}
              />
            ))}
            {classification.length === 0 && !error && (
              <p className="text-center py-8 text-[var(--color-text-muted)]">
                Nenhum resultado ainda
              </p>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
