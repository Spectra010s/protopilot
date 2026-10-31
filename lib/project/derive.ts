import type { Component, Connection, Project } from "./schema";

export type WireRow = { id: string; from: string; to: string; net: string; details: string; color: string };

export function endpointLabel(project: Project, endpoint: Connection["from"]): string {
  const component = project.components.find((item) => item.id === endpoint.componentId);
  const pin = component?.pins.find((item) => item.id === endpoint.pinId);
  return `${component?.reference ?? endpoint.componentId} · ${pin?.label ?? endpoint.pinId}`;
}

export function deriveWiringTable(project: Project): WireRow[] {
  return project.connections.map((connection) => ({
    id: connection.id,
    from: endpointLabel(project, connection.from),
    to: endpointLabel(project, connection.to),
    net: connection.net,
    details: connection.details,
    color: connection.color,
  }));
}

export type Check = { id: string; title: string; status: "pass" | "warning" | "fail" | "unverified"; detail: string };

function hasLink(project: Project, a: [string, string], b: [string, string]) {
  return project.connections.some((wire) =>
    (wire.from.componentId === a[0] && wire.from.pinId === a[1] && wire.to.componentId === b[0] && wire.to.pinId === b[1]) ||
    (wire.to.componentId === a[0] && wire.to.pinId === a[1] && wire.from.componentId === b[0] && wire.from.pinId === b[1]));
}

export function validateElectrical(project: Project): Check[] {
  const checks: Check[] = [];
  const ids = new Set(project.components.map((component) => component.id));
  const refsValid = project.connections.every((wire) => {
    const from = project.components.find((component) => component.id === wire.from.componentId);
    const to = project.components.find((component) => component.id === wire.to.componentId);
    return ids.has(wire.from.componentId) && ids.has(wire.to.componentId) &&
      from?.pins.some((pin) => pin.id === wire.from.pinId) && to?.pins.some((pin) => pin.id === wire.to.pinId);
  });
  checks.push({ id: "refs", title: "Connection references", status: refsValid ? "pass" : "fail", detail: refsValid ? "Every wire points to an existing component pin." : "A wire references a missing component or pin." });

  const hasLoad = project.components.some((c) => c.category === "load");
  if (hasLoad) {
    const directLoadGpio = project.connections.some((wire) => {
      const pair = [wire.from, wire.to];
      return pair.some((end) => project.components.find((c) => c.id === end.componentId)?.category === "controller" && end.pinId.toLowerCase().startsWith("gpio") &&
        pair.some((other) => project.components.find((c) => c.id === other.componentId)?.category === "load"));
    });
    checks.push({
      id: "gpio-load",
      title: "Load is not driven directly by GPIO",
      status: directLoadGpio ? "fail" : "pass",
      detail: directLoadGpio ? "A microcontroller GPIO pin appears directly wired to a high-current load." : "Load connections use an intermediate driver stage; no direct GPIO load drive detected.",
    });

    const hasDriver = project.components.some((component) => component.category === "driver");
    checks.push({
      id: "switch",
      title: "Power switching driver stage",
      status: hasDriver ? "pass" : "fail",
      detail: hasDriver ? "Driver/switching component is present between controller logic and high-current load." : "Add a suitable MOSFET, transistor, or motor driver; logic pins cannot deliver load current.",
    });

    const diode = project.components.find((component) => component.category === "protection");
    checks.push({
      id: "flyback",
      title: "Inductive flyback protection",
      status: diode ? "pass" : "warning",
      detail: diode ? "Flyback protection component is present across the inductive load." : "Consider adding a flyback clamp diode across any inductive motor, solenoid, or relay coil.",
    });
  }

  const mcu = project.components.find((component) => component.category === "controller");
  const supply = project.components.find((component) => component.category === "power");
  if (mcu && supply) {
    const sharedGround = hasLink(project, [mcu.id, "gnd"], [supply.id, "ground"]) ||
      project.connections.some((w) => /gnd|ground/i.test(w.net) && [w.from.componentId, w.to.componentId].includes(mcu.id) && [w.from.componentId, w.to.componentId].includes(supply.id));
    checks.push({
      id: "ground",
      title: "Common ground reference",
      status: sharedGround ? "pass" : "warning",
      detail: sharedGround ? "External power supply and microcontroller share a common ground reference." : "Multiple power domains should share a common ground reference.",
    });
  }

  const unknownRatings = project.components.flatMap((component) => component.specifications.filter((spec) => spec.status === "unknown").map((spec) => `${component.reference} ${spec.key}`));
  checks.push({ id: "ratings", title: "Component specifications & ratings", status: unknownRatings.length ? "unverified" : "pass", detail: unknownRatings.length ? `Verify on manufacturer datasheets: ${unknownRatings.join(", ")}.` : "All component ratings verified." });

  const sensor = project.components.find((component) => component.category === "sensor");
  if (sensor && mcu) {
    const sensorWire = project.connections.find((wire) => [wire.from.componentId, wire.to.componentId].includes(sensor.id));
    checks.push({
      id: "sensor-link",
      title: "Sensor signal interface",
      status: sensorWire ? "pass" : "warning",
      detail: sensorWire ? `Sensor signal connected to ${mcu.name}.` : `No signal connection found between ${sensor.name} and ${mcu.name}.`,
    });
  }

  const missingPins: string[] = [];
  for (const component of project.components) {
    const required = component.category === "controller" ? ["gnd"] : component.category === "sensor" ? ["vcc", "gnd"] : [];
    for (const pinId of required) if (!project.connections.some((wire) => (wire.from.componentId === component.id && wire.from.pinId === pinId) || (wire.to.componentId === component.id && wire.to.pinId === pinId))) missingPins.push(`${component.reference}.${pinId}`);
  }
  checks.push({ id: "required-pins", title: "Required connections", status: missingPins.length ? "warning" : "pass", detail: missingPins.length ? `Unconnected required pins: ${missingPins.join(", ")}.` : "Catalog-required supply and ground pins have connections." });
  return checks;
}

export function componentAt(project: Project, id: string): Component | undefined {
  return project.components.find((component) => component.id === id);
}
