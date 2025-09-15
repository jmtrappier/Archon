/**
 * Graph Layout Algorithms
 *
 * Implementation of various layout algorithms for dependency graph visualization
 * Uses pure TypeScript/JavaScript without external graph libraries
 */

import type {
  DependencyNode,
  DependencyEdge,
  GraphLayout,
  DependencyEntityType,
} from "../types";

// Constants for layout algorithms
const LAYOUT_CONSTANTS = {
  FORCE: {
    CENTER_STRENGTH: 0.05,
    REPEL_STRENGTH: 100,
    LINK_STRENGTH: 0.1,
    DEFAULT_LINK_DISTANCE: 100,
    DAMPING: 0.9,
    MIN_ALPHA: 0.01,
    DEFAULT_ITERATIONS: 300,
  },
  HIERARCHICAL: {
    LEVEL_HEIGHT: 120,
    NODE_SPACING: 80,
    MIN_NODE_SPACING: 60,
  },
  CIRCULAR: {
    PADDING: 50,
  },
  TREE: {
    LEVEL_HEIGHT: 100,
    SIBLING_SPACING: 80,
  },
} as const;

// Node size mapping based on entity type
const NODE_SIZES = {
  epic: { width: 120, height: 80 },
  story: { width: 100, height: 70 },
  task: { width: 80, height: 60 },
} as const;

// Vector operations for force-directed layout
class Vector2D {
  constructor(public x: number = 0, public y: number = 0) {}

  add(other: Vector2D): Vector2D {
    return new Vector2D(this.x + other.x, this.y + other.y);
  }

  subtract(other: Vector2D): Vector2D {
    return new Vector2D(this.x - other.x, this.y - other.y);
  }

  multiply(scalar: number): Vector2D {
    return new Vector2D(this.x * scalar, this.y * scalar);
  }

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  normalize(): Vector2D {
    const len = this.length();
    if (len === 0) return new Vector2D(0, 0);
    return new Vector2D(this.x / len, this.y / len);
  }

  distance(other: Vector2D): number {
    return this.subtract(other).length();
  }
}

// Force-directed layout implementation
export class ForceDirectedLayout {
  private nodes: Map<string, { node: DependencyNode; position: Vector2D; velocity: Vector2D }> = new Map();
  private edges: DependencyEdge[] = [];
  private width: number;
  private height: number;
  private options: GraphLayout['options'];

  constructor(
    nodes: DependencyNode[],
    edges: DependencyEdge[],
    width: number,
    height: number,
    options: GraphLayout['options'] = {}
  ) {
    this.width = width;
    this.height = height;
    this.edges = edges;
    this.options = {
      nodeSpacing: options.nodeSpacing ?? LAYOUT_CONSTANTS.FORCE.DEFAULT_LINK_DISTANCE,
      centerForce: options.centerForce ?? LAYOUT_CONSTANTS.FORCE.CENTER_STRENGTH,
      repelForce: options.repelForce ?? LAYOUT_CONSTANTS.FORCE.REPEL_STRENGTH,
      linkDistance: options.linkDistance ?? LAYOUT_CONSTANTS.FORCE.DEFAULT_LINK_DISTANCE,
      iterations: options.iterations ?? LAYOUT_CONSTANTS.FORCE.DEFAULT_ITERATIONS,
    };

    this.initializeNodes(nodes);
  }

  private initializeNodes(nodes: DependencyNode[]): void {
    const centerX = this.width / 2;
    const centerY = this.height / 2;

    nodes.forEach((node) => {
      // Initialize with random position around center
      const angle = Math.random() * 2 * Math.PI;
      const radius = Math.min(this.width, this.height) * 0.3;

      this.nodes.set(node.id, {
        node,
        position: new Vector2D(
          centerX + Math.cos(angle) * radius,
          centerY + Math.sin(angle) * radius
        ),
        velocity: new Vector2D(0, 0),
      });
    });
  }

