import { config } from './config';

// Defense-in-depth: validation runs before any moderation call so we never
// burn an Anthropic request on garbage, and never store raw HTML.

const HTML_TAG = /<[^>]+>/;

export function containsHtml(input: string): boolean {
  return HTML_TAG.test(input);
}

// Coarse filter for low-effort prompt-injection. Patterns are loaded from a
// private env var (see config.injectionPatterns), never hardcoded here — the
// repo is public, and a visible pattern list is a published bypass guide. The
// real defense is treating user content as data + the human pending queue.
export function looksLikeInjection(input: string): boolean {
  return config.injectionPatterns.some((re) => re.test(input));
}

// Collapse runs of whitespace and trim. We reject HTML outright rather than
// stripping it, so sanitization here is just normalization.
export function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

export interface ScreenResult {
  ok: boolean;
  reason?: string;
}

// Runs after Zod parse, before moderation.
export function screen(fields: { name: string; body: string }): ScreenResult {
  if (containsHtml(fields.name) || containsHtml(fields.body)) {
    return { ok: false, reason: 'HTML is not allowed in a note.' };
  }
  if (looksLikeInjection(fields.body) || looksLikeInjection(fields.name)) {
    return { ok: false, reason: 'Submission rejected.' };
  }
  return { ok: true };
}
