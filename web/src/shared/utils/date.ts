/**
 * Exibe data/hora UTC no fuso do dispositivo do usuário
 */
export function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Converte ISO (UTC) para valor do datetime-local no fuso do dispositivo
 */
export function toDateTimeLocalValue(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Converte valor do datetime-local (hora local do dispositivo) para ISO UTC
 */
export function fromDateTimeLocalValue(localValue: string): string {
  return new Date(localValue).toISOString();
}
