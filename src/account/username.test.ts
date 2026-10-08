import { describe, expect, it } from 'vitest';
import { emailToUsername, isValidUsername, normalizeUsername, usernameToEmail } from './username';

describe('usernames', () => {
  it('round-trips through the reserved address', () => {
    expect(usernameToEmail('  Nikola_1 ')).toBe('nikola_1@users.karte.invalid');
    expect(emailToUsername('nikola_1@users.karte.invalid')).toBe('nikola_1');
  });
  it('rejects anything that is not a plain username', () => {
    for (const bad of ['ab', 'a'.repeat(25), 'has space', 'a@b', 'čšž', '', 'x/y']) expect(isValidUsername(bad)).toBe(false);
    for (const good of ['abc', 'a.b-c_9', 'A'.repeat(24)]) expect(isValidUsername(good)).toBe(true);
  });
  it('refuses real email addresses, so the Password provider cannot be used with them', () => {
    expect(emailToUsername('someone@gmail.com')).toBeNull();
    expect(emailToUsername('a@users.karte.invalid.evil.com')).toBeNull();
    expect(emailToUsername('x y@users.karte.invalid')).toBeNull();
  });
  it('normalizes case and whitespace', () => {
    expect(normalizeUsername(' MiXed ')).toBe('mixed');
  });
});
