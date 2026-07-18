import {
  pgTable,
  serial,
  text,
  integer,
  real,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { instancesTable } from "./instances";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const memoryStatusEnum = pgEnum("memory_status", [
  "pending",
  "processing",
  "ready",
  "error",
]);

export const memoriesTable = pgTable("memories", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  filePath: text("file_path").notNull(),
  title: text("title"),
  summary: text("summary"),
  content: text("content"),
  status: memoryStatusEnum("status").notNull().default("pending"),
  confidence: real("confidence"),
  tags: text("tags").array().notNull().default([]),
  people: text("people").array().notNull().default([]),
  organizations: text("organizations").array().notNull().default([]),
  locations: text("locations").array().notNull().default([]),
  dates: text("dates").array().notNull().default([]),
  tasks: text("tasks").array().notNull().default([]),
  topics: text("topics").array().notNull().default([]),
  instanceId: integer("instance_id").references(() => instancesTable.id, {
    onDelete: "cascade",
  }),
  errorMessage: text("error_message"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

export const insertMemorySchema = createInsertSchema(memoriesTable).omit({
  id: true,
  uploadedAt: true,
});
export type InsertMemory = z.infer<typeof insertMemorySchema>;
export type Memory = typeof memoriesTable.$inferSelect;
