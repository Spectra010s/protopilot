"use client";

import { RunFrame } from "@tscircuit/runframe/runner";
import type { Project } from "@/lib/project/schema";

function identifier(value: string) {
  return value.replace(/[^A-Za-z0-9_]/g, "_");
}

export function makeTscircuitSource(project: Project) {
  const names = new Map(project.components.map((component) => [component.id, identifier(component.reference)]));
  const elements = project.components.map((component, index) => {
    const ref = names.get(component.id)!;
    const labels = component.pins.map((pin, i) => `pin${i + 1}: ${JSON.stringify(pin.id)}`).join(", ");
    const pinOrder = component.pins.map((pin) => JSON.stringify(pin.id)).join(", ");
    const x = ((component.layout.x - 450) / 70).toFixed(2);
    const y = ((260 - component.layout.y) / 70).toFixed(2);
    return `<chip name=${JSON.stringify(ref)} footprint="dip16" pinLabels={{ ${labels} }} schPinArrangement={{ leftSide: { direction: "top-to-bottom", pins: [${pinOrder}] } }} schX={${x}} schY={${y}} />`;
  }).join("\n");
  const traces = project.connections.map((connection, index) => {
    const fromRef = names.get(connection.from.componentId);
    const toRef = names.get(connection.to.componentId);
    return `<trace name=${JSON.stringify(`NET${index + 1}`)} from=${JSON.stringify(`.${fromRef} > .${connection.from.pinId}`)} to=${JSON.stringify(`.${toRef} > .${connection.to.pinId}`)} />`;
  }).join("\n");

  return `export default () => (\n  <board width="120mm" height="80mm" routingDisabled>\n    ${elements}\n    ${traces}\n  </board>\n)`;
}

export function TscircuitSchematic({ project }: { project: Project }) {
  const code = makeTscircuitSource(project);
  return (
    <div className="h-full min-h-[430px] [&>*]:min-h-[430px] max-[760px]:min-h-[310px] max-[760px]:[&>*]:min-h-[310px]">
      <RunFrame
        key={`runframe-${project.revision}`}
        fsMap={{ "main.tsx": code }}
        entrypoint="main.tsx"
        availableTabs={["schematic"]}
        defaultTab="schematic"
        onError={(error) => console.error("RunFrame schematic error", error)}
      />
    </div>
  );
}
