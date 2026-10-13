import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PushToggle } from './PushToggle';

function renderToggle(overrides: Partial<Parameters<typeof PushToggle>[0]> = {}) {
  const props = {
    status: 'off' as const,
    isPending: false,
    error: null,
    onEnable: vi.fn(),
    onDisable: vi.fn(),
    ...overrides,
  };
  render(<PushToggle {...props} />);
  return props;
}

describe('PushToggle', () => {
  it('turns notifications on from the off state', () => {
    const props = renderToggle({ status: 'off' });
    const toggle = screen.getByRole('switch', { name: 'Avisos de rodada' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    expect(props.onEnable).toHaveBeenCalled();
  });

  it('turns notifications off from the on state', () => {
    const props = renderToggle({ status: 'on' });
    fireEvent.click(screen.getByRole('switch'));
    expect(props.onDisable).toHaveBeenCalled();
  });

  it('tells iPhone users to add the app to the Home Screen instead of showing the switch', () => {
    renderToggle({ status: 'needs-install' });
    expect(screen.getByText(/Adicionar à Tela de Início/)).toBeTruthy();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('explains blocked permissions', () => {
    renderToggle({ status: 'denied' });
    expect(screen.getByText(/notificações estão bloqueadas/)).toBeTruthy();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('says when the browser has no push support', () => {
    renderToggle({ status: 'unsupported' });
    expect(screen.getByText(/não suporta notificações/)).toBeTruthy();
  });

  it('disables the switch while a change is in flight and shows errors', () => {
    renderToggle({ isPending: true, error: new Error('Permissão de notificação negada') });
    expect((screen.getByRole('switch') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Permissão de notificação negada')).toBeTruthy();
  });

  it('renders nothing until the status is known', () => {
    const { container } = render(
      <PushToggle status={undefined} isPending={false} error={null} onEnable={vi.fn()} onDisable={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });
});
