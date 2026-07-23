import { API_BASE } from '../../../shared/api/client';

function getToken(): string | null {
  return localStorage.getItem('token');
}

export async function downloadExportRound(round: number, bolaoId?: string): Promise<void> {
  const token = getToken();
  if (!token) throw new Error('Não autenticado');
  const q = bolaoId ? `?bolao_id=${bolaoId}` : '';
  const res = await fetch(`${API_BASE}/export/round/${round}${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Erro ao exportar');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bolao_rodada_${round}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadExportAll(bolaoId?: string): Promise<void> {
  const token = getToken();
  if (!token) throw new Error('Não autenticado');
  const q = bolaoId ? `?bolao_id=${bolaoId}` : '';
  const res = await fetch(`${API_BASE}/export/all${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Erro ao exportar');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bolao_todas_rodadas.csv';
  a.click();
  URL.revokeObjectURL(url);
}
