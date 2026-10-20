import { useState } from 'react';
import { Button } from '../../../shared/components/Button';

export function InviteCard({
  code,
  link,
  onCreateLink,
  creating,
}: {
  code?: string;
  link?: string;
  onCreateLink: () => void;
  creating: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    if (!link) return;
    const data = { title: 'Bolão', text: 'Entra no meu bolão!', url: link };
    if (navigator.share) {
      await navigator.share(data).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(link);
    setCopied(true);
  }

  return (
    <section aria-label="Convidar" className="rounded-xl bg-card p-4 space-y-3">
      <h2 className="font-semibold">Convidar</h2>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-text-muted">Código do bolão</p>
          <p className="text-2xl font-extrabold tracking-widest">{code ?? '········'}</p>
        </div>
        <p className="text-xs text-text-muted max-w-[45%] text-right">Quem entra pelo código pode precisar da sua aprovação.</p>
      </div>
      {link ? (
        <div className="space-y-2">
          <input readOnly value={link} aria-label="Link de convite" className="w-full px-3 py-2 rounded-lg bg-bg border border-slate-600 text-sm" />
          <Button className="w-full" onClick={share}>{copied ? 'Link copiado' : 'Compartilhar link'}</Button>
          <p className="text-xs text-text-muted">O link entra direto, sem aprovação, e vale por 7 dias.</p>
        </div>
      ) : (
        <Button variant="secondary" className="w-full" disabled={creating} onClick={onCreateLink}>
          Criar link de convite
        </Button>
      )}
    </section>
  );
}
