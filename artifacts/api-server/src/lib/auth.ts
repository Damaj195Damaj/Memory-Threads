import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "@workspace/db";
import type { Request, RequestHandler } from "express";
import { logger } from "./logger";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

const isProduction = process.env.NODE_ENV === "production";

/**
 * Postgres-backed express-session middleware.
 * Sessions live in the "session" table (declared in the Drizzle schema),
 * so they are revocable server-side — not just a signed cookie.
 */
export function buildSessionMiddleware(): RequestHandler {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET must be set to enable authentication.");
  }
  const PgStore = connectPgSimple(session);
  return session({
    store: new PgStore({ pool, tableName: "session", createTableIfMissing: false }),
    secret,
    resave: false,
    saveUninitialized: false,
    name: "mt.sid",
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  });
}

/** Rejects unauthenticated requests with 401. */
export const requireAuth: RequestHandler = (req, res, next) => {
  if (req.session?.userId) {
    next();
    return;
  }
  res.status(401).json({ error: "Authentication required" });
};

/** Promisified session ID rotation (prevents session fixation on login). */
export function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

export function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => (err ? reject(err) : resolve()));
  });
}

/**
 * Server-side Cloudflare Turnstile verification.
 *
 * - When TURNSTILE_SECRET_KEY is configured, verification is mandatory:
 *   missing or invalid tokens are rejected.
 * - When it is NOT configured: production requests are rejected outright
 *   (a decorative, unverified widget must not ship), while development
 *   requests are allowed with a loud warning so local work isn't blocked
 *   before keys exist.
 */
export async function verifyTurnstile(
  token: unknown,
  remoteIp?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    if (isProduction) {
      return {
        ok: false,
        error: "Bot verification is not configured on the server.",
      };
    }
    logger.warn(
      "TURNSTILE_SECRET_KEY is not set — skipping bot verification (development only)",
    );
    return { ok: true };
  }

  if (typeof token !== "string" || !token) {
    return { ok: false, error: "Bot verification token missing" };
  }

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) body.set("remoteip", remoteIp);
    const resp = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body },
    );
    const data = (await resp.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!data.success) {
      logger.warn({ errors: data["error-codes"] }, "Turnstile verification failed");
      return { ok: false, error: "Bot verification failed" };
    }
    return { ok: true };
  } catch (err) {
    logger.error({ err }, "Turnstile siteverify request failed");
    return { ok: false, error: "Bot verification unavailable, try again" };
  }
}
