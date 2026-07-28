import { useState } from 'react';
import { Layout } from '../../../shared/components/Layout';
import { SegmentedControl } from '../../../shared/components/SegmentedControl';
import { useTabInUrl } from '../../../shared/hooks/useTabInUrl';
import { useRounds } from '../../matches/hooks/useMatches';
import { useSeasons } from '../hooks/useSeasons';
import { SeasonChips } from '../components/SeasonChips';
import { ChampionHero } from '../components/ChampionHero';
import { RunnersUp } from '../components/RunnersUp';
import { FinalStandings } from '../components/FinalStandings';
import { SeasonGallery } from '../components/SeasonGallery';
import { BiggestWinners } from '../components/BiggestWinners';

/** Values stay Portuguese: they are user-facing and appear in shared links. */
const VIEWS = ['campeao', 'temporadas'] as const;
type HallView = (typeof VIEWS)[number];

const SEGMENTS = [
  { value: 'campeao' as const, label: 'Campeão' },
  { value: 'temporadas' as const, label: 'Temporadas' },
];

export function ChampionsPage() {
  const { seasons, isLoading } = useSeasons();

  const [selectedId, setSelectedId] = useState('');
  const [view, setView] = useTabInUrl<HallView>('vista', VIEWS, 'campeao');
  const season = seasons.find((s) => s.bolao.id === selectedId) ?? seasons[0];

  // Selected season only. rounds_won is not a shortcut: a round nobody scored in has no
  // winner, so summing it undercounts.
  const { data: rounds } = useRounds(season?.bolao.id);

  if (isLoading && seasons.length === 0) {
    return (
      <Layout title="Hall dos Campeões">
        <p className="text-center py-8 text-text-muted">Carregando...</p>
      </Layout>
    );
  }

  if (seasons.length === 0) {
    return (
      <Layout title="Hall dos Campeões">
        <div className="text-center py-12 space-y-2">
          <p className="text-text-muted">Nenhum bolão encerrado ainda.</p>
          <p className="text-sm text-text-muted">
            Os campeões aparecem aqui quando um bolão é finalizado.
          </p>
        </div>
      </Layout>
    );
  }

  const hasResults = !!season?.champion && season.champion.total_points > 0;

  function openSeason(bolaoId: string) {
    setSelectedId(bolaoId);
    setView('campeao');
  }

  if (view === 'temporadas') {
    return (
      <Layout title="Hall dos Campeões">
        <div className="space-y-4">
          <SegmentedControl
            label="Visão do Hall"
            options={SEGMENTS}
            value={view}
            onChange={setView}
          />
          <SeasonGallery seasons={seasons} onSelect={openSeason} />
          <BiggestWinners seasons={seasons} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Hall dos Campeões">
      <div className="space-y-4">
        {/* The switcher always shows: with one season the gallery still has its row and
            the winners card. The chips do not, since there is nothing to choose. */}
        <SegmentedControl
          label="Visão do Hall"
          options={SEGMENTS}
          value={view}
          onChange={setView}
        />

        {seasons.length > 1 && (
          <SeasonChips
            seasons={seasons}
            selectedId={season.bolao.id}
            onSelect={setSelectedId}
          />
        )}

        {!hasResults ? (
          <p className="text-center py-8 text-text-muted">
            Sem resultados registrados neste bolão.
          </p>
        ) : (
          <>
            <ChampionHero season={season} rounds={rounds?.length} />

            {season.tiedForFirst && (
              <p className="text-xs text-center text-text-muted">
                Empate na liderança — critérios de desempate esgotados.
              </p>
            )}

            <RunnersUp runnerUp={season.runnerUp} third={season.third} />

            <FinalStandings ranking={season.ranking} />
          </>
        )}
      </div>
    </Layout>
  );
}
