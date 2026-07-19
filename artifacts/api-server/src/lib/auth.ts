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
