import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const instancesTable = pgTable("instances", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6366f1"),
  // Nullable only to accommodate legacy rows created before auth existed;
  // unowned instances are adopted by the first registered user and all
  // ownership checks treat NULL as "not owned by anyone".
  userId: integer("user_id").references(() => usersTable.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Instance = typeof instancesTable.$inferSelect;
