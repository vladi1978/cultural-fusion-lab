"use client";

import { useMemo, useState } from "react";

import type {
  CulturalAffinityLink,
  CulturalEntity,
  EntityCategory,
  EvidenceItem,
  EvidenceSource,
} from "@/lib/types";
import { ENTITY_CATEGORY_LABELS, EVIDENCE_SOURCE_LABELS } from "@/lib/types";

const CATEGORY_COLOR: Record<EntityCategory, string> = {
  music: "#22d3ee",
  film: "#a78bfa",
  brands: "#d4a853",
  places: "#67e8f9",
  fashion: "#c4b5fd",
  food: "#fbbf24",
  other: "#94a3b8",
};

type EdgeKind = "verified" | "inferred" | "mock";

interface NodeLayout {
  entity: CulturalEntity;
  x: number;
  y: number;
  r: number;
}

interface EdgeLayout {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: EdgeKind;
  label: string;
  leftName: string;
  rightName: string;
  note: string;
}

function layoutNodes(entities: CulturalEntity[]): NodeLayout[] {
  const top = entities.slice(0, 12);
  const cx = 320;
  const cy = 210;
  return top.map((entity, i) => {
    const angle = (Math.PI * 2 * i) / Math.max(top.length, 1) - Math.PI / 2;
    const radius = 110 + (i % 3) * 22;
    return {
      entity,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      r: 14,
    };
  });
}

function edgeKindFor(
  basis: CulturalAffinityLink["basis"],
  leftSource?: EvidenceSource,
  rightSource?: EvidenceSource,
): EdgeKind {
  if (
    basis === "api_reported_score" &&
    leftSource === "verified_api" &&
    rightSource === "verified_api"
  ) {
    return "verified";
  }
  if (leftSource === "mock_demo" || rightSource === "mock_demo") {
    return "mock";
  }
  return "inferred";
}

const EDGE_STYLE: Record<
  EdgeKind,
  { stroke: string; dash: string; opacity: number; legend: string }
> = {
  verified: {
    stroke: "#34d399",
    dash: "0",
    opacity: 0.85,
    legend: "Verified API relationship",
  },
  inferred: {
    stroke: "#a78bfa",
    dash: "5 5",
    opacity: 0.7,
    legend: "Inferred / hypothesis link",
  },
  mock: {
    stroke: "#d4a853",
    dash: "2 6",
    opacity: 0.65,
    legend: "Mock demo link (not Qloo)",
  },
};

