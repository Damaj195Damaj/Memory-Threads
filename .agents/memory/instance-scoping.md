---
name: Workspace (instance) scoping rules for API routes
description: How instanceId must be validated and enforced across api-server routes
---

## Every route accepting instanceId must validate strictly
**Why:** `parseInt` silently turned invalid values ("abc", "1;DROP") into NaN → falsy → *unscoped global query*, breaking workspace isolation. Code review flagged this as broken access control.
**How to apply:** Use `parseInstanceId()` from `src/lib/instance-id.ts` in api-server; respond 400 on invalid, never fall back to unscoped.

## ID-based routes need ownership checks too
**Why:** `GET/DELETE /memories/:id` by global ID alone allows cross-workspace read/delete. Timeline edit/override rows must be stamped with `instanceId` on insert or they become global.
**How to apply:** When adding any new by-ID route touching memories or timeline_edits, accept optional `instanceId` and AND it into the where clause; stamp instanceId on all timeline_edits inserts.
