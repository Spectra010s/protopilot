"use client";

import { useMemo, useState } from "react";
import type { Project, Component, Pin, Connection } from "@/lib/project/schema";

const WIRE_COLORS: Record<string, { stroke: string; fill: string; highlight: string }> = {
  red: { stroke: "#dc2626", fill: "#ef4444", highlight: "#fca5a5" },
  black: { stroke: "#1e293b", fill: "#334155", highlight: "#64748b" },
  yellow: { stroke: "#ca8a04", fill: "#eab308", highlight: "#fef08a" },
  blue: { stroke: "#2563eb", fill: "#3b82f6", highlight: "#93c5fd" },
  green: { stroke: "#16a34a", fill: "#22c55e", highlight: "#86efac" },
  white: { stroke: "#94a3b8", fill: "#cbd5e1", highlight: "#f1f5f9" },
};

const CATEGORY_COLORS: Record<string, { pcb: string; accent: string; label: string }> = {
  controller: { pcb: "#0f172a", accent: "#38bdf8", label: "MCU DEV BOARD" },
  sensor: { pcb: "#064e3b", accent: "#34d399", label: "SENSOR MODULE" },
  driver: { pcb: "#701a75", accent: "#e879f9", label: "MOTOR / DRIVER" },
  power: { pcb: "#78350f", accent: "#fbbf24", label: "POWER MODULE" },
  load: { pcb: "#1e1b4b", accent: "#818cf8", label: "LOAD / ACTUATOR" },
  protection: { pcb: "#450a0a", accent: "#f87171", label: "PROTECTION" },
  input: { pcb: "#14532d", accent: "#4ade80", label: "INPUT SWITCH" },
  indicator: { pcb: "#312e81", accent: "#a5b4fc", label: "INDICATOR" },
};

/** Calculates dimensions and layout for a component */
function getComponentLayout(component: Component, index: number, total: number) {
  const isController = component.category === "controller";
  const pinCount = component.pins.length;

  // Controllers have 2 columns of pins if pinCount > 6
  const isDualColumn = isController && pinCount > 6;
  const pinSpacing = 16;
  const pinsPerColumn = isDualColumn ? Math.ceil(pinCount / 2) : pinCount;
  const height = Math.max(88, pinsPerColumn * pinSpacing + 54);
  const width = isDualColumn ? 160 : isController ? 150 : 130;

  // Grid positioning: 2 rows of components
  const cols = Math.min(3, Math.max(2, Math.ceil(total / 2)));
  const colIndex = index % cols;
  const rowIndex = Math.floor(index / cols);

  const x = 70 + colIndex * 280;
  const y = 60 + rowIndex * 220;

  return { x, y, width, height, isDualColumn, pinsPerColumn, pinSpacing };
}

/** Determines pin position in world coordinates */
function getPinCoordinates(
  component: Component,
  pinId: string,
  layoutMap: Map<string, ReturnType<typeof getComponentLayout>>
): { x: number; y: number } {
  const layout = layoutMap.get(component.id);
  if (!layout) return { x: 100, y: 100 };

  const pinIndex = component.pins.findIndex((p) => p.id === pinId);
  const safeIndex = pinIndex >= 0 ? pinIndex : 0;

  if (layout.isDualColumn) {
    const isRightCol = safeIndex >= layout.pinsPerColumn;
    const rowInCol = isRightCol ? safeIndex - layout.pinsPerColumn : safeIndex;
    const pinX = isRightCol ? layout.x + layout.width - 12 : layout.x + 12;
    const pinY = layout.y + 42 + rowInCol * layout.pinSpacing;
    return { x: pinX, y: pinY };
  }

  // Single column on bottom edge for modules or right edge
  const pinX = layout.x + layout.width - 12;
  const pinY = layout.y + 38 + safeIndex * layout.pinSpacing;
  return { x: pinX, y: pinY };
}

