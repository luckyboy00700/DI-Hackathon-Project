/** Merge conditional class names. Kept tiny on purpose — no runtime dependency needed. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
