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

  const directPumpGpio = project.connections.some((wire) => {
    const pair = [wire.from, wire.to];
    return pair.some((end) => project.components.find((c) => c.id === end.componentId)?.category === "controller" && end.pinId.startsWith("gpio") &&
      pair.some((other) => project.components.find((c) => c.id === other.componentId)?.category === "load"));
  });
  checks.push({ id: "gpio-load", title: "Pump is not driven by a GPIO", status: directPumpGpio ? "fail" : "pass", detail: directPumpGpio ? "A controller GPIO appears directly connected to the pump." : "Pump connections use a driver stage; no direct GPIO-to-pump wire was found." });

  const hasMosfet = project.components.some((component) => component.category === "driver");
  checks.push({ id: "switch", title: "Pump switching stage", status: hasMosfet ? "pass" : "fail", detail: hasMosfet ? "A driver component is present between logic and pump power." : "Add a suitable MOSFET or pump driver; GPIO pins cannot supply pump current." });

  const diode = project.components.find((component) => component.category === "protection");
  checks.push({ id: "flyback", title: "Inductive-load protection", status: diode ? "pass" : "fail", detail: diode ? "Flyback diode is included; verify its polarity and ratings against the selected pump." : "Add a flyback diode across the DC pump." });

  const mcu = project.components.find((component) => component.category === "controller");
  const supply = project.components.find((component) => component.category === "power");
  const sharedGround = Boolean(mcu && supply && hasLink(project, [mcu.id, "gnd"], [supply.id, "ground"]));
  checks.push({ id: "ground", title: "Common ground", status: sharedGround ? "pass" : "warning", detail: sharedGround ? "The external supply and controller share a ground reference." : "A non-isolated low-side switch needs a shared ground between supply and controller." });

  const unknownRatings = project.components.flatMap((component) => component.specifications.filter((spec) => spec.status === "unknown").map((spec) => `${component.reference} ${spec.key}`));
  checks.push({ id: "ratings", title: "Voltage and current ratings", status: unknownRatings.length ? "unverified" : "pass", detail: unknownRatings.length ? `Confirm before powering: ${unknownRatings.join(", ")}.` : "Catalog ratings are present for the relevant components." });

  const sensor = project.components.find((component) => component.category === "sensor");
  const sensorSignal = project.connections.find((wire) => [wire.from.componentId, wire.to.componentId].includes(sensor?.id ?? "") && wire.net === "MOISTURE");
  const adcSafe = sensorSignal && mcu?.pins.some((pin) => pin.id === (sensorSignal.from.componentId === mcu.id ? sensorSignal.from.pinId : sensorSignal.to.pinId) && pin.kind === "analog");
  checks.push({ id: "adc", title: "Sensor output into ADC", status: sensor && adcSafe ? "warning" : sensor ? "fail" : "unverified", detail: sensor && adcSafe ? "An analog-capable controller pin is used; verify the sensor's maximum output is within the ADC input range." : sensor ? "The moisture signal is not connected to an analog-capable pin." : "No soil moisture sensor found." });

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
