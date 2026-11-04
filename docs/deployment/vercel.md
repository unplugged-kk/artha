# Vercel

Vercel hosts the **frontend only**. The backend is a long-running server with scheduled jobs and in-memory MCP sessions, which Vercel's functions cannot be, so it runs on [Railway](railway.md), a VPS, or any container host, and Vercel forwards `/api/*` to it. **Not deployed from this repository's sandbox**; check the limits below against Vercel's current documentation.

## Steps

1. Deploy the backend and PostgreSQL somewhere reachable over public HTTPS (the Railway guide, with a public domain on the backend).
2. In Vercel: **Add New Project**, import the repository, set **Root Directory** to `frontend`. `frontend/vercel.json` sets the Next.js framework, `npm ci` and `npm run build`.
3. Vercel environment variables:
   ```
   INTERNAL_API_URL=https://<your backend's public URL>
   ```
4. On the backend:
   ```
   PUBLIC_APP_URL=https://<your Vercel domain>
   CORS_ORIGIN=https://<your Vercel domain>
   TRUST_PROXY_HOPS=2
   ```
5. Redeploy the backend, open the Vercel domain, register.

The browser only talks to the Vercel domain; `src/proxy.ts` forwards API calls, so cookies stay first-party and nothing cross-origin is involved.

## Limits you will hit

- **Upload size.** The proxy reads a whole request body before forwarding it, and Vercel caps a function's request body at a few megabytes. Statement files that size are fine; **Microsoft Money (`.mny`) imports and big attachments will fail** on this topology. Do those imports from a Railway or self-hosted frontend pointed at the same backend.
- **MCP.** Connect MCP clients straight to the backend's `/api/v1/mcp`, not through Vercel: the long-lived streaming responses MCP uses are not what a serverless function is for.
- **Client addresses.** If every visitor seems to share one IP (rate limiting trips for everyone), `TRUST_PROXY_HOPS` is one too low for the number of platform edges between the visitor and the backend. Raise it by one.
- **A public backend URL.** The backend is reachable directly. CORS and CSRF protections still apply, but if you can, restrict it to Vercel's egress or put a shared secret in front of it.
- **Database**: never connect from Vercel. The backend holds the connection; use `DATABASE_URL` there with a direct (non-pooled) connection.
