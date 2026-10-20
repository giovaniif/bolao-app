import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../../shared/components/Layout';
import { Button } from '../../../shared/components/Button';
import { useCompetitions, useCreateBolao, useRules } from '../hooks/useCreateBolao';
import { RulesSummary } from '../components/RulesSummary';

type Step = 'name' | 'privacy' | 'rules';

const fieldClass =
  'w-full px-3 py-2 rounded-lg bg-card border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-primary';

export function CreateBolaoPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [competitionId, setCompetitionId] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [requiresApproval, setRequiresApproval] = useState(true);
  const { data: competitions = [] } = useCompetitions();
  const { data: rules } = useRules();
  const create = useCreateBolao();
  const competition = competitionId || competitions[0]?.id || '';
  const validName = name.trim().length >= 3 && name.trim().length <= 100;

  async function submit() {
    const bolao = await create.mutateAsync({
      settings: { name: name.trim(), visibility, requires_approval: requiresApproval },
      competitionId: competition || undefined,
    });
    navigate(`/?bolao=${bolao.id}`);
  }

  return (
    <Layout title="Criar bolão">
      <ol className="flex gap-2 mb-5" aria-label="Etapas">
        {(['name', 'privacy', 'rules'] as Step[]).map((s) => (
          <li key={s} className={`h-1 flex-1 rounded-full ${s === step || (s === 'name' && step !== 'name') || (s === 'privacy' && step === 'rules') ? 'bg-primary' : 'bg-card'}`} />
        ))}
      </ol>

      {step === 'name' && (
        <div className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="bolao-name" className="block text-sm text-text-muted">Nome do bolão</label>
            <input id="bolao-name" className={fieldClass} value={name} maxLength={100} placeholder="Bolão da firma" onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label htmlFor="bolao-competition" className="block text-sm text-text-muted">Campeonato</label>
            <select id="bolao-competition" className={fieldClass} value={competition} onChange={(e) => setCompetitionId(e.target.value)}>
              {competitions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="text-xs text-text-muted">Os jogos e resultados entram sozinhos. O bolão começa na próxima rodada.</p>
          </div>
          <Button className="w-full" disabled={!validName} onClick={() => setStep('privacy')}>Continuar</Button>
        </div>
      )}

      {step === 'privacy' && (
        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm text-text-muted mb-1">Quem pode encontrar o bolão</legend>
            <label className="flex items-start gap-3 p-3 rounded-xl bg-card border border-slate-700">
              <input type="radio" name="visibility" checked={visibility === 'private'} onChange={() => setVisibility('private')} className="mt-1" />
              <span><span className="font-semibold">Privado</span><br /><span className="text-xs text-text-muted">Só entra quem recebe o convite ou o código.</span></span>
            </label>
            <label className="flex items-start gap-3 p-3 rounded-xl bg-card border border-slate-700">
              <input type="radio" name="visibility" checked={visibility === 'public'} onChange={() => setVisibility('public')} className="mt-1" />
              <span><span className="font-semibold">Público</span><br /><span className="text-xs text-text-muted">Aparece em Explorar bolões para qualquer pessoa.</span></span>
            </label>
          </fieldset>
          <label className="flex items-start gap-3 p-3 rounded-xl bg-card border border-slate-700">
            <input type="checkbox" checked={requiresApproval} onChange={(e) => setRequiresApproval(e.target.checked)} className="mt-1" />
            <span><span className="font-semibold">Aprovar quem pede para entrar</span><br /><span className="text-xs text-text-muted">Quem entra pelo código ou por Explorar espera sua aprovação. Seus links de convite entram direto.</span></span>
          </label>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setStep('name')}>Voltar</Button>
            <Button className="flex-1" onClick={() => setStep('rules')}>Continuar</Button>
          </div>
        </div>
      )}

      {step === 'rules' && (
        <div className="space-y-4">
          <p className="text-sm text-text-muted">Todos os bolões seguem as mesmas regras. Os pontos de cada jogo somam:</p>
          {rules && <RulesSummary rules={rules} />}
          {create.error && <p className="text-sm text-red-400">{create.error.message}</p>}
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setStep('privacy')}>Voltar</Button>
            <Button className="flex-1" disabled={create.isPending} onClick={submit}>Criar bolão</Button>
          </div>
        </div>
      )}
    </Layout>
  );
}
