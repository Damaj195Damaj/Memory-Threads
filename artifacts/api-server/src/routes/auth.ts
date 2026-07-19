import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { eq, isNull, sql } from "drizzle-orm";
import { db, usersTable, instancesTable } from "@workspace/db";
import { regenerateSession, destroySession } from "../lib/auth";
import { logger } from "../lib/logger";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

// Rate limiting is the primary brute-force / bot control on auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later" },
});

function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  return EMAIL_RE.test(email) && email.length <= 254 ? email : null;
}

// POST /auth/register
router.post("/auth/register", authLimiter, async (req, res): Promise<void> => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  if (!email) {
    res.status(400).json({ error: "A valid email is required" });
    return;
  }
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    });
    return;
  }

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email));
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const [{ count: userCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(usersTable);

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db
    .insert(usersTable)
    .values({ email, passwordHash })
    .returning({ id: usersTable.id, email: usersTable.email });

  if (!user) {
    res.status(500).json({ error: "Failed to create account" });
    return;
  }

  // The very first account adopts legacy (pre-auth) workspaces so existing
  // data stays reachable instead of being orphaned forever.
  if (Number(userCount) === 0) {
    const adopted = await db
      .update(instancesTable)
      .set({ userId: user.id })
      .where(isNull(instancesTable.userId))
      .returning({ id: instancesTable.id });
    if (adopted.length > 0) {
      logger.info(
        { userId: user.id, count: adopted.length },
        "First user adopted legacy workspaces",
      );
    }
  }

  await regenerateSession(req); // rotate session ID on privilege change
  req.session.userId = user.id;

  res.status(201).json({ id: user.id, email: user.email });
});

// POST /auth/login
router.post("/auth/login", authLimiter, async (req, res): Promise<void> => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  if (!email || typeof password !== "string" || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));

  // Same error for unknown email and wrong password (no account enumeration)
  const valid = user && (await bcrypt.compare(password, user.passwordHash));
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  await regenerateSession(req); // rotate session ID on login
  req.session.userId = user.id;

  res.json({ id: user.id, email: user.email });
});

// POST /auth/logout
router.post("/auth/logout", async (req, res): Promise<void> => {
  await destroySession(req);
  res.clearCookie("mt.sid");
  res.json({ success: true });
});

// GET /auth/me
router.get("/auth/me", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const [user] = await db
    .select({ id: usersTable.id, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  if (!user) {
    await destroySession(req);
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json(user);
});

export default router;
