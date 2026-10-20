export function scopedPath(path: string, scope?: string): string {
  return scope ? `/boloes/${scope}${path}` : path;
}