  public simulate(): DependencyNode[] {
    let alpha = 1.0;
    let iterations = 0;

    while (alpha > LAYOUT_CONSTANTS.FORCE.MIN_ALPHA && iterations < this.options.iterations!) {
      // Apply forces
      this.applyCenterForce(alpha);
      this.applyRepelForce(alpha);
      this.applyLinkForce(alpha);

      // Update positions
      this.updatePositions(alpha);

      // Decrease alpha
      alpha *= LAYOUT_CONSTANTS.FORCE.DAMPING;
      iterations++;
    }

    return this.getPositionedNodes();
  }

  private applyCenterForce(alpha: number): void {
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const strength = this.options.centerForce! * alpha;

    for (const nodeData of this.nodes.values()) {
      const force = new Vector2D(centerX - nodeData.position.x, centerY - nodeData.position.y);
      nodeData.velocity = nodeData.velocity.add(force.multiply(strength));
    }
  }

  private applyRepelForce(alpha: number): void {
    const strength = this.options.repelForce! * alpha;
    const nodeArray = Array.from(this.nodes.values());

    for (let i = 0; i < nodeArray.length; i++) {
      const nodeA = nodeArray[i];

      for (let j = i + 1; j < nodeArray.length; j++) {
        const nodeB = nodeArray[j];
        const distance = nodeA.position.distance(nodeB.position);

        if (distance === 0) continue;

        const force = nodeA.position.subtract(nodeB.position).normalize().multiply(strength / distance);

        nodeA.velocity = nodeA.velocity.add(force);
        nodeB.velocity = nodeB.velocity.subtract(force);
      }
    }
  }

  private applyLinkForce(alpha: number): void {
    const strength = LAYOUT_CONSTANTS.FORCE.LINK_STRENGTH * alpha;
    const linkDistance = this.options.linkDistance!;

    for (const edge of this.edges) {
      const sourceData = this.nodes.get(edge.source);
      const targetData = this.nodes.get(edge.target);

      if (!sourceData || !targetData) continue;

      const distance = sourceData.position.distance(targetData.position);
      if (distance === 0) continue;

      const force = targetData.position.subtract(sourceData.position)
        .normalize()
        .multiply(strength * (distance - linkDistance));

      sourceData.velocity = sourceData.velocity.add(force);
      targetData.velocity = targetData.velocity.subtract(force);
    }
  }

  private updatePositions(alpha: number): void {
    const damping = LAYOUT_CONSTANTS.FORCE.DAMPING;

    for (const nodeData of this.nodes.values()) {
      // Apply velocity with damping
      nodeData.position = nodeData.position.add(nodeData.velocity.multiply(alpha));

      // Apply damping to velocity
      nodeData.velocity = nodeData.velocity.multiply(damping);

      // Keep nodes within bounds
      const nodeSize = NODE_SIZES[nodeData.node.type];
      const halfWidth = nodeSize.width / 2;
      const halfHeight = nodeSize.height / 2;

      nodeData.position.x = Math.max(halfWidth, Math.min(this.width - halfWidth, nodeData.position.x));
      nodeData.position.y = Math.max(halfHeight, Math.min(this.height - halfHeight, nodeData.position.y));
    }
  }

  private getPositionedNodes(): DependencyNode[] {
    return Array.from(this.nodes.values()).map(nodeData => ({
      ...nodeData.node,
      position: { x: nodeData.position.x, y: nodeData.position.y },
    }));
  }
}

// Hierarchical layout implementation
export class HierarchicalLayout {
  private nodes: DependencyNode[];
  private edges: DependencyEdge[];
  private width: number;
  private height: number;
  private levels: Map<number, DependencyNode[]> = new Map();

  constructor(
    nodes: DependencyNode[],
    edges: DependencyEdge[],
    width: number,
    height: number
  ) {
    this.nodes = nodes;
    this.edges = edges;
    this.width = width;
    this.height = height;

    this.buildHierarchy();
  }

