export const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;

export function deriveUsername(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._]/g, '');
}
