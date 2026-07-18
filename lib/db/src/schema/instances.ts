import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const instancesTable = pgTable("instances", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6366f1"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Instance = typeof instancesTable.$inferSelect;
