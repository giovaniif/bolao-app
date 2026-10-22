import { useState } from 'react';
import { useFavoriteTeamStep } from '../hooks/useFavoriteTeamStep';
import { TeamStep } from './TeamStep';

interface TeamOnboardingProps {
  onDone: () => void;
}

export function TeamOnboarding({ onDone }: TeamOnboardingProps) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const step = useFavoriteTeamStep();
  return (
    <TeamStep
      teams={step.teams}
      query={query}
      selected={selected}
      saving={step.saving || (selected !== '' && !step.ready)}
      error={step.error}
      onQueryChange={setQuery}
      onSelect={setSelected}
      onStart={() => step.save(selected, onDone)}
      onSkip={onDone}
    />
  );
}
