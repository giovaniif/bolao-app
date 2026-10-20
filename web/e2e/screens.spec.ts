import { expect, test, type Page } from '@playwright/test';
import { NOW, mockApi, signIn } from './fixtures/api';

interface Screen {
  name: string;
  path: string;
  shows: string;
  signedIn?: boolean;
  act?: (page: Page) => Promise<void>;
}

const screens: Screen[] = [
  { name: 'login', path: '/login', shows: 'Entrar', signedIn: false },
  { name: 'cadastro', path: '/cadastro?voltar=%2Fconvite%2FFIRMA234', shows: 'Criar conta', signedIn: false },
  { name: 'classificacao', path: '/', shows: 'Bruno Lima' },
  { name: 'palpites', path: '/palpites', shows: 'Salvar palpites' },
  { name: 'rodada-parciais', path: '/rodada?aba=parciais', shows: 'Flamengo' },
  {
    name: 'rodada-galera',
    path: '/rodada?aba=galera&rodada=4',
    shows: 'Jogador',
    act: (page) => page.getByRole('combobox').selectOption({ label: 'Bruno Lima' }).then(() => undefined),
  },
  { name: 'perfil', path: '/perfil', shows: 'Avisos de rodada' },
  {
    name: 'menu-perfil',
    path: '/',
    shows: 'Bruno Lima',
    act: async (page) => {
      await page.getByRole('button', { name: 'Meu perfil' }).click();
      await expect(page.getByRole('menuitem', { name: 'Admin' })).toBeVisible();
    },
  },
  {
    name: 'troca-de-bolao',
    path: '/palpites',
    shows: 'Salvar palpites',
    act: async (page) => {
      await page.getByRole('button', { name: /Bolão 2026/ }).click();
      await expect(page.getByRole('menuitem', { name: /Bolão da Firma/ })).toBeVisible();
    },
  },
  { name: 'meus-boloes', path: '/meus-boloes', shows: 'Bolão da Firma' },
  {
    name: 'criar-bolao-regras',
    path: '/criar-bolao',
    shows: 'Nome do bolão',
    act: async (page) => {
      await page.getByLabel('Nome do bolão').fill('Bolão da Firma');
      await page.getByRole('button', { name: 'Continuar' }).click();
      await page.getByRole('button', { name: 'Continuar' }).click();
      await expect(page.getByText('Acertar o total de gols da rodada inteira')).toBeVisible();
    },
  },
  { name: 'convite-visitante', path: '/convite/FIRMA234', shows: 'Bolão da Firma', signedIn: false },
  { name: 'convite', path: '/convite/FIRMA234', shows: 'Pedir para entrar' },
  { name: 'entrar-com-codigo', path: '/entrar', shows: 'Código do bolão' },
  { name: 'membros', path: '/membros?bolao=b-firma', shows: 'FIRMA234' },
  { name: 'admin', path: '/admin', shows: 'Flamengo' },
  {
    name: 'admin-jogos',
    path: '/admin',
    shows: 'Flamengo',
    act: async (page) => {
      await page.getByRole('button', { name: 'Jogos' }).click();
      await expect(page.getByText('Corrigido')).toBeVisible();
    },
  },
  { name: 'hall-dos-campeoes', path: '/hall-dos-campeoes', shows: 'Ana Souza' },
];

for (const screen of screens) {
  test(`${screen.name} renders without errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    const unmocked = await mockApi(page);
    await page.clock.setFixedTime(NOW);
    if (screen.signedIn !== false) await signIn(page);

    await page.goto(screen.path);
    await expect(page.getByText(screen.shows).first()).toBeVisible();
    if (screen.act) await screen.act(page);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `e2e/screenshots/${screen.name}.png`, fullPage: true });

    expect(unmocked, 'API calls with no mock in e2e/fixtures/api.ts').toEqual([]);
    expect(errors, 'errors in the browser console').toEqual([]);
  });
}
