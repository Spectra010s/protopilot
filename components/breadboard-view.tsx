"use client";

import type { Project, Connection } from "@/lib/project/schema";

const colors: Record<string, string> = { red: "#e65b52", black: "#3f4754", yellow: "#e5b943", blue: "#4d81d0", green: "#4a9c77", white: "#b9c4cb" };

function endpoint(project: Project, end: Connection["from"]) {
  const component = project.components.find((item) => item.id === end.componentId);
  const pinIndex = component?.pins.findIndex((pin) => pin.id === end.pinId) ?? 0;
  if (!component) return { x: 0, y: 0 };
  const pinY = component.layout.y - 28 + Math.max(0, pinIndex) * 13;
  return { x: component.layout.x + (component.layout.x < 440 ? 86 : -86), y: pinY };
}

export function BreadboardView({ project }: { project: Project }) {
  return (
    <div className="w-full overflow-auto">
      <svg className="block h-auto w-full min-w-[600px]" viewBox="0 0 900 520" role="img" aria-label="Breadboard layout generated from the project connections">
        <defs>
          <pattern id="holes" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="2.1" fill="#c8c3b8" /><circle cx="10" cy="10" r="1" fill="#f7f4ec" /></pattern>
          <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#151a24" floodOpacity=".09" /></filter>
        </defs>
        <rect x="7" y="7" width="886" height="506" rx="18" fill="#f4f1e8" stroke="#ded8cb" />
        <text x="30" y="35" className="fill-[#818b85] font-sans text-[9px] font-bold tracking-[1px]">BREADBOARD CONNECTION PLAN</text>
        <rect x="58" y="63" width="784" height="392" rx="14" fill="#faf9f5" stroke="#e4dfd3" />
        <rect x="75" y="84" width="750" height="350" rx="8" fill="url(#holes)" />
        <rect x="75" y="84" width="750" height="20" rx="6" fill="#fff" opacity=".78" />
        <rect x="75" y="414" width="750" height="20" rx="6" fill="#fff" opacity=".78" />
        <line x1="85" y1="94" x2="815" y2="94" stroke="#df6b60" strokeWidth="2" opacity=".58" />
        <line x1="85" y1="424" x2="815" y2="424" stroke="#5a6a85" strokeWidth="2" opacity=".55" />
        <text x="68" y="98" className="fill-[#de7666] font-sans text-xs font-bold">+</text><text x="68" y="428" className="fill-[#de7666] font-sans text-xs font-bold">−</text>
        {project.connections.map((wire) => {
          const a = endpoint(project, wire.from); const b = endpoint(project, wire.to);
          const color = colors[wire.color] ?? colors.blue;
          const bend = a.x < b.x ? 36 : -36;
          return <g key={wire.id}><path d={`M ${a.x} ${a.y} C ${a.x + bend} ${a.y}, ${b.x - bend} ${b.y}, ${b.x} ${b.y}`} fill="none" stroke={color} strokeWidth="3.1" strokeLinecap="round" /><circle cx={a.x} cy={a.y} r="4" fill={color} stroke="#fff" strokeWidth="1.3" /><circle cx={b.x} cy={b.y} r="4" fill={color} stroke="#fff" strokeWidth="1.3" /></g>;
        })}
        {project.components.map((component) => (
          <g key={component.id} transform={`translate(${component.layout.x - 75} ${component.layout.y - 45})`} filter="url(#soft-shadow)">
            <rect width="150" height="88" rx="11" fill="#fff" stroke="#d8dfe1" />
            <rect width="150" height="6" rx="4" fill={component.category === "controller" ? "#293c52" : component.category === "power" ? "#e4a153" : component.category === "driver" ? "#72997e" : "#77a9a3"} />
            <text x="13" y="27" className="fill-[#698779] font-mono text-[10px] font-bold">{component.reference}</text>
            <text x="13" y="46" className="fill-[#39443e] font-sans text-[10px] font-semibold">{component.name.length > 22 ? `${component.name.slice(0, 21)}…` : component.name}</text>
            {component.pins.slice(0, 4).map((pin, index) => <g key={pin.id}>
              <circle cx={component.layout.x < 440 ? 142 : 8} cy={58 + index * 7} r="2.4" fill="#d8a75a" stroke="#fff" strokeWidth=".8" />
              <text x={component.layout.x < 440 ? 132 : 18} y={61 + index * 7} textAnchor={component.layout.x < 440 ? "end" : "start"} className="fill-[#818b85] font-sans text-[7px]">{pin.label}</text>
            </g>)}
          </g>
        ))}
        <text x="30" y="486" className="fill-[#818b85] font-sans text-[9px]">Wire endpoints and labels are derived from the same connection list as the wiring table.</text>
      </svg>
    </div>
  );
}
