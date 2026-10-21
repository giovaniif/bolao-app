import { Link } from 'react-router-dom';

const CONTACT_EMAIL = 'suporte@giovani.app';
const UPDATED_AT = '21 de outubro de 2026';

const collected: { name: string; detail: string }[] = [
  { name: 'Usuário e senha', detail: 'para você entrar. A senha fica guardada só como hash (bcrypt).' },
  { name: 'Nome de exibição', detail: 'aparece para os outros participantes dos seus bolões.' },
  { name: 'E-mail (opcional)', detail: 'só para recuperar a senha. Não enviamos propaganda.' },
  { name: 'Time do coração (opcional)', detail: 'aparece no seu perfil e na classificação.' },
  { name: 'Palpites e pontos', detail: 'os placares que você palpita, os pontos e a sua posição em cada bolão.' },
  { name: 'Bolões e convites', detail: 'os bolões que você cria ou entra, e o seu papel em cada um.' },
  { name: 'Notificações', detail: 'se você ativar os avisos de rodada, guardamos o endereço de envio do seu navegador ou aparelho.' },
];

const services: { name: string; detail: string }[] = [
  {
    name: 'Sentry',
    detail: 'recebe relatórios de erro e travamento: o aparelho, o sistema, a versão do app e o seu id interno. Removemos e-mails, senhas e tokens antes do envio.',
  },
  {
    name: 'PostHog',
    detail: 'mede o uso do app (telas e ações) só se você aceitar. Você pode desligar a qualquer momento no perfil. Os dados ficam na União Europeia.',
  },
  { name: 'Supabase e Render', detail: 'hospedam o banco de dados e o servidor do app.' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-[var(--color-primary)]">{title}</h2>
      {children}
    </section>
  );
}

function ItemList({ items }: { items: { name: string; detail: string }[] }) {
  return (
    <ul className="list-disc pl-5 space-y-1">
      {items.map((item) => (
        <li key={item.name}>
          <strong>{item.name}</strong>: {item.detail}
        </li>
      ))}
    </ul>
  );
}

export function PrivacyPage() {
  return (
    <main className="min-h-screen p-4 safe-area-pt">
      <article className="max-w-2xl mx-auto space-y-6 text-sm leading-relaxed text-[var(--color-text-muted)]">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-[var(--color-primary)]">Privacidade e termos de uso</h1>
          <p>Atualizado em {UPDATED_AT}.</p>
        </header>

        <p>
          O Bolão é um app para grupos de amigos palpitarem os placares do Brasileirão e acompanharem a classificação.
          Esta página diz quais dados o app guarda, para quê, e como apagar tudo.
        </p>

        <Section title="Dados que guardamos">
          <ItemList items={collected} />
          <p>Não coletamos localização, contatos, fotos nem dados de pagamento. Não vendemos nem compartilhamos dados para publicidade.</p>
        </Section>

        <Section title="Serviços de terceiros">
          <ItemList items={services} />
        </Section>

        <Section title="Dinheiro e prêmios">
          <p>
            O app não recebe, não processa e não paga dinheiro. Não há apostas, compras nem prêmios dentro do app. Se um grupo
            combina uma taxa de entrada, isso é feito fora do app, entre os participantes, e o administrador do bolão pode só
            anotar quem já pagou.
          </p>
        </Section>

        <Section title="Como excluir sua conta">
          <p>
            No app, abra o perfil e toque em <strong>Excluir minha conta</strong>. Isso apaga na hora o seu usuário, palpites, pontos,
            e-mail e inscrições de notificação. Relatórios de erro antigos no Sentry expiram sozinhos pelo prazo de retenção do serviço.
          </p>
          <p>
            Se não conseguir entrar, peça a exclusão pelo e-mail{' '}
            <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </Section>

        <Section title="Termos de uso">
          <ul className="list-disc pl-5 space-y-1">
            <li>Use o app só para bolões entre pessoas que se conhecem, sem fins comerciais.</li>
            <li>Você responde pelo nome e pelo conteúdo que publica. Não use nomes ofensivos.</li>
            <li>O administrador de um bolão pode aprovar, remover participantes e corrigir resultados.</li>
            <li>Os resultados dos jogos vêm de fontes públicas e podem ter atraso ou erro.</li>
            <li>O app é oferecido como está, sem garantia de funcionamento contínuo.</li>
          </ul>
        </Section>

        <Section title="Contato">
          <p>
            Dúvidas ou pedidos sobre os seus dados (LGPD):{' '}
            <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </Section>

        <p>
          <Link className="underline" to="/login">Voltar para o app</Link>
        </p>
      </article>
    </main>
  );
}
