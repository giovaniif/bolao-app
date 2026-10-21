export function scopedPath(path: string, scope: string): string {
  return `/boloes/${scope}${path}`;
}
