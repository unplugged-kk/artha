# Cloudflare

Cloudflare cannot host Artha's backend (a long-running server with scheduled jobs and in-memory sessions is not what Workers are), so Cloudflare's role here is the **front door** and, optionally, **object storage**. The two supported shapes are below. Nothing here was deployed from this repository's sandbox; the Tunnel overlay was checked only in the sense that Docker Compose renders and merges it correctly.

## A. Cloudflare Tunnel in front of the Docker stack (recommended)

`docker-compose.cloudflare.yml` adds a `cloudflared` container to the production stack. The tunnel dials out to Cloudflare, so no inbound port is opened, and the overlay removes the frontend's published port so the tunnel is the only way in.

1. In Cloudflare, create a tunnel (Zero Trust, Networks, Tunnels) and copy its token.
2. Give the tunnel one public hostname pointing at `http://frontend:3000` (use your `FRONTEND_PORT` if you changed it).
3. Put the token and your address in `.env`:
   ```
   CLOUDFLARE_TUNNEL_TOKEN=<token>
   PUBLIC_APP_URL=https://artha.example.com
   ```
4. Start the stack:
   ```bash
   docker compose -f docker-compose.prod.yml -f docker-compose.cloudflare.yml up -d
   ```

The overlay also sets `CLIENT_IP_HEADER=CF-Connecting-IP` on the frontend, so the visitor's real address (not Cloudflare's edge) reaches rate limiting and the device records. That is safe only because nothing but the tunnel can reach the frontend; if you ever publish its port again, remove the setting, or anyone can send that header and choose their own address.

What was verified: with a dummy environment, `docker compose ... config` merges the two files, leaves the frontend with no published port, wires the token and the header, and refuses to start when the token is missing.

## B. Cloudflare proxying a Railway or VPS origin

Point the DNS record at the origin and turn the proxy on (orange cloud). Then:

- Set `CLIENT_IP_HEADER=CF-Connecting-IP` on the **frontend** only if the origin accepts traffic from Cloudflare alone (firewall it to Cloudflare's published ranges, or use Authenticated Origin Pulls). Otherwise leave it unset.
- If you also use Cloudflare in front of another proxy, check `TRUST_PROXY_HOPS` on the backend against the number of proxies between the visitor and it.

## Upload size

Cloudflare limits the request body it will proxy, and the limit depends on the plan. A Microsoft Money file can be hundreds of MB (`MNY_IMPORT_LIMIT_MB` defaults to 300). Check your plan's current limit; if it is lower than your file, do that import over a path that bypasses Cloudflare (the tunnel hostname can be left off for a second, direct hostname, or use the LAN address).

## R2 for attachments

Attachments default to the database. To use Cloudflare R2 instead (S3-compatible):

```
ATTACHMENT_STORAGE_PROVIDER=s3
ATTACHMENT_S3_BUCKET=<bucket>
ATTACHMENT_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
ATTACHMENT_S3_REGION=auto
```

plus the access key pair (see `.env.example` for the credential variable names). This was not run against R2.

## Not attempted

- **The frontend on Workers or Pages** (through the OpenNext adapter). It was not built or tested. The frontend uses a Node-runtime proxy (`src/proxy.ts`) that buffers request bodies, native PDF and image tooling, and a vendored OpenCV build, all of which would need checking against the Workers runtime. If you want it, build in a throwaway branch first and expect to adapt the proxy.
- **The backend on Cloudflare Containers.** Not tested. The single-replica rule (see the overview) would apply.
