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
  { name: 'admin', path: '/admin', shows: 'Flamengo' },
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
