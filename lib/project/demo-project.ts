import { catalog } from "./catalog";
import { validateProject, type Project } from "./schema";

const makePart = (id: string, partId: keyof typeof catalog, reference: string, layout: { x: number; y: number }) => ({
  id, ...catalog[partId], reference, layout,
});

export const plantProject: Project = validateProject({
  schemaVersion: 1,
  id: "plant-watering-demo",
  revision: 0,
  title: "Smart Plant Watering",
  prompt: "Build a smart plant watering system that monitors soil moisture and automatically waters the plant when the soil gets too dry. Show the moisture level and allow manual watering.",
  summary: "Monitor soil moisture and water a plant when the reading stays below an adjustable threshold. A button can start a bounded manual watering cycle.",
  operatingPrinciple: "The capacitive probe produces an analog signal for the ESP32 ADC. The controller compares the reading with a calibrated dry threshold and switches the pump through a low-side MOSFET. A diode clamps the pump's inductive flyback. The pump uses a separate supply with a shared ground.",
  constraints: { controller: "ESP32 DevKit (exact board variant to confirm)", available: [], requirements: ["Monitor soil moisture", "Automatic watering at a threshold", "Show moisture level", "Manual watering button"] },
  components: [
    makePart("mcu", "esp32-devkit-generic", "U1", { x: 105, y: 210 }),
    makePart("moisture", "capacitive-soil-module", "S1", { x: 335, y: 108 }),
    makePart("mosfet", "logic-level-nmos", "Q1", { x: 610, y: 235 }),
    makePart("pump", "dc-pump", "M1", { x: 775, y: 118 }),
    makePart("diode", "flyback-diode", "D1", { x: 772, y: 310 }),
    makePart("supply", "pump-supply", "PS1", { x: 590, y: 410 }),
    makePart("button", "push-button", "SW1", { x: 120, y: 408 }),
  ],
  connections: [
    { id: "c1", from: { componentId: "mcu", pinId: "v33" }, to: { componentId: "moisture", pinId: "vcc" }, net: "3V3", color: "red", details: "Power the sensor from the ESP32 3V3 pin. Confirm the selected sensor board accepts 3.3 V." },
    { id: "c2", from: { componentId: "mcu", pinId: "gnd" }, to: { componentId: "moisture", pinId: "gnd" }, net: "GND", color: "black", details: "Common reference for the sensor signal." },
    { id: "c3", from: { componentId: "moisture", pinId: "ao" }, to: { componentId: "mcu", pinId: "gpio34" }, net: "MOISTURE", color: "yellow", details: "Analog output to ADC1 GPIO34. Verify the sensor output never exceeds the board's ADC input limit." },
    { id: "c4", from: { componentId: "mcu", pinId: "gpio26" }, to: { componentId: "mosfet", pinId: "gate" }, net: "PUMP_GATE", color: "blue", details: "GPIO26 is only a MOSFET gate control signal; it does not power the pump." },
    { id: "c5", from: { componentId: "pump", pinId: "negative" }, to: { componentId: "mosfet", pinId: "drain" }, net: "PUMP_LOW", color: "green", details: "Pump negative lead to MOSFET drain for low-side switching." },
    { id: "c6", from: { componentId: "mosfet", pinId: "source" }, to: { componentId: "supply", pinId: "ground" }, net: "PUMP_GND", color: "black", details: "MOSFET source to external pump supply ground." },
    { id: "c7", from: { componentId: "pump", pinId: "positive" }, to: { componentId: "supply", pinId: "positive" }, net: "PUMP_V+", color: "red", details: "Pump positive lead to the external supply positive terminal. Match supply voltage to the exact pump." },
    { id: "c8", from: { componentId: "diode", pinId: "cathode" }, to: { componentId: "pump", pinId: "positive" }, net: "PUMP_V+", color: "white", details: "Diode cathode (striped end) to pump positive." },
    { id: "c9", from: { componentId: "diode", pinId: "anode" }, to: { componentId: "pump", pinId: "negative" }, net: "PUMP_LOW", color: "white", details: "Diode anode to pump negative / MOSFET drain." },
    { id: "c10", from: { componentId: "supply", pinId: "ground" }, to: { componentId: "mcu", pinId: "gnd" }, net: "GND", color: "black", details: "Tie grounds together for this non-isolated low-side MOSFET circuit." },
    { id: "c11", from: { componentId: "button", pinId: "a" }, to: { componentId: "mcu", pinId: "gpio27" }, net: "MANUAL", color: "blue", details: "One button terminal to GPIO27 configured with INPUT_PULLUP." },
    { id: "c12", from: { componentId: "button", pinId: "b" }, to: { componentId: "mcu", pinId: "gnd" }, net: "GND", color: "black", details: "Other button terminal to ground." },
  ],
  powerDomains: [
    { id: "logic", voltage: 3.3, currentMax: null, source: "ESP32 board 3V3 pin", groundReference: "GND" },
    { id: "pump", voltage: null, currentMax: null, source: "External supply, select to match pump label", groundReference: "GND" },
  ],
  firmware: { board: "ESP32 DevKit (confirm exact variant)", language: "Arduino C++", filename: "plant_watering.ino", source: `// Smart Plant Watering — ESP32 Arduino
// Calibrate dryReference and wetReference from your exact sensor in your soil.
// Pump voltage/current and driver ratings must be confirmed before assembly.

constexpr int MOISTURE_PIN = 34; // ADC1 input
constexpr int PUMP_GATE_PIN = 26; // MOSFET gate control, never the pump itself
constexpr int MANUAL_BUTTON_PIN = 27; // button connects GPIO27 to GND
constexpr int DRY_REFERENCE = 3000; // calibration placeholder; replace with measured value
constexpr int WET_REFERENCE = 1300; // calibration placeholder; replace with measured value
constexpr int DRY_THRESHOLD_PERCENT = 35;
constexpr unsigned long WATERING_MS = 1200;
constexpr unsigned long COOLDOWN_MS = 30000;

unsigned long pumpStopAt = 0;
unsigned long nextWateringAt = 0;
bool pumping = false;
bool previousButton = HIGH;

int moisturePercent() {
  const int raw = analogRead(MOISTURE_PIN);
  return constrain(map(raw, DRY_REFERENCE, WET_REFERENCE, 0, 100), 0, 100);
}

void startWatering(unsigned long now) {
  if (now < nextWateringAt) return;
  digitalWrite(PUMP_GATE_PIN, HIGH);
  pumping = true;
  pumpStopAt = now + WATERING_MS;
  nextWateringAt = now + COOLDOWN_MS;
}

void setup() {
  Serial.begin(115200);
  pinMode(PUMP_GATE_PIN, OUTPUT);
  digitalWrite(PUMP_GATE_PIN, LOW);
  pinMode(MANUAL_BUTTON_PIN, INPUT_PULLUP);
  analogReadResolution(12);
}

void loop() {
  const unsigned long now = millis();
  const int moisture = moisturePercent();
  const bool button = digitalRead(MANUAL_BUTTON_PIN);

  Serial.printf("Moisture: %d%%\\n", moisture);
  if (moisture < DRY_THRESHOLD_PERCENT && !pumping) startWatering(now);
  if (previousButton == HIGH && button == LOW && !pumping) startWatering(now);
  previousButton = button;

  if (pumping && now >= pumpStopAt) {
    digitalWrite(PUMP_GATE_PIN, LOW);
    pumping = false;
  }
  delay(250);
}` },
  buildSteps: [
    "Confirm exact ESP32 board, sensor module, pump, MOSFET/driver, diode, and supply part numbers and datasheets.",
    "Keep the pump supply disconnected while wiring. Place the MOSFET as a low-side switch between pump negative and supply ground.",
    "Connect the flyback diode across the pump: cathode/striped end to pump positive, anode to the switched negative side.",
    "Connect the external pump supply ground to ESP32 ground. Keep the water reservoir and tubing away from exposed electronics.",
    "Power the ESP32 separately, verify sensor output stays within the ADC input range, and calibrate wet/dry readings before enabling automatic watering.",
    "Only then connect the pump supply and test for a short bounded pulse while watching the driver and pump temperature.",
  ],
  assumptions: [
    "Assume the selected capacitive sensor variant accepts 3.3 V; verify its exact datasheet.",
    "Moisture calibration references in the firmware are placeholders and must be measured for the actual probe and soil.",
    "The pump driver is a low-side logic-level N-channel MOSFET circuit; select exact ratings after identifying the pump.",
  ],
  warnings: ["Pump and MOSFET ratings are unknown until exact parts are selected."],
  clarificationQuestions: [],
});

export function updateConnection(project: Project, connectionId: string, toPinId: string): Project {
  return validateProject({
    ...project,
    revision: project.revision + 1,
    connections: project.connections.map((connection) => connection.id === connectionId
      ? { ...connection, to: { ...connection.to, pinId: toPinId } }
      : connection),
  });
}