export function CulturalNetwork({
  entities,
  affinities = [],
  evidence = [],
  mode = "demo",
}: {
  entities: CulturalEntity[];
  affinities?: CulturalAffinityLink[];
  evidence?: EvidenceItem[];
  mode?: "demo" | "live";
}) {
  const nodes = useMemo(() => layoutNodes(entities), [entities]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const provenanceByEntity = useMemo(() => {
    const map = new Map<string, EvidenceSource>();
    for (const item of evidence) {
      for (const id of item.relatedEntityIds ?? []) {
        if (!map.has(id)) map.set(id, item.source);
      }
    }
    return map;
  }, [evidence]);

  const nodeById = useMemo(
    () => new Map(nodes.map((n) => [n.entity.id, n])),
    [nodes],
  );

  const edges = useMemo(() => {
    const out: EdgeLayout[] = [];
    for (const aff of affinities) {
      const left = nodeById.get(aff.leftEntityId);
      const right = nodeById.get(aff.rightEntityId);
      if (!left || !right) continue;
      const kind = edgeKindFor(
        aff.basis,
        provenanceByEntity.get(aff.leftEntityId),
        provenanceByEntity.get(aff.rightEntityId),
      );
      // Never paint mock/demo edges as verified.
      const safeKind =
        mode === "demo" && kind === "verified" ? "mock" : kind;
      out.push({
        id: aff.id,
        x1: left.x,
        y1: left.y,
        x2: right.x,
        y2: right.y,
        kind: safeKind,
        label:
          aff.basis === "shared_tag"
            ? `Shared tags: ${aff.sharedTags.join(", ") || "—"}`
            : aff.basis === "api_reported_score"
              ? "API-reported score link"
              : "Co-collected neighborhood",
        leftName: left.entity.name,
        rightName: right.entity.name,
        note: aff.note,
      });
    }
    return out.slice(0, 18);
  }, [affinities, nodeById, provenanceByEntity, mode]);

  const selected = nodes.find((n) => n.entity.id === selectedId)?.entity;
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId);

  if (nodes.length === 0) {
    return (
      <div className="panel flex h-[320px] items-center justify-center text-sm text-[var(--text-muted)]">
        No entities to visualize yet.
      </div>
    );
  }

  const cx = 320;
  const cy = 210;

  return (
    <div className="panel relative overflow-hidden p-3 sm:p-4">
      <div className="lab-grid pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative z-10 mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <h3 className="font-display text-lg text-white">Cultural network</h3>
          <p className="text-xs text-[var(--text-dim)]">
            Click a node or link to inspect. Edge styles encode provenance —
            mock links are never shown as verified.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-[var(--text-dim)]">
          {(Object.keys(EDGE_STYLE) as EdgeKind[]).map((kind) => (
            <span key={kind} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-4"
                style={{
                  background: EDGE_STYLE[kind].stroke,
                  opacity: EDGE_STYLE[kind].opacity,
                }}
              />
              {EDGE_STYLE[kind].legend}
            </span>
          ))}
        </div>
      </div>

      <svg
        viewBox="0 0 640 420"
        className="relative z-10 h-auto w-full"
        role="img"
        aria-label="Interactive cultural network of discovered entities"
      >
        <defs>
          <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.35" />
            <stop offset="70%" stopColor="#8b5cf6" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#05070d" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx={cx} cy={cy} r="78" fill="url(#coreGlow)" />
        <circle
          cx={cx}
          cy={cy}
          r="26"
          fill="#0a1020"
          stroke="#22d3ee"
          strokeWidth="1.5"
        />
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          fill="#e8eef9"
          fontSize="10"
          fontFamily="var(--font-mono)"
        >
          FUSION
        </text>

        {edges.map((edge) => {
          const style = EDGE_STYLE[edge.kind];
          const active = selectedEdgeId === edge.id;
          return (
            <g key={edge.id}>
              <line
                x1={edge.x1}
                y1={edge.y1}
                x2={edge.x2}
                y2={edge.y2}
                stroke={style.stroke}
                strokeOpacity={active ? 1 : style.opacity}
                strokeWidth={active ? 2.4 : 1.3}
                strokeDasharray={style.dash}
                className={edge.kind === "inferred" ? "network-line" : undefined}
              />
              <line
                x1={edge.x1}
                y1={edge.y1}
                x2={edge.x2}
                y2={edge.y2}
                stroke="transparent"
                strokeWidth="12"
                className="cursor-pointer"
                onClick={() => {
                  setSelectedEdgeId(edge.id);
                  setSelectedId(null);
                }}
              >
                <title>
                  {edge.leftName} ↔ {edge.rightName}
                </title>
              </line>
            </g>
          );
        })}

        {nodes.map((node) => {
          const color = CATEGORY_COLOR[node.entity.category];
          const active = selectedId === node.entity.id;
          return (
            <g
              key={node.entity.id}
              className="cursor-pointer"
              onClick={() => {
                setSelectedId(node.entity.id);
                setSelectedEdgeId(null);
              }}
            >
              <circle
                cx={node.x}
                cy={node.y}
                r={active ? node.r + 4 : node.r}
                fill="#0e1628"
                stroke={color}
                strokeWidth={active ? 2.4 : 1.6}
              />
              <circle cx={node.x} cy={node.y} r={3.5} fill={color} />
              <text
                x={node.x}
                y={node.y + node.r + 14}
                textAnchor="middle"
                fill="#cbd5e1"
                fontSize="9"
                fontFamily="var(--font-body)"
              >
                {node.entity.name.length > 20
                  ? `${node.entity.name.slice(0, 18)}…`
                  : node.entity.name}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="relative z-10 mt-3 rounded-xl border border-[var(--line)] bg-[rgba(5,8,16,0.55)] px-3.5 py-3">
        {selected ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#a5f3fc]">
              {ENTITY_CATEGORY_LABELS[selected.category]}
            </p>
            <p className="mt-1 font-display text-lg text-white">{selected.name}</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
              {selected.description}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selected.tags.slice(0, 5).map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--text-dim)]"
                >
                  {tag}
                </span>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-[var(--text-dim)]">
              Provenance:{" "}
              {EVIDENCE_SOURCE_LABELS[
                provenanceByEntity.get(selected.id) ?? "mock_demo"
              ]}
              {mode === "demo"
                ? " · Demo affinity numbers are hidden to avoid implying Taste Graph scores."
                : null}
            </p>
          </div>
        ) : selectedEdge ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#ddd6fe]">
              {EDGE_STYLE[selectedEdge.kind].legend}
            </p>
            <p className="mt-1 text-sm text-white">
              {selectedEdge.leftName} ↔ {selectedEdge.rightName}
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {selectedEdge.label}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-dim)]">
              {selectedEdge.note}
            </p>
          </div>
        ) : (
          <p className="text-xs text-[var(--text-muted)]">
            Select an entity or relationship to inspect supporting context.
          </p>
        )}
      </div>
    </div>
  );
}
