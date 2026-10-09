// Content Security Policy for the static build (architecture §9.5). GitHub Pages can't set
// response headers, so it ships as a <meta> tag, and only in production builds: Vite's dev
// server injects an inline script that this policy would (rightly) block.
import type { Plugin } from 'vite';

/** The policy for a build talking to the Convex deployment at `convexUrl` (if any). */
export function contentSecurityPolicy(convexUrl: string | undefined): string {
  const connect = ["'self'"];
  if (convexUrl) {
    const { protocol, host } = new URL(convexUrl);
    connect.push(`${protocol}//${host}`, `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}`);
  }
  return [
    "default-src 'self'",
    "script-src 'self'",
    // Inline style attributes come from React and SVG cards; styles can't run code.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https://lh3.googleusercontent.com",
    `connect-src ${connect.join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

export function cspPlugin(convexUrl: string | undefined): Plugin {
  return {
    name: 'karte-csp',
    apply: 'build',
    transformIndexHtml: (html: string) =>
      html.replace(/<meta charset="UTF-8" \/>/, (m) => `${m}\n    <meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(convexUrl)}" />`),
  };
}
