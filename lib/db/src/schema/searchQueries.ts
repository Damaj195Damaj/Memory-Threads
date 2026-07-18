import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const searchQueriesTable = pgTable("search_queries", {
  id: serial("id").primaryKey(),
  query: text("query").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
