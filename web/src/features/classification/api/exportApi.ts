const API_BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

export async function downloadExportRound(round: number): Promise<void> {
  const token = getToken();
  if (!token) throw new Error('Não autenticado');
  const res = await fetch(`${API_BASE}/export/round/${round}`, {
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

export async function downloadExportAll(): Promise<void> {
  const token = getToken();
  if (!token) throw new Error('Não autenticado');
  const res = await fetch(`${API_BASE}/export/all`, {
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
