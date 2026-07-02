import type { Request, Response, NextFunction } from "express";

/**
 * IP allowlist middleware.
 *
 * When TRUSTED_PROXIES is set (comma-separated IPs/CIDRs), only connections
 * whose TCP socket peer address matches the list are accepted.
 * Checking req.socket.remoteAddress (the actual TCP peer) is safe against
 * spoofed X-Forwarded-For headers.
 *
 * When TRUSTED_PROXIES is empty / unset the middleware is a no-op so local
 * development works without extra config.
 */

const raw = process.env.TRUSTED_PROXIES ?? "";
const trustedIps = raw
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function normalizeIp(addr: string): string {
  // Normalize IPv6-mapped IPv4: "::ffff:192.168.1.1" → "192.168.1.1"
  return addr.replace(/^::ffff:/, "");
}

export function ipAllowlist(req: Request, res: Response, next: NextFunction): void {
  if (trustedIps.length === 0) {
    // No restriction configured — allow all (local dev)
    next();
    return;
  }

  const remote = req.socket.remoteAddress ?? "";
  const ip = normalizeIp(remote);

  if (trustedIps.includes(ip)) {
    next();
    return;
  }

  res.status(403).json({ error: "Forbidden" });
}
