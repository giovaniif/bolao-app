import type { Consent } from './analytics';

export function ConsentBanner({ visible, onChoose }: { visible: boolean; onChoose: (consent: Consent) => void }) {
  if (!visible) return null;
  return (
    <div role="dialog" aria-label="Privacidade" className="fixed bottom-24 left-3 right-3 z-30 max-w-xl mx-auto rounded-xl bg-card border border-slate-600 p-4 shadow-xl space-y-3">
      <p className="text-sm">
        Podemos usar dados de uso, sem seu nome ou e-mail, para melhorar o app? Você pode mudar isso no perfil.
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={() => onChoose('denied')} className="flex-1 px-4 py-2 rounded-lg bg-bg border border-slate-600 text-sm">
          Recusar
        </button>
        <button type="button" onClick={() => onChoose('granted')} className="flex-1 px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold">
          Aceitar
        </button>
      </div>
    </div>
  );
}
