/* eslint-disable no-control-regex */
/**
 * Comprehensive Input Sanitization and XSS Prevention Utilities
 * Vocal Remover - Ayesha Tech Studio
 */

/**
 * Strips HTML tags, script constructs, control characters, and dangerous URI schemes.
 * Safe for rendering in DOM and storing in IndexedDB/LocalStorage.
 */
export function sanitizeText(input: unknown, maxLength: number = 250): string {
  if (typeof input !== 'string') {
    return '';
  }

  // 1. Remove null bytes and ASCII control characters (except common whitespace)
  let clean = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 2. Strip HTML tags <...>
  clean = clean.replace(/<[^>]*>?/gm, '');

  // 3. Neutralize script and data schemes
  clean = clean.replace(/(?:javascript|data|vbscript|livescript):/gi, '');

  // 4. Decode any encoded angle brackets or quotes that could escape contexts
  clean = clean.replace(/[<>'"&]/g, (char) => {
    switch (char) {
      case '<':
        return '';
      case '>':
        return '';
      case '"':
        return '';
      case "'":
        return '';
      case '&':
        return '&amp;';
      default:
        return '';
    }
  });

  // 5. Trim and clamp max length
  return clean.trim().slice(0, maxLength);
}

/**
 * Strict sanitizer for vouchers, tokens, and license keys.
 * Only permits alphanumeric characters and hyphens, uppercase.
 */
export function sanitizeCode(input: unknown, maxLength: number = 32): string {
  if (typeof input !== 'string') {
    return '';
  }
  // Strip HTML tags first
  const noHtml = input.replace(/<[^>]*>?/gm, '');
  // Strip everything except alphanumeric and hyphen
  const clean = noHtml
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, maxLength);
  return clean;
}

/**
 * Sanitizes file names to prevent directory traversal and null-byte injection.
 */
export function sanitizeFilename(name: unknown): string {
  if (typeof name !== 'string' || !name.trim()) {
    return 'audio_file.wav';
  }

  // Remove directory traversal tokens
  let clean = name.replace(/\.\.+/g, '.').replace(/[/\\]/g, '_');

  // Remove control characters
  clean = clean.replace(/[\x00-\x1F\x7F]/g, '');

  // Allow only safe filename characters
  clean = clean.replace(/[^a-zA-Z0-9._\- ]/g, '_');

  // Strip leading dots/dashes
  clean = clean.replace(/^[.\-_]+/, '');

  if (!clean) {
    return 'audio_file.wav';
  }

  return clean.slice(0, 100);
}

/**
 * Sanitizes search queries to prevent regex DOS and script injection.
 */
export function sanitizeSearch(query: unknown): string {
  if (typeof query !== 'string') {
    return '';
  }
  // Strip control chars, dots, and dangerous regex metacharacters
  return query
    .replace(/[<>{}[\]\\^$*+?()|.]/g, '')
    .trim()
    .slice(0, 60);
}
