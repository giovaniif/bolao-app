import type { PushStatus } from '../pushSupport';

interface PushToggleProps {
  status: PushStatus | undefined;
  isPending: boolean;
  error: Error | null;
  onEnable: () => void;
  onDisable: () => void;
}

const HINTS: Partial<Record<PushStatus, string>> = {
  'needs-install':
    'No iPhone, os avisos só funcionam com o app instalado: toque em Compartilhar e depois em "Adicionar à Tela de Início".',
  unsupported: 'Este navegador não suporta notificações.',
  denied: 'As notificações estão bloqueadas. Libere nas configurações do navegador para receber avisos.',
};

export function PushToggle({ status, isPending, error, onEnable, onDisable }: PushToggleProps) {
  if (!status) return null;
  const on = status === 'on';
  const hint = HINTS[status];

  return (
    <section className="mt-8 pt-4 border-t border-card">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-medium">Avisos de rodada</h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Rodada nova, 1 dia e 10 minutos antes de fechar.
          </p>
        </div>
        {!hint && (
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label="Avisos de rodada"
            disabled={isPending}
            onClick={on ? onDisable : onEnable}
            className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${
              on ? 'bg-[var(--color-primary)]' : 'bg-slate-600'
            }`}
          >
            <span
              className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white transition-transform ${
                on ? 'translate-x-5' : ''
              }`}
            />
          </button>
        )}
      </div>
      {hint && <p className="mt-2 text-sm text-[var(--color-text-muted)]">{hint}</p>}
      {error && <p className="mt-2 text-sm text-red-400">{error.message}</p>}
    </section>
  );
}
