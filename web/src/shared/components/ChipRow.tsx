import { useEffect, useRef } from 'react';

export interface Chip<T extends string | number> {
  value: T;
  label: string;
}

interface ChipRowProps<T extends string | number> {
  items: readonly Chip<T>[];
  value: T;
  onChange: (value: T) => void;
  tone?: 'primary' | 'gold';
  /** aria-label for the tablist */
  label: string;
}

const TONES = {
  primary: 'bg-[var(--color-primary)]/16 border-[var(--color-primary)]/40 text-[var(--color-primary)]',
  gold: 'bg-[var(--color-accent)]/16 border-[var(--color-accent)]/40 text-[var(--color-accent)]',
} as const;

export function ChipRow<T extends string | number>({
  items,
  value,
  onChange,
  tone = 'primary',
  label,
}: ChipRowProps<T>) {
  const activeRef = useRef<HTMLButtonElement>(null);

  // A 38-round season would otherwise open scrolled to round 1.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [value]);

  if (items.length === 0) return null;

  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            ref={active ? activeRef : undefined}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={`shrink-0 px-3 py-1.5 rounded-full border text-xs whitespace-nowrap ${
              active
                ? `font-bold ${TONES[tone]}`
                : 'font-semibold bg-[var(--color-card)] border-transparent text-[var(--color-text-muted)]'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
