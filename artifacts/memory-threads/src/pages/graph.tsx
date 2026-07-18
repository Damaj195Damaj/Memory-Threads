import React, { useMemo, useState } from 'react';
import { useGetGraph, getGetGraphQueryKey } from '@workspace/api-client-react';
import { GraphNode, GraphEdge } from '@workspace/api-client-react';
import { Loader2, Brain, Maximize, ZoomIn, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLocation } from 'wouter';
import { Input } from '@/components/ui/input';
import { useInstance } from '@/contexts/InstanceContext';

interface PositionedNode extends GraphNode {
  x: number;
  y: number;
}

export default function Graph() {
  const { activeInstanceId } = useInstance();
  const { data: graphData, isLoading } = useGetGraph(
    { instanceId: activeInstanceId! },
    { query: { enabled: !!activeInstanceId, queryKey: getGetGraphQueryKey({ instanceId: activeInstanceId! }) } }
  );
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  
  // Calculate static layout for nodes
  const positionedNodes = useMemo(() => {
    if (!graphData?.nodes) return [];

    const width = 1200;
    const height = 800;
    const cx = width / 2;
    const cy = height / 2;
    
    // Group nodes by type
    const grouped = graphData.nodes.reduce((acc, node) => {
      if (!acc[node.type]) acc[node.type] = [];
      acc[node.type].push(node);
      return acc;
    }, {} as Record<string, typeof graphData.nodes>);

    const types = Object.keys(grouped);
    const typeAngles = types.reduce((acc, type, idx) => {
      acc[type] = (idx / types.length) * Math.PI * 2;
      return acc;
    }, {} as Record<string, number>);

    let pNodes: PositionedNode[] = [];

    // Distribute nodes
    Object.entries(grouped).forEach(([type, nodes]) => {
      const baseAngle = typeAngles[type];
      
      nodes.forEach((node, i) => {
        // Memories in center, others scattered around based on type angle
        let radius, angle;
        
        if (type === 'memory') {
          radius = i === 0 ? 0 : 50 + Math.random() * 150;
          angle = (i / nodes.length) * Math.PI * 2;
        } else {
          radius = 250 + Math.random() * 150;
          angle = baseAngle + ((Math.random() - 0.5) * 1.5);
        }

        pNodes.push({
          ...node,
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius,
        });
      });
    });

    return pNodes;
  }, [graphData]);

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'memory': return 'hsl(var(--primary))';
      case 'person': return '#60A5FA';
      case 'organization': return '#A78BFA';
      case 'topic': return '#F472B6';
      case 'location': return '#34D399';
      case 'date': return '#FBBF24';
      default: return '#9CA3AF';
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-primary">
          <Loader2 className="w-10 h-10 animate-spin" />
          <p className="animate-pulse">Mapping connections...</p>
        </div>
      </div>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center">
          <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No graph data</h2>
          <p className="text-muted-foreground">Upload memories to see their connections.</p>
        </div>
      </div>
    );
  }

  const handleNodeClick = (node: PositionedNode) => {
    if (node.memoryId) {
      setLocation(`/memories/${node.memoryId}`);
    } else {
      // Just filter memories by this node's label
      setLocation(`/memories?q=${encodeURIComponent(node.label)}`);
    }
  };

  const filteredNodes = searchQuery 
    ? positionedNodes.filter(n => n.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : positionedNodes;

  return (
    <div className="h-full w-full flex flex-col relative overflow-hidden bg-background">
      <div className="absolute inset-0 bg-grid-pattern opacity-30" />
      
      <div className="absolute top-6 left-6 z-10 space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight glow-text">Knowledge Graph</h1>
          <p className="text-sm text-muted-foreground mt-1">Connections between your memories</p>
        </div>
        
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Find a node..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-black/40 border-white/10 backdrop-blur-md"
          />
        </div>

        <div className="glass-panel rounded-xl p-4 text-xs space-y-2 max-w-xs">
          <div className="font-semibold mb-3 border-b border-white/10 pb-2">Legend</div>
          <LegendItem color="hsl(var(--primary))" label="Memories" />
          <LegendItem color="#60A5FA" label="People" />
          <LegendItem color="#A78BFA" label="Organizations" />
          <LegendItem color="#F472B6" label="Topics" />
          <LegendItem color="#34D399" label="Locations" />
          <LegendItem color="#FBBF24" label="Dates/Events" />
        </div>
      </div>

      <div className="flex-1 w-full relative cursor-grab active:cursor-grabbing overflow-hidden">
        <motion.div 
          drag
          dragConstraints={{ left: -1000, right: 1000, top: -1000, bottom: 1000 }}
          className="absolute w-[1200px] h-[800px] left-1/2 top-1/2 -ml-[600px] -mt-[400px]"
        >
          <svg width="1200" height="800" className="overflow-visible pointer-events-none">
            {/* Draw Edges */}
            <g className="edges">
              {graphData.edges.map((edge, i) => {
                const sourceNode = positionedNodes.find(n => n.id === edge.source);
                const targetNode = positionedNodes.find(n => n.id === edge.target);
                
                if (!sourceNode || !targetNode) return null;
                
                // Highlight edges connected to search query
                const isHighlight = searchQuery && (
                  sourceNode.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
                  targetNode.label.toLowerCase().includes(searchQuery.toLowerCase())
                );
                const opacity = searchQuery ? (isHighlight ? 0.6 : 0.05) : 0.15;

                return (
                  <motion.line
                    key={i}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity }}
                    transition={{ duration: 1, delay: i * 0.01 }}
                    x1={sourceNode.x}
                    y1={sourceNode.y}
                    x2={targetNode.x}
                    y2={targetNode.y}
                    stroke={getNodeColor(targetNode.type)}
                    strokeWidth={edge.weight ? Math.max(1, edge.weight * 2) : 1}
                  />
                );
              })}
            </g>
          </svg>

          {/* Draw Nodes (using HTML/Framer for better interactivity/tooltips) */}
          {filteredNodes.map((node, i) => {
            const color = getNodeColor(node.type);
            const isMain = node.type === 'memory';
            const size = isMain ? 24 : 12 + Math.min((node.count || 1) * 2, 20);

            return (
              <motion.div
                key={node.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", delay: i * 0.02 }}
                style={{
                  position: 'absolute',
                  left: node.x,
                  top: node.y,
                  width: size,
                  height: size,
                  marginLeft: -size/2,
                  marginTop: -size/2,
                  backgroundColor: color,
                  boxShadow: `0 0 15px ${color}80`,
                }}
                className="rounded-full cursor-pointer hover:scale-125 transition-transform group pointer-events-auto"
                onClick={() => handleNodeClick(node)}
              >
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-black/80 border border-white/10 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                  {node.label} {node.count && `(${node.count})`}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string, label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
