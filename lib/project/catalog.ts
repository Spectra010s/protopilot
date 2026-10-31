import type { Component } from "./schema";

const pin = (id: string, label: string, kind: Component["pins"][number]["kind"], direction: Component["pins"][number]["direction"], capabilities: string[] = [], voltageMin: number | null = null, voltageMax: number | null = null) => ({ id, label, kind, direction, capabilities, voltageMin, voltageMax });

export const catalog: Record<string, Omit<Component, "id" | "reference" | "layout">> = {
  "esp32-devkit-generic": {
    partId: "esp32-devkit-generic", name: "ESP32 development board", category: "controller",
    description: "ESP32 development board; exact vendor and board revision not selected.",
    pins: [
      pin("v33", "3V3", "power", "out", ["3.3V rail"], 3.3, 3.3),
      pin("gnd", "GND", "ground", "passive", ["ground"]),
      pin("gpio34", "GPIO34 / ADC1", "analog", "in", ["ADC1", "input-only"], 0, 3.3),
      pin("gpio35", "GPIO35 / ADC1", "analog", "in", ["ADC1", "input-only"], 0, 3.3),
      pin("gpio26", "GPIO26", "digital", "out", ["digital output", "PWM"] , 0, 3.3),
      pin("gpio27", "GPIO27", "digital", "in", ["digital input", "pull-up"] , 0, 3.3),
    ],
    specifications: [
      { key: "logicVoltage", value: 3.3, unit: "V", status: "verified", source: "https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp-dev-kits-en-master-esp32.pdf" },
      { key: "boardVariant", value: null, status: "unknown" },
    ],
  },
  "capacitive-soil-module": {
    partId: "capacitive-soil-module", name: "Capacitive soil moisture sensor", category: "sensor",
    description: "Generic capacitive module. Exact revision and output range must be confirmed.",
    pins: [pin("vcc", "VCC", "power", "in", [], 3.3, 3.3), pin("gnd", "GND", "ground", "passive", ["ground"]), pin("ao", "AO", "analog", "out", ["analog output"], 0, null)],
    specifications: [
      { key: "supplyVoltage", value: 3.3, unit: "V", status: "assumed", source: "Assume a module variant that accepts 3.3 V; verify its datasheet." },
      { key: "analogOutputMax", value: null, unit: "V", status: "unknown" },
    ],
  },
  "logic-level-nmos": {
    partId: "logic-level-nmos", name: "Logic-level N-channel MOSFET driver", category: "driver",
    description: "Low-side pump switch. Select a specific MOSFET or driver module before assembly.",
    pins: [pin("gate", "GATE", "digital", "in", ["logic-level drive"]), pin("drain", "DRAIN", "load", "bidirectional"), pin("source", "SOURCE", "ground", "passive", ["ground"])],
    specifications: [
      { key: "logicLevelAtVgs", value: null, unit: "V", status: "unknown" },
      { key: "continuousDrainCurrent", value: null, unit: "A", status: "unknown" },
    ],
  },
  "dc-pump": {
    partId: "dc-pump", name: "Low-voltage DC water pump", category: "load",
    description: "Exact pump model not selected. Do not connect directly to a GPIO.",
    pins: [pin("positive", "+", "power", "in"), pin("negative", "−", "load", "in")],
    specifications: [{ key: "ratedVoltage", value: null, unit: "V", status: "unknown" }, { key: "startupCurrent", value: null, unit: "A", status: "unknown" }],
  },
  "flyback-diode": {
    partId: "flyback-diode", name: "Flyback protection diode", category: "protection",
    description: "Place across the pump terminals, reverse-biased during normal operation.",
    pins: [pin("anode", "ANODE", "load", "passive"), pin("cathode", "CATHODE", "load", "passive")],
    specifications: [{ key: "reverseVoltage", value: null, unit: "V", status: "unknown" }, { key: "surgeCurrent", value: null, unit: "A", status: "unknown" }],
  },
  "pump-supply": {
    partId: "pump-supply", name: "External pump power supply", category: "power",
    description: "Choose a supply that matches the exact pump voltage and startup current.",
    pins: [pin("positive", "+V", "power", "out"), pin("ground", "GND", "ground", "passive", ["ground"])],
    specifications: [{ key: "outputVoltage", value: null, unit: "V", status: "unknown" }, { key: "currentCapacity", value: null, unit: "A", status: "unknown" }],
  },
  "push-button": {
    partId: "push-button", name: "Manual watering button", category: "input",
    description: "Momentary button uses the controller input's internal pull-up.",
    pins: [pin("a", "A", "switch", "passive"), pin("b", "B", "switch", "passive")],
    specifications: [{ key: "contactType", value: "momentary normally open", status: "assumed" }],
  },
};

export const catalogSources = [
  { label: "Espressif ESP32 DevKitC guide", url: "https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp-dev-kits-en-master-esp32.pdf" },
  { label: "Espressif KiCad libraries", url: "https://github.com/espressif/kicad-libraries" },
  { label: "KiCad library license", url: "https://www.kicad.org/libraries/license/" },
];
