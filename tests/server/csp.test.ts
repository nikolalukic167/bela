import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, cspPlugin } from '../../config/csp';

const directives = (p: string) => Object.fromEntries(p.split(';').map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));

describe('content security policy (architecture §9.5)', () => {
  it('allows scripts only from the app itself: no inline scripts, no eval', () => {
    const d = directives(contentSecurityPolicy('https://happy-cat-123.convex.cloud'));
    expect(d['default-src']).toEqual(["'self'"]);
    expect(d['script-src']).toEqual(["'self'"]);
    expect(d['object-src']).toEqual(["'none'"]);
    expect(d['base-uri']).toEqual(["'self'"]);
  });

  it('connects only to this build’s own Convex deployment, over https and wss', () => {
    const d = directives(contentSecurityPolicy('https://happy-cat-123.convex.cloud'));
    expect(d['connect-src']).toEqual(["'self'", 'https://happy-cat-123.convex.cloud', 'wss://happy-cat-123.convex.cloud']);
    expect(directives(contentSecurityPolicy('http://127.0.0.1:3210'))['connect-src']).toContain('ws://127.0.0.1:3210');
    expect(directives(contentSecurityPolicy(undefined))['connect-src']).toEqual(["'self'"]);
  });

  it('allows the Google fonts and Google avatars the UI uses', () => {
    const d = directives(contentSecurityPolicy(undefined));
    expect(d['style-src']).toContain('https://fonts.googleapis.com');
    expect(d['font-src']).toContain('https://fonts.gstatic.com');
    expect(d['img-src']).toEqual(["'self'", 'data:', 'https://lh3.googleusercontent.com']);
  });

  it('is added to the page only in production builds (the dev server needs an inline script)', () => {
    const plugin = cspPlugin('https://x.convex.cloud');
    expect(plugin.apply).toBe('build');
    const html = (plugin.transformIndexHtml as (h: string) => string)('<head>\n<meta charset="UTF-8" />\n</head>');
    expect(html).toMatch(/<meta http-equiv="Content-Security-Policy" content="default-src 'self';[^"]*wss:\/\/x\.convex\.cloud[^"]*" \/>/);
  });
});
