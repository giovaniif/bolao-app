import { ChipRow } from '../../../shared/components/ChipRow';
import type { Season } from '../hooks/useSeasons';

interface SeasonChipsProps {
  seasons: Season[];
  selectedId: string;
  onSelect: (bolaoId: string) => void;
}

/** Replaces the finished-bolão select. */
export function SeasonChips({ seasons, selectedId, onSelect }: SeasonChipsProps) {
  return (
    <ChipRow
      label="Temporada"
      tone="gold"
      items={seasons.map((s) => ({ value: s.bolao.id, label: s.bolao.name }))}
      value={selectedId}
      onChange={onSelect}
    />
  );
}