  private buildHierarchy(): void {
    // Assign levels based on entity type and dependencies
    const levels = new Map<DependencyEntityType, number>({
      epic: 0,
      story: 1,
      task: 2,
    });

    // Group nodes by level
    this.nodes.forEach(node => {
      const level = levels.get(node.type) ?? 2;
      if (!this.levels.has(level)) {
        this.levels.set(level, []);
      }
      this.levels.get(level)!.push(node);
    });
  }

  public simulate(): DependencyNode[] {
    const levelCount = this.levels.size;
    const levelHeight = LAYOUT_CONSTANTS.HIERARCHICAL.LEVEL_HEIGHT;
    const startY = (this.height - (levelCount - 1) * levelHeight) / 2;

    const positionedNodes: DependencyNode[] = [];

    for (const [levelIndex, levelNodes] of this.levels.entries()) {
      const y = startY + levelIndex * levelHeight;
      const nodeSpacing = Math.max(
        LAYOUT_CONSTANTS.HIERARCHICAL.MIN_NODE_SPACING,
        this.width / (levelNodes.length + 1)
      );

      levelNodes.forEach((node, index) => {
        const x = (index + 1) * nodeSpacing;
        positionedNodes.push({
          ...node,
          position: { x, y },
        });
      });
    }

    return positionedNodes;
  }
}

// Circular layout implementation
export class CircularLayout {
  private nodes: DependencyNode[];
  private width: number;
  private height: number;

  constructor(nodes: DependencyNode[], width: number, height: number) {
    this.nodes = nodes;
    this.width = width;
    this.height = height;
  }

  public simulate(): DependencyNode[] {
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const radius = Math.min(this.width, this.height) / 2 - LAYOUT_CONSTANTS.CIRCULAR.PADDING;

    const positionedNodes: DependencyNode[] = [];
    const angleStep = (2 * Math.PI) / this.nodes.length;

    this.nodes.forEach((node, index) => {
      const angle = index * angleStep;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      positionedNodes.push({
        ...node,
        position: { x, y },
      });
    });

    return positionedNodes;
  }
}

// Tree layout implementation (for hierarchical dependencies)
export class TreeLayout {
  private nodes: Map<string, DependencyNode> = new Map();
  private edges: DependencyEdge[];
  private roots: Set<string> = new Set();
  private children: Map<string, string[]> = new Map();
  private width: number;
  private height: number;

  constructor(
    nodes: DependencyNode[],
    edges: DependencyEdge[],
    width: number,
    height: number
  ) {
    this.width = width;
    this.height = height;
    this.edges = edges;

    // Build node map
    nodes.forEach(node => {
      this.nodes.set(node.id, node);
      this.children.set(node.id, []);
    });

    this.buildTree();
  }

