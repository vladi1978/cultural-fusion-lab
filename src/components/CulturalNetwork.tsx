"use client";

import type { CulturalEntity, EntityCategory } from "@/lib/types";

const CATEGORY_COLOR: Record<EntityCategory, string> = {
  music: "#22d3ee",
  film: "#a78bfa",
  brands: "#d4a853",
  places: "#67e8f9",
  fashion: "#c4b5fd",
  food: "#fbbf24",
  other: "#94a3b8",
};

interface NodeLayout {
  entity: CulturalEntity;
  x: number;
  y: number;
  r: number;
}

function layoutNodes(entities: CulturalEntity[]): NodeLayout[] {
  const top = entities.slice(0, 10);
  const cx = 200;
  const cy = 160;
  return top.map((entity, i) => {
    const angle = (Math.PI * 2 * i) / top.length - Math.PI / 2;
    const radius = 88 + (i % 3) * 18;
    return {
      entity,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      r: 10 + entity.affinity * 10,
    };
  });
}

export function CulturalNetwork({ entities }: { entities: CulturalEntity[] }) {
  const nodes = layoutNodes(entities);
  const cx = 200;
  const cy = 160;

  if (nodes.length === 0) {
    return (
      <div className="panel flex h-[320px] items-center justify-center text-sm text-[var(--text-muted)]">
        No entities to visualize yet.
      </div>
    );
  }

  return (
    <div className="panel relative overflow-hidden p-3 sm:p-4">
      <div className="lab-grid pointer-events-none absolute inset-0 opacity-60" />
      <svg
        viewBox="0 0 400 320"
        className="relative z-10 h-auto w-full"
        role="img"
        aria-label="Cultural network visualization of discovered entities"
      >
        <defs>
          <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.45" />
            <stop offset="70%" stopColor="#8b5cf6" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#05070d" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx={cx} cy={cy} r="70" fill="url(#coreGlow)" />
        <circle
          cx={cx}
          cy={cy}
          r="22"
          fill="#0a1020"
          stroke="#22d3ee"
          strokeWidth="1.5"
        />
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          fill="#e8eef9"
          fontSize="9"
          fontFamily="var(--font-mono)"
        >
          TASTE
        </text>

        {nodes.map((node) => (
          <line
            key={`edge-${node.entity.id}`}
            className="network-line"
            x1={cx}
            y1={cy}
            x2={node.x}
            y2={node.y}
            stroke={CATEGORY_COLOR[node.entity.category]}
            strokeOpacity="0.45"
            strokeWidth="1"
          />
        ))}

        {nodes.map((node) => (
          <g key={node.entity.id} className="motion-float" style={{ animationDelay: `${node.r * 40}ms` }}>
            <circle
              cx={node.x}
              cy={node.y}
              r={node.r}
              fill="#0e1628"
              stroke={CATEGORY_COLOR[node.entity.category]}
              strokeWidth="1.6"
            />
            <circle
              cx={node.x}
              cy={node.y}
              r={3}
              fill={CATEGORY_COLOR[node.entity.category]}
            />
            <text
              x={node.x}
              y={node.y + node.r + 12}
              textAnchor="middle"
              fill="#cbd5e1"
              fontSize="8"
              fontFamily="var(--font-body)"
            >
              {node.entity.name.length > 18
                ? `${node.entity.name.slice(0, 16)}…`
                : node.entity.name}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
