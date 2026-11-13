import { describe, it, expect } from 'vitest';
import { sanitizeText, sanitizeCode, sanitizeFilename, sanitizeSearch } from '../sanitize';

describe('Sanitization & Anti-XSS Utilities', () => {
  it('strips script tags and dangerous HTML in sanitizeText', () => {
    const malicious = '<script>alert("hacked")</script>Hello World';
    const clean = sanitizeText(malicious);
    expect(clean).not.toContain('<script>');
    expect(clean).not.toContain('</script>');
    expect(clean).toContain('Hello World');
  });

  it('neutralizes javascript: URIs', () => {
    const malicious = 'javascript:alert(1)';
    const clean = sanitizeText(malicious);
    expect(clean).not.toContain('javascript:');
  });

  it('removes null bytes and control characters', () => {
    const input = 'Song\x00Name\x08With\x1FControl';
    const clean = sanitizeText(input);
    expect(clean).toBe('SongNameWithControl');
  });

  it('clamps length to maxLength', () => {
    const longString = 'A'.repeat(500);
    const clean = sanitizeText(longString, 50);
    expect(clean.length).toBe(50);
  });

  it('strictly filters codes to alphanumeric and hyphens in sanitizeCode', () => {
    const dirty = ' tok10 - abcd <script> 1234 %$ ';
    const clean = sanitizeCode(dirty);
    expect(clean).toBe('TOK10-ABCD1234');
  });

  it('prevents path traversal in sanitizeFilename', () => {
    const traversal = '../../../etc/passwd.mp3';
    const clean = sanitizeFilename(traversal);
    expect(clean).not.toContain('../');
    expect(clean).not.toContain('/etc');
  });

  it('sanitizes search queries removing regex metacharacters', () => {
    const query = '(test.*)+?^$';
    const clean = sanitizeSearch(query);
    expect(clean).toBe('test');
  });
});

