import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const searchQueriesTable = pgTable("search_queries", {
  id: serial("id").primaryKey(),
  query: text("query").notNull(),
  // Scope search history per user (legacy rows are NULL and hidden from everyone)
  userId: integer("user_id").references(() => usersTable.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
