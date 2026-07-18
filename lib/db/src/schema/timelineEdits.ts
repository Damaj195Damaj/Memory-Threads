import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { instancesTable } from "./instances";

/**
 * Stores user modifications to the timeline:
 * - Custom events created by the user (isCustom = true, eventKey = null)
 * - Overrides/hides of auto-generated events (eventKey = auto event id like "event-9-0")
 */
export const timelineEditsTable = pgTable("timeline_edits", {
  id: serial("id").primaryKey(),
  eventKey: text("event_key").unique(),
  title: text("title"),
  description: text("description"),
  type: text("type"),
  date: timestamp("date", { withTimezone: true }),
  memoryId: integer("memory_id"),
  hidden: boolean("hidden").notNull().default(false),
  isCustom: boolean("is_custom").notNull().default(false),
  instanceId: integer("instance_id").references(() => instancesTable.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type TimelineEdit = typeof timelineEditsTable.$inferSelect;
