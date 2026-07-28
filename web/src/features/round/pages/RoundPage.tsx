import { useState } from 'react';
import { Layout } from '../../../shared/components/Layout';
import { ChipRow } from '../../../shared/components/ChipRow';
import { SegmentedControl } from '../../../shared/components/SegmentedControl';
import { useRoundInUrl } from '../../../shared/hooks/useRoundInUrl';
import { useTabInUrl } from '../../../shared/hooks/useTabInUrl';
import { useRounds, useActiveRound } from '../../matches/hooks/useMatches';
import { useActiveBolao, useBolaoParticipants } from '../../boloes/hooks/useBoloes';
import { PartialsPanel } from '../../parciais/components/PartialsPanel';
import { PlayerPredictionsPanel } from '../../viewPredictions/components/PlayerPredictionsPanel';

/** Values stay Portuguese: they are user-facing and appear in shared links. */
const TABS = ['parciais', 'galera'] as const;
export type RoundTab = (typeof TABS)[number];

const SEGMENTS = [
  { value: 'parciais' as const, label: 'Parciais', panelId: 'panel-partials' },
  { value: 'galera' as const, label: 'Galera', panelId: 'panel-players' },
];

export function RoundPage() {
  const { data: rounds = [] } = useRounds();
  const { data: activeRound } = useActiveRound();
  const [round, setRound] = useRoundInUrl(rounds, activeRound);
  const [tab, setTab] = useTabInUrl<RoundTab>('aba', TABS, 'parciais');

  const { data: activeBolao } = useActiveBolao();
  const { data: participants } = useBolaoParticipants(activeBolao?.id);

  // Panels mount on demand and are never unmounted: swapping them with a ternary would
  // discard unsaved partial scores and the player selected on the other tab.
  const [visited, setVisited] = useState<ReadonlySet<RoundTab>>(() => new Set([tab]));
  if (!visited.has(tab)) {
    setVisited(new Set(visited).add(tab));
  }

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight">
            {round > 0 ? `Rodada ${round}` : 'Rodada'}
          </h1>
          {/* min-h keeps the row from reflowing when the count arrives. */}
          <span className="text-[13px] font-semibold text-[var(--color-text-muted)] min-h-5">
            {participants ? `${participants.length} jogadores` : ''}
          </span>
        </div>

        <ChipRow
          label="Rodada"
          items={rounds.map((r) => ({ value: r, label: `Rodada ${r}` }))}
          value={round}
          onChange={setRound}
        />

        <SegmentedControl
          label="Visão da rodada"
          options={SEGMENTS}
          value={tab}
          onChange={setTab}
        />

        {visited.has('parciais') && (
          <div id="panel-partials" role="tabpanel" hidden={tab !== 'parciais'}>
            <PartialsPanel round={round} />
          </div>
        )}
        {visited.has('galera') && (
          <div id="panel-players" role="tabpanel" hidden={tab !== 'galera'}>
            <PlayerPredictionsPanel round={round} />
          </div>
        )}
      </div>
    </Layout>
  );
}
