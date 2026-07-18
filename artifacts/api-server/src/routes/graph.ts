import { Router } from "express";
import { sql } from "drizzle-orm";
import { db, memoriesTable } from "@workspace/db";
import { GetGraphQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/graph", async (req, res): Promise<void> => {
  const parsed = GetGraphQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { limit = 100 } = parsed.data;

  const memories = await db
    .select()
    .from(memoriesTable)
    .where(sql`${memoriesTable.status} = 'ready'`)
    .limit(limit);

  type NodeType = "memory" | "person" | "organization" | "topic" | "date" | "location" | "task";

  const nodes: Array<{
    id: string;
    type: NodeType;
    label: string;
    count: number;
    memoryId: number | null;
  }> = [];
  const edges: Array<{
    source: string;
    target: string;
    type: string;
    weight: number;
  }> = [];

  const entityCounts = new Map<string, number>();
  const seenNodes = new Set<string>();

  function addEntityNode(id: string, type: NodeType, label: string) {
    if (!seenNodes.has(id)) {
      seenNodes.add(id);
      nodes.push({ id, type, label, count: 1, memoryId: null });
    } else {
      const node = nodes.find((n) => n.id === id);
      if (node) node.count++;
    }
    entityCounts.set(id, (entityCounts.get(id) ?? 0) + 1);
  }

  for (const m of memories) {
    const memNodeId = `memory-${m.id}`;

    // Add memory node
    if (!seenNodes.has(memNodeId)) {
      seenNodes.add(memNodeId);
      nodes.push({
        id: memNodeId,
        type: "memory",
        label: m.title ?? m.originalName,
        count: 1,
        memoryId: m.id,
      });
    }

    // Add people
    for (const person of m.people.slice(0, 5)) {
      const nodeId = `person-${person.toLowerCase().replace(/\s+/g, "-")}`;
      addEntityNode(nodeId, "person", person);
      edges.push({ source: memNodeId, target: nodeId, type: "mentions_person", weight: 1 });
    }

    // Add organizations
    for (const org of m.organizations.slice(0, 3)) {
      const nodeId = `org-${org.toLowerCase().replace(/\s+/g, "-")}`;
      addEntityNode(nodeId, "organization", org);
      edges.push({ source: memNodeId, target: nodeId, type: "mentions_org", weight: 1 });
    }

    // Add topics
    for (const topic of m.topics.slice(0, 5)) {
      const nodeId = `topic-${topic.toLowerCase().replace(/\s+/g, "-")}`;
      addEntityNode(nodeId, "topic", topic);
      edges.push({ source: memNodeId, target: nodeId, type: "has_topic", weight: 1 });
    }

    // Add locations (limit)
    for (const loc of m.locations.slice(0, 2)) {
      const nodeId = `location-${loc.toLowerCase().replace(/\s+/g, "-")}`;
      addEntityNode(nodeId, "location", loc);
      edges.push({ source: memNodeId, target: nodeId, type: "mentions_location", weight: 0.8 });
    }
  }

  // Only keep entity nodes that appear more than once (to avoid clutter) or all if few nodes
  const filteredNodes = nodes.filter((n) => {
    if (n.type === "memory") return true;
    return n.count > 1 || nodes.length < 30;
  });

  const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = edges.filter(
    (e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)
  );

  res.json({ nodes: filteredNodes, edges: filteredEdges });
});

export default router;
