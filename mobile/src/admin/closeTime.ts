const PATTERN = /^(\d{1,2})\/(\d{1,2}) (\d{1,2}):(\d{2})$/;

export function parseCloseTime(text: string, year: number): Date | null {
  const match = PATTERN.exec(text.trim());
  if (!match) {
    return null;
  }
  const [day, month, hour, minute] = match.slice(1).map(Number);
  if (hour > 23 || minute > 59) {
    return null;
  }
  const date = new Date(year, month - 1, day, hour, minute);
  if (date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatCloseTime(date: Date): string {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
