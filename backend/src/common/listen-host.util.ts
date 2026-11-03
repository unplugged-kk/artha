/**
 * Which address the HTTP server binds to.
 *
 * Unset keeps Node's default (every interface, which is what a container
 * needs). Setting it to `127.0.0.1` keeps a server off the network: the native
 * installer does that for the backend, so the only way in is the frontend, which
 * is the hop that sets the client address the backend's rate limiting trusts.
 * Anything that is not a plain IP address or host name is refused rather than
 * passed to `listen`.
 */
const HOST_PATTERN = /^[A-Za-z0-9.:_-]{1,253}$/;

export function resolveListenHost(raw: string | undefined): string | undefined {
  if (raw === undefined || raw.trim() === "") return undefined;
  const host = raw.trim();
  if (!HOST_PATTERN.test(host)) {
    throw new Error("LISTEN_HOST must be an IP address or host name");
  }
  return host;
}
