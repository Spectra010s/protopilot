"use client";

import type { Connection, Project } from "@/lib/project/schema";

const palette: Record<string, string> = {
  red: "#cf6c62",
  black: "#525e68",
  yellow: "#c49c3e",
  blue: "#5683ba",
  green: "#578d70",
  white: "#8a9693",
};

const sizes = { width: 158, height: 96 };
const symbolColors: Record<string, { fill: string; stroke: string }> = {
  controller: { fill: "#f1f4f8", stroke: "#8498b1" },
  driver: { fill: "#f1f6ef", stroke: "#9caf91" },
  power: { fill: "#fcf6ed", stroke: "#d7b984" },
  protection: { fill: "#f7f3ee", stroke: "#c7ad8b" },
};

function position(project: Project, componentId: string) {
  const component = project.components.find((item) => item.id === componentId);
  return component?.layout ?? { x: 0, y: 0 };
}

function pinPoint(project: Project, end: Connection["from"]) {
  const component = project.components.find((item) => item.id === end.componentId);
  if (!component) return { x: 0, y: 0, side: -1, label: end.pinId };
  const index = Math.max(0, component.pins.findIndex((pin) => pin.id === end.pinId));
  const side = index % 2 === 0 ? -1 : 1;
  const onSide = Math.floor(index / 2);
  const pinCount = Math.ceil(component.pins.length / 2);
  const spacing = Math.min(15, 64 / Math.max(pinCount - 1, 1));
  const startY = component.layout.y - ((pinCount - 1) * spacing) / 2;
  return {
    x: component.layout.x + side * (sizes.width / 2),
    y: startY + onSide * spacing,
    side,
    label: component.pins[index]?.label ?? end.pinId,
  };
}

export function SchematicView({ project }: { project: Project }) {
  return (
    <div className="w-full overflow-auto">
      <svg className="block h-auto w-full min-w-[600px]" viewBox="0 0 900 520" role="img" aria-label="Schematic generated from the project connections">
        <defs>
          <pattern id="schematic-grid" width="18" height="18" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="#e2e8e3" />
          </pattern>
          <filter id="symbol-shadow" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#2a3a33" floodOpacity=".06" />
          </filter>
        </defs>
        <rect x="0" y="0" width="900" height="520" fill="#fbfcfa" />
        <rect x="0" y="0" width="900" height="520" fill="url(#schematic-grid)" />
        <text x="28" y="31" className="fill-[#88958e] font-sans text-[9px] font-bold tracking-[.8px]">SCHEMATIC · SHARED PROJECT CONNECTIONS</text>
        {project.connections.map((connection, index) => {
          const from = pinPoint(project, connection.from);
          const to = pinPoint(project, connection.to);
          const fromOut = from.x + from.side * 19;
          const toOut = to.x + to.side * 19;
          const lane = 44 + (index % 7) * 8;
          const middle = fromOut <= toOut ? (fromOut + toOut) / 2 : Math.max(fromOut, toOut) + lane;
          const color = palette[connection.color] ?? palette.blue;
          const labelX = Math.min(860, Math.max(40, middle + 4));
          const labelY = Math.max(48, Math.min(486, (from.y + to.y) / 2 - 4 - (index % 3) * 5));
          return (
            <g key={connection.id}>
              <path d={`M ${from.x} ${from.y} H ${fromOut} H ${middle} V ${to.y} H ${toOut} H ${to.x}`} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
              <circle cx={from.x} cy={from.y} r="3" fill={color} />
              <circle cx={to.x} cy={to.y} r="3" fill={color} />
              <text x={labelX} y={labelY} className="fill-[#718178] font-mono text-[7px] [paint-order:stroke] [stroke:#fbfcfa] [stroke-width:3px] [stroke-linejoin:round]">{connection.net}</text>
            </g>
          );
        })}
        {project.components.map((component) => {
          const { x, y } = position(project, component.id);
          const x0 = x - sizes.width / 2;
          const y0 = y - sizes.height / 2;
          const type = component.category === "controller" ? "MCU" : component.category === "sensor" ? "SENSOR" : component.category === "driver" ? "SWITCH" : component.category === "load" ? "LOAD" : component.category.toUpperCase();
          return (
            <g key={component.id} filter="url(#symbol-shadow)">
              <rect x={x0} y={y0} width={sizes.width} height={sizes.height} rx="8" fill={symbolColors[component.category]?.fill ?? "#fff"} stroke={symbolColors[component.category]?.stroke ?? "#bdcbc2"} strokeWidth="1.25" />
              <text x={x} y={y0 + 23} className="fill-[#527567] font-mono text-[10px] font-bold" textAnchor="middle">{component.reference}</text>
              <text x={x} y={y0 + 43} className="fill-[#36433c] font-sans text-[9px] font-semibold" textAnchor="middle">{component.name.length > 22 ? `${component.name.slice(0, 21)}…` : component.name}</text>
              <text x={x} y={y0 + 64} className="fill-[#92a098] font-sans text-[7px] font-bold tracking-[1px]" textAnchor="middle">{type}</text>
              {component.pins.map((pin) => {
                const end = { componentId: component.id, pinId: pin.id };
                const point = pinPoint(project, end);
                const left = point.side < 0;
                const labelX = point.x + (left ? -7 : 7);
                return (
                  <g key={pin.id}>
                    <line x1={point.x} y1={point.y} x2={point.x + point.side * 7} y2={point.y} stroke="#768780" strokeWidth="1" />
                    <circle cx={point.x} cy={point.y} r="2.3" fill="#fff" stroke="#71847b" strokeWidth="1" />
                    <text x={labelX} y={point.y + 2.5} className="fill-[#738078] font-sans text-[7px]" textAnchor={left ? "end" : "start"}>{pin.label}</text>
                  </g>
                );
              })}
            </g>
          );
        })}
        <text x="28" y="495" className="fill-[#88958e] font-sans text-[9px]">Wire endpoints, net labels, and component pins come from the same model as the breadboard and wiring table.</text>
      </svg>
    </div>
  );
}
