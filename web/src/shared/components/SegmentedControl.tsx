export interface Segment<T extends string> {
  value: T;
  label: string;
  /** id of the matching tabpanel, for aria-controls */
  panelId?: string;
}

interface SegmentedControlProps<T extends string> {
  options: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  /** aria-label for the tablist */
  label: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex gap-1 p-1 rounded-xl bg-[var(--color-card)]"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={option.panelId}
            onClick={() => onChange(option.value)}
            className={`flex-1 py-2 rounded-lg text-[13px] ${
              active
                ? 'bg-[var(--color-bg)] font-bold text-[var(--color-text)]'
                : 'font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