export function BreadboardView({ project }: { project: Project }) {
  const [hoveredWire, setHoveredWire] = useState<string | null>(null);

  // Layout map for all components
  const layoutMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getComponentLayout>>();
    project.components.forEach((comp, idx) => {
      map.set(comp.id, getComponentLayout(comp, idx, project.components.length));
    });
    return map;
  }, [project.components]);

  // Compute viewBox size based on components
  const viewBoxHeight = useMemo(() => {
    let maxY = 520;
    layoutMap.forEach((l) => {
      if (l.y + l.height + 60 > maxY) maxY = l.y + l.height + 60;
    });
    return Math.max(520, maxY);
  }, [layoutMap]);

  return (
    <div className="w-full h-full flex items-center justify-center p-2">
      <svg
        className="block h-auto w-full max-w-full select-none"
        viewBox={`0 0 960 ${viewBoxHeight}`}
        role="img"
        aria-label="Breadboard hardware layout and wiring diagram"
      >
        <defs>
          {/* Breadboard contact tie-point hole pattern */}
          <pattern id="bb-holes" width="16" height="16" patternUnits="userSpaceOnUse">
            <rect x="5.5" y="5.5" width="5" height="5" rx="1.2" fill="#1e293b" />
            <rect x="6.5" y="6.5" width="3" height="3" rx="0.6" fill="#0f172a" />
            <circle cx="8" cy="8" r="0.8" fill="#64748b" opacity="0.7" />
          </pattern>

          {/* Module drop shadow */}
          <filter id="pcb-shadow" x="-10%" y="-10%" width="125%" height="130%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#090d16" floodOpacity="0.18" />
          </filter>

          {/* Wire drop shadow */}
          <filter id="wire-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#0f172a" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* ── Breadboard Base Body ── */}
        <rect x="12" y="12" width="936" height={viewBoxHeight - 24} rx="20" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />
        <rect x="22" y="22" width="916" height={viewBoxHeight - 44} rx="16" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1.5" />

        {/* ── Breadboard Title & Header ── */}
        <g transform="translate(36, 42)">
          <text className="fill-slate-800 font-sans text-xs font-bold tracking-wider">PROTO-PILOT VIRTUAL BREADBOARD</text>
          <text x="0" y="14" className="fill-slate-400 font-mono text-[9px]">
            {project.title} · {project.components.length} COMPONENTS · {project.connections.length} NET CONNECTIONS
          </text>
        </g>

        {/* ── Top Power Rail (+ and -) ── */}
        <g transform="translate(40, 70)">
          <rect width="880" height="28" rx="6" fill="#f1f5f9" stroke="#e2e8f0" />
          <line x1="20" y1="9" x2="860" y2="9" stroke="#ef4444" strokeWidth="2" strokeDasharray="14 6" opacity="0.8" />
          <text x="6" y="13" className="fill-red-500 font-mono text-[11px] font-bold">+</text>
          <line x1="20" y1="19" x2="860" y2="19" stroke="#3b82f6" strokeWidth="2" strokeDasharray="14 6" opacity="0.8" />
          <text x="7" y="23" className="fill-blue-500 font-mono text-[11px] font-bold">−</text>
        </g>

        {/* ── Tie Point Grid Area ── */}
        <rect x="40" y="108" width="880" height={viewBoxHeight - 170} rx="10" fill="url(#bb-holes)" opacity="0.85" />

        {/* ── Center Divider Trench ── */}
        <line
          x1="40"
          y1={viewBoxHeight / 2}
          x2="920"
          y2={viewBoxHeight / 2}
          stroke="#cbd5e1"
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.6"
        />

        {/* ── Bottom Power Rail (+ and -) ── */}
        <g transform={`translate(40, ${viewBoxHeight - 52})`}>
          <rect width="880" height="28" rx="6" fill="#f1f5f9" stroke="#e2e8f0" />
          <line x1="20" y1="9" x2="860" y2="9" stroke="#ef4444" strokeWidth="2" strokeDasharray="14 6" opacity="0.8" />
          <text x="6" y="13" className="fill-red-500 font-mono text-[11px] font-bold">+</text>
          <line x1="20" y1="19" x2="860" y2="19" stroke="#3b82f6" strokeWidth="2" strokeDasharray="14 6" opacity="0.8" />
          <text x="7" y="23" className="fill-blue-500 font-mono text-[11px] font-bold">−</text>
        </g>

        {/* ── Jumper Wires Layer ── */}
        <g className="wires-layer">
          {project.connections.map((wire) => {
            const fromComp = project.components.find((c) => c.id === wire.from.componentId);
            const toComp = project.components.find((c) => c.id === wire.to.componentId);
            if (!fromComp || !toComp) return null;

            const start = getPinCoordinates(fromComp, wire.from.pinId, layoutMap);
            const end = getPinCoordinates(toComp, wire.to.pinId, layoutMap);
            const colorSpec = WIRE_COLORS[wire.color] ?? WIRE_COLORS.blue;
            const isHovered = hoveredWire === wire.id;

            // Compute natural wire bezier arc
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const dist = Math.hypot(dx, dy);
            const arcFactor = Math.min(60, Math.max(25, dist * 0.18));
            const midY = (start.y + end.y) / 2 + (start.y < end.y ? -arcFactor : arcFactor);
            const midX = (start.x + end.x) / 2;

            const pathData = `M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`;

            return (
              <g
                key={wire.id}
                onMouseEnter={() => setHoveredWire(wire.id)}
                onMouseLeave={() => setHoveredWire(null)}
                className="cursor-pointer transition-all duration-150"
              >
                {/* Background Shadow */}
                <path d={pathData} fill="none" stroke="#0f172a" strokeWidth={isHovered ? "5" : "3.5"} strokeOpacity="0.25" filter="url(#wire-shadow)" />

                {/* Main Color Wire */}
                <path
                  d={pathData}
                  fill="none"
                  stroke={isHovered ? colorSpec.highlight : colorSpec.stroke}
                  strokeWidth={isHovered ? "4" : "2.8"}
                  strokeLinecap="round"
                />

                {/* Wire Highlight Core */}
                <path d={pathData} fill="none" stroke="#ffffff" strokeWidth="0.8" strokeOpacity="0.45" strokeLinecap="round" />

                {/* Terminal Connection Boot / Pins */}
                <circle cx={start.x} cy={start.y} r={isHovered ? "5" : "3.8"} fill={colorSpec.fill} stroke="#ffffff" strokeWidth="1.2" />
                <circle cx={end.x} cy={end.y} r={isHovered ? "5" : "3.8"} fill={colorSpec.fill} stroke="#ffffff" strokeWidth="1.2" />

                {/* Net Tag on Hover */}
                {isHovered && (
                  <g transform={`translate(${midX}, ${midY - 8})`}>
                    <rect x="-35" y="-14" width="70" height="18" rx="4" fill="#0f172a" stroke="#ffffff" strokeWidth="1" />
                    <text x="0" y="-2" textAnchor="middle" className="fill-white font-mono text-[9px] font-bold">
                      {wire.net}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>

        {/* ── Component Modules Layer ── */}
        <g className="components-layer">
          {project.components.map((comp) => {
            const layout = layoutMap.get(comp.id);
            if (!layout) return null;
            const style = CATEGORY_COLORS[comp.category] ?? CATEGORY_COLORS.sensor;
            const isController = comp.category === "controller";

            return (
              <g key={comp.id} transform={`translate(${layout.x}, ${layout.y})`} filter="url(#pcb-shadow)">
                {/* PCB Board Body */}
                <rect
                  width={layout.width}
                  height={layout.height}
                  rx="10"
                  fill={style.pcb}
                  stroke="#334155"
                  strokeWidth="1.5"
                />

                {/* Top Accent Strip */}
                <rect width={layout.width} height="4" rx="2" fill={style.accent} />

                {/* USB Port for Controller */}
                {isController && (
                  <rect x={layout.width / 2 - 14} y="-6" width="28" height="10" rx="2" fill="#94a3b8" stroke="#475569" strokeWidth="1" />
                )}

                {/* Reference ID & Category Badge */}
                <g transform="translate(10, 18)">
                  <text className="fill-white font-mono text-[10px] font-bold">{comp.reference}</text>
                  <text x="32" y="0" className="fill-slate-400 font-sans text-[7.5px] font-semibold tracking-wider uppercase">
                    {style.label}
                  </text>
                </g>

                {/* Component Name */}
                <text x="10" y="32" className="fill-slate-200 font-sans text-[9.5px] font-semibold">
                  {comp.name.length > 20 ? `${comp.name.slice(0, 19)}…` : comp.name}
                </text>

                {/* Microcontroller IC / Chip Artwork in Center */}
                {isController ? (
                  <g transform={`translate(${layout.width / 2 - 20}, 44)`}>
                    <rect width="40" height="32" rx="3" fill="#1e293b" stroke="#475569" strokeWidth="1" />
                    <circle cx="6" cy="6" r="1.5" fill="#64748b" />
                    <text x="20" y="18" textAnchor="middle" className="fill-slate-400 font-mono text-[6.5px]">
                      CORE IC
                    </text>
                  </g>
                ) : (
                  <g transform={`translate(${layout.width / 2 - 16}, 42)`}>
                    <rect width="32" height="22" rx="2" fill="#0f172a" stroke="#334155" strokeWidth="0.8" opacity="0.6" />
                  </g>
                )}

                {/* Pins & Labels */}
                {comp.pins.map((pin, pIdx) => {
                  let pinX: number;
                  let pinY: number;
                  let textAnchor: "start" | "end" = "end";
                  let textX: number;

                  if (layout.isDualColumn) {
                    const isRightCol = pIdx >= layout.pinsPerColumn;
                    const rowInCol = isRightCol ? pIdx - layout.pinsPerColumn : pIdx;
                    pinX = isRightCol ? layout.width - 12 : 12;
                    pinY = 42 + rowInCol * layout.pinSpacing;
                    textAnchor = isRightCol ? "end" : "start";
                    textX = isRightCol ? layout.width - 20 : 20;
                  } else {
                    pinX = layout.width - 12;
                    pinY = 38 + pIdx * layout.pinSpacing;
                    textAnchor = "end";
                    textX = layout.width - 20;
                  }

                  // Pin color by type
                  const isPower = pin.kind === "power";
                  const isGround = pin.kind === "ground";
                  const padColor = isPower ? "#ef4444" : isGround ? "#334155" : "#eab308";

                  return (
                    <g key={pin.id}>
                      {/* Metallic Gold Pin Pad */}
                      <circle cx={pinX} cy={pinY} r="3.5" fill={padColor} stroke="#ffffff" strokeWidth="0.8" />
                      <circle cx={pinX} cy={pinY} r="1.2" fill="#0f172a" />

                      {/* Pin Label */}
                      <text
                        x={textX}
                        y={pinY + 3}
                        textAnchor={textAnchor}
                        className="fill-slate-300 font-mono text-[7.5px] select-none"
                      >
                        {pin.label || pin.id}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
