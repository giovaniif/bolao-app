import { scopedPath } from '../../../shared/api/scopedPath';
import { API_BASE } from '../../../shared/api/client';

function getToken(): string | null {
  return localStorage.getItem('token');
}

export async function downloadExportRound(round: number, bolaoId?: string, scope?: string): Promise<void> {
  const token = getToken();
  if (!token) throw new Error('Não autenticado');
  const path = bolaoId ? `/export/round/${round}?bolao_id=${bolaoId}` : scopedPath(`/export/round/${round}`, scope);
  const res = await fetch(`${API_BASE}${path}`, {
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

export async function downloadExportAll(bolaoId?: string, scope?: string): Promise<void> {
  const token = getToken();
  if (!token) throw new Error('Não autenticado');
  const path = bolaoId ? `/export/all?bolao_id=${bolaoId}` : scopedPath('/export/all', scope);
  const res = await fetch(`${API_BASE}${path}`, {
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