  private buildTree(): void {
    // Find all nodes that are targets (have incoming dependencies)
    const targets = new Set(this.edges.map(edge => edge.target));

    // Build children map and find roots
    this.edges.forEach(edge => {
      if (this.children.has(edge.source)) {
        this.children.get(edge.source)!.push(edge.target);
      }
    });

    // Roots are nodes with no incoming dependencies
    this.nodes.forEach((node, id) => {
      if (!targets.has(id)) {
        this.roots.add(id);
      }
    });

    // If no roots found (circular dependencies), pick nodes with minimum incoming edges
    if (this.roots.size === 0) {
      const incomingCount = new Map<string, number>();
      this.edges.forEach(edge => {
        incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1);
      });

      const minCount = Math.min(...Array.from(incomingCount.values()));
      incomingCount.forEach((count, nodeId) => {
        if (count === minCount) {
          this.roots.add(nodeId);
        }
      });
    }
  }

  public simulate(): DependencyNode[] {
    const positionedNodes: DependencyNode[] = [];
    const positions = new Map<string, { x: number; y: number }>();

    // Layout each tree starting from roots
    let currentX = 0;
    const rootSpacing = this.width / this.roots.size;

    for (const rootId of this.roots) {
      const rootX = currentX + rootSpacing / 2;
      this.layoutSubtree(rootId, rootX, 0, positions);
      currentX += rootSpacing;
    }

    // Create positioned nodes
    this.nodes.forEach((node, id) => {
      const position = positions.get(id) ?? { x: this.width / 2, y: this.height / 2 };
      positionedNodes.push({
        ...node,
        position,
      });
    });

    return positionedNodes;
  }

  private layoutSubtree(
    nodeId: string,
    x: number,
    level: number,
    positions: Map<string, { x: number; y: number }>
  ): void {
    const y = level * LAYOUT_CONSTANTS.TREE.LEVEL_HEIGHT;
    positions.set(nodeId, { x, y });

    const children = this.children.get(nodeId) ?? [];
    if (children.length === 0) return;

    const childSpacing = LAYOUT_CONSTANTS.TREE.SIBLING_SPACING;
    const totalWidth = (children.length - 1) * childSpacing;
    const startX = x - totalWidth / 2;

    children.forEach((childId, index) => {
      const childX = startX + index * childSpacing;
      this.layoutSubtree(childId, childX, level + 1, positions);
    });
  }
}

// Main layout function - chooses and runs the appropriate algorithm
export function calculateLayout(
  nodes: DependencyNode[],
  edges: DependencyEdge[],
  width: number,
  height: number,
  layout: GraphLayout = { algorithm: "force", options: {} }
): DependencyNode[] {
  if (nodes.length === 0) return [];

  switch (layout.algorithm) {
    case "force":
      return new ForceDirectedLayout(nodes, edges, width, height, layout.options).simulate();

    case "hierarchical":
      return new HierarchicalLayout(nodes, edges, width, height).simulate();

    case "circular":
      return new CircularLayout(nodes, width, height).simulate();

    case "tree":
      return new TreeLayout(nodes, edges, width, height).simulate();

    default:
      return new ForceDirectedLayout(nodes, edges, width, height, layout.options).simulate();
  }
}

// Calculate edge paths for SVG rendering
export function calculateEdgePath(
  sourceNode: DependencyNode,
  targetNode: DependencyNode,
  curved = true
): string {
  if (!sourceNode.position || !targetNode.position) {
    return "";
  }

  const source = sourceNode.position;
  const target = targetNode.position;

  if (!curved) {
    return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
  }

  // Calculate control points for curved edge
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Control point offset (perpendicular to line)
  const offsetX = -dy / distance * 20;
  const offsetY = dx / distance * 20;

  const midX = (source.x + target.x) / 2 + offsetX;
  const midY = (source.y + target.y) / 2 + offsetY;

  return `M ${source.x} ${source.y} Q ${midX} ${midY} ${target.x} ${target.y}`;
}

// Calculate optimal label position for edges
export function calculateLabelPosition(
  sourceNode: DependencyNode,
  targetNode: DependencyNode
): { x: number; y: number } {
  if (!sourceNode.position || !targetNode.position) {
    return { x: 0, y: 0 };
  }

  const source = sourceNode.position;
  const target = targetNode.position;

  return {
    x: (source.x + target.x) / 2,
    y: (source.y + target.y) / 2,
  };
}

// Utility to check if nodes overlap
export function checkNodeOverlap(node1: DependencyNode, node2: DependencyNode): boolean {
  if (!node1.position || !node2.position) return false;

  const size1 = NODE_SIZES[node1.type];
  const size2 = NODE_SIZES[node2.type];

  const dx = Math.abs(node1.position.x - node2.position.x);
  const dy = Math.abs(node1.position.y - node2.position.y);

  return dx < (size1.width + size2.width) / 2 && dy < (size1.height + size2.height) / 2;
}

// Get node size based on type
export function getNodeSize(type: DependencyEntityType): { width: number; height: number } {
  return NODE_SIZES[type];
}