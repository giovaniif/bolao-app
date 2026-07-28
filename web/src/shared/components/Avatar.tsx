import { initials } from '../utils/initials';

type Size = 32 | 46 | 64;
type Tone = 'default' | 'gold' | 'muted';

interface AvatarProps {
  name: string;
  size?: Size;
  tone?: Tone;
  className?: string;
}

const SIZES: Record<Size, string> = {
  32: 'w-8 h-8 text-[13px] font-bold',
  46: 'w-[46px] h-[46px] text-[15px] font-bold',
  64: 'w-16 h-16 text-[22px] font-extrabold',
};

const TONES: Record<Tone, string> = {
  default: 'bg-card text-text',
  gold: 'bg-accent/18 border border-accent/50 text-accent',
  muted: 'bg-bg text-slate-300',
};

export function Avatar({ name, size = 32, tone = 'default', className = '' }: AvatarProps) {
  return (
    <span
      // The accessible name comes from the wrapping link or adjacent text; without this a
      // screen reader announces "MS Maria Silva".
      aria-hidden="true"
      className={`inline-flex items-center justify-center rounded-full shrink-0 ${SIZES[size]} ${TONES[tone]} ${className}`}
    >
      {initials(name)}
    </span>
  );
}
