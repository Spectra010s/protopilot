import Link from "next/link";
import { ArrowRight, Cable, CircuitBoard, Cpu, Database, FileCode2, FlaskConical, Layers3, ShieldCheck, Sparkles, Sprout, Waves, Zap } from "lucide-react";

export default function LandingPage() {
  return (
    <div className={"min-h-screen bg-canvas text-ink"}>
      {/* ── Header ── */}
      <header className={"flex h-[62px] items-center justify-between border-b border-line bg-white px-7 max-[760px]:h-14 max-[760px]:px-4"}>
        <div className={"flex items-center gap-[9px] whitespace-nowrap text-base font-semibold tracking-[-.04em] text-ink"}>
          <span className={"grid size-[30px] place-items-center rounded-[9px] bg-brand-soft text-brand"}><CircuitBoard size={19} /></span>
          <span>Proto<span className={"text-brand-ink"}>Pilot</span></span>
          <span className={"rounded-[5px] bg-chip px-1.5 py-[3px] text-[9px] font-bold tracking-[.07em] text-quiet"}>BETA</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-line bg-subtle px-3 py-1 text-[11px] text-body">
            <Database size={13} className="text-brand" />
            <span>100% Local-First</span>
          </div>
          <Link
            href="/workbench"
            className={"inline-flex min-h-[34px] items-center justify-center gap-2 rounded-lg bg-brand px-4 text-[12px] font-semibold text-white shadow-button hover:bg-brand-strong no-underline transition-colors"}
          >
            Open Workbench <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className={"mx-auto flex max-w-[920px] flex-col items-center px-6 pt-20 pb-16 text-center max-[760px]:pt-14 max-[760px]:pb-10"}>
        <div className={"mb-6 inline-flex items-center gap-2 rounded-full border border-line-strong bg-white px-3.5 py-1.5 text-[11px] font-medium text-body shadow-panel"}>
          <Sparkles size={14} className="text-brand" />
          Powered by Gemma 4 · Local-First Storage
        </div>
        <h1 className={"m-0 text-[46px] font-bold leading-[1.1] tracking-[-.04em] text-ink max-[760px]:text-[32px]"}>
          Turn a hardware idea into a<br className="max-[760px]:hidden" />{" "}
          <span className={"text-brand"}>complete circuit design</span>
        </h1>
        <p className={"mt-5 max-w-[580px] text-[16px] leading-[1.65] text-body max-[760px]:text-[14px]"}>
          Describe what you want to build. ProtoPilot designs the component selection, pin wiring, breadboard layout, schematic, firmware, and safety checks — running completely private in your browser.
        </p>
        <div className={"mt-8 flex flex-wrap items-center justify-center gap-3"}>
          <Link
            href="/workbench"
            className={"inline-flex min-h-[44px] items-center justify-center gap-2.5 rounded-xl bg-brand px-6 text-[14px] font-semibold text-white shadow-button hover:bg-brand-strong no-underline transition-colors"}
          >
            <Sparkles size={17} /> Launch Workbench <ArrowRight size={17} />
          </Link>
          <a
            href="#local-first"
            className={"inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-line-strong bg-white px-5 text-[14px] font-medium text-body no-underline hover:bg-subtle transition-colors"}
          >
            Why Local-First?
          </a>
        </div>

        {/* Mini preview mockup (Desktop scaled on mobile, fixed proportions, zero scrolling) */}
        <div className={"mt-10 sm:mt-14 w-full flex justify-center max-[860px]:h-[210px] max-[760px]:h-[160px] max-[540px]:h-[115px] max-[420px]:h-[100px] overflow-visible"}>
          <div className={"w-[800px] shrink-0 origin-top transform max-[860px]:scale-[0.85] max-[760px]:scale-[0.62] max-[540px]:scale-[0.45] max-[420px]:scale-[0.38] rounded-2xl border border-line-strong bg-white shadow-pop select-none"}>
            <div className={"flex h-[36px] items-center justify-between border-b border-line bg-chip px-4"}>
              <div className="flex items-center gap-2">
                <span className={"size-[9px] rounded-full bg-danger"} />
                <span className={"size-[9px] rounded-full bg-warn"} />
                <span className={"size-[9px] rounded-full bg-pass"} />
                <span className={"ml-3 text-[10px] font-medium text-quiet"}>ProtoPilot — Hardware CAD & Verification</span>
              </div>
              <div className="flex items-center gap-1.5 text-[9px] text-body">
                <span className="size-1.5 rounded-full bg-pass" />
                <span>Saved Locally</span>
              </div>
            </div>
            <div className={"grid grid-cols-3 gap-4 p-5"}>
              {/* Card 1 */}
              <div className={"rounded-xl border border-line bg-canvas p-4 text-left"}>
                <div className={"mb-2 flex items-center gap-2 text-brand-icon"}><Layers3 size={16} /><span className={"text-[11px] font-semibold text-ink-strong"}>Components BOM</span></div>
                <div className={"space-y-2"}>
                  <div className={"flex items-center gap-2 rounded-lg bg-white p-2 text-[10px] text-body"}><span className={"grid size-5 place-items-center rounded bg-controller-soft text-controller"}><Cpu size={12} /></span>ESP32-WROOM-32</div>
                  <div className={"flex items-center gap-2 rounded-lg bg-white p-2 text-[10px] text-body"}><span className={"grid size-5 place-items-center rounded bg-sensor-soft text-sensor"}><Waves size={12} /></span>Capacitive Soil Sensor</div>
                  <div className={"flex items-center gap-2 rounded-lg bg-white p-2 text-[10px] text-body"}><span className={"grid size-5 place-items-center rounded bg-driver-soft text-driver"}><Zap size={12} /></span>IRLZ44N MOSFET</div>
                </div>
              </div>
              {/* Card 2 */}
              <div className={"rounded-xl border border-line bg-canvas p-4 text-left"}>
                <div className={"mb-2 flex items-center gap-2 text-brand-icon"}><Cable size={16} /><span className={"text-[11px] font-semibold text-ink-strong"}>Breadboard & Netlist</span></div>
                <div className={"flex h-[106px] flex-col items-center justify-center rounded-lg border border-line-soft bg-white text-quiet gap-2"}>
                  <CircuitBoard size={28} className="text-brand-ink" />
                  <span className="text-[10px] font-mono text-quiet">Live SVG Rendering</span>
                </div>
              </div>
              {/* Card 3 */}
              <div className={"rounded-xl border border-line bg-canvas p-4 text-left"}>
                <div className={"mb-2 flex items-center gap-2 text-brand-icon"}><ShieldCheck size={16} /><span className={"text-[11px] font-semibold text-ink-strong"}>Electrical Checks</span></div>
                <div className={"space-y-2 text-[10px]"}>
                  <div className={"flex items-center gap-2 text-pass"}>✓ <span className="text-body">GPIO voltage within limits</span></div>
                  <div className={"flex items-center gap-2 text-pass"}>✓ <span className="text-body">Flyback clamp diode verified</span></div>
                  <div className={"flex items-center gap-2 text-pass"}>✓ <span className="text-body">Pin net references validated</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section id="local-first" className={"border-t border-line bg-subtle py-16"}>
        <div className={"mx-auto max-w-[920px] px-6"}>
          <div className="rounded-2xl border border-line-strong bg-white p-8 shadow-panel max-[760px]:p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="max-w-[560px]">
                <div className="inline-flex items-center gap-2 rounded-md bg-brand-soft px-2.5 py-1 text-[11px] font-semibold text-brand">
                  <Database size={14} /> Local-First Architecture
                </div>
                <h3 className="mt-3 text-[22px] font-bold text-ink-strong">Your hardware IP stays on your device.</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-body">
                  ProtoPilot stores your projects, revisions, wiring tables, and chat messages safely in your browser. No accounts, no telemetry database, and zero cloud lock-in. Only your AI generation requests call Gemma 4.
                </p>
              </div>
              <div className="flex flex-col gap-2.5 w-full md:w-auto shrink-0">
                <div className="flex items-center gap-2 text-[12px] text-body">
                  <span className="grid size-5 place-items-center rounded-full bg-pass text-white text-[10px]">✓</span>
                  <span>Instant offline load</span>
                </div>
                <div className="flex items-center gap-2 text-[12px] text-body">
                  <span className="grid size-5 place-items-center rounded-full bg-pass text-white text-[10px]">✓</span>
                  <span>100% private to your device</span>
                </div>
                <div className="flex items-center gap-2 text-[12px] text-body">
                  <span className="grid size-5 place-items-center rounded-full bg-pass text-white text-[10px]">✓</span>
                  <span>Zero mandatory sign-ups</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className={"border-t border-line bg-white py-20 max-[760px]:py-14"}>
        <div className={"mx-auto max-w-[920px] px-6"}>
          <div className={"mb-4 text-center"}>
            <span className={"text-[10px] font-bold tracking-[.1em] text-brand"}>WORKFLOW</span>
          </div>
          <h2 className={"m-0 text-center text-[30px] font-bold tracking-[-.03em] text-ink max-[760px]:text-[24px]"}>
            From natural language to buildable hardware
          </h2>
          <p className={"mx-auto mt-3 max-w-[480px] text-center text-[14px] leading-[1.6] text-body"}>
            Three steps. Verified against real pinouts and electrical rules.
          </p>

          <div className={"mt-14 grid grid-cols-3 gap-8 max-[760px]:grid-cols-1 max-[760px]:gap-6"}>
            <div className={"flex flex-col items-center text-center"}>
              <div className={"mb-4 grid size-[52px] place-items-center rounded-2xl bg-brand-soft text-brand"}>
                <Sparkles size={24} />
              </div>
              <span className={"mb-2 text-[9px] font-bold tracking-[.1em] text-quiet"}>STEP 1</span>
              <h3 className={"m-0 text-[15px] font-semibold text-ink-strong"}>Describe what you need</h3>
              <p className={"mt-2 text-[12px] leading-[1.6] text-body"}>
                Tell ProtoPilot your project idea and constraints. Gemma 4 interprets your requirements and identifies necessary electrical stages (controllers, sensors, drivers, protection).
              </p>
            </div>
            <div className={"flex flex-col items-center text-center"}>
              <div className={"mb-4 grid size-[52px] place-items-center rounded-2xl bg-brand-soft text-brand"}>
                <CircuitBoard size={24} />
              </div>
              <span className={"mb-2 text-[9px] font-bold tracking-[.1em] text-quiet"}>STEP 2</span>
              <h3 className={"m-0 text-[15px] font-semibold text-ink-strong"}>Inspect & verify</h3>
              <p className={"mt-2 text-[12px] leading-[1.6] text-body"}>
                Review the breadboard layout, schematic, wiring table, and firmware. Deterministic checks audit voltage boundaries, ground loops, and missing flyback protection.
              </p>
            </div>
            <div className={"flex flex-col items-center text-center"}>
              <div className={"mb-4 grid size-[52px] place-items-center rounded-2xl bg-brand-soft text-brand"}>
                <Sprout size={24} />
              </div>
              <span className={"mb-2 text-[9px] font-bold tracking-[.1em] text-quiet"}>STEP 3</span>
              <h3 className={"m-0 text-[15px] font-semibold text-ink-strong"}>Iterate & export</h3>
              <p className={"mt-2 text-[12px] leading-[1.6] text-body"}>
                Chat with the assistant to swap pins or modify behavior. Export the wiring table as CSV, download the schematic SVG, and copy Arduino C++ firmware directly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature Grid ── */}
      <section className={"border-t border-line py-20 max-[760px]:py-14"}>
        <div className={"mx-auto max-w-[920px] px-6"}>
          <div className={"mb-4 text-center"}>
            <span className={"text-[10px] font-bold tracking-[.1em] text-brand"}>CAPABILITIES</span>
          </div>
          <h2 className={"m-0 text-center text-[30px] font-bold tracking-[-.03em] text-ink max-[760px]:text-[24px]"}>
            Engineered for physical computing
          </h2>

          <div className={"mt-12 grid grid-cols-2 gap-5 max-[760px]:grid-cols-1"}>
            {([
              { icon: <Layers3 size={20} />, title: "Component bill of materials", desc: "Structured parts list with explicit electrical ratings, pin definitions, and highlighted review flags for unverified specs." },
              { icon: <CircuitBoard size={20} />, title: "Dynamic breadboard layout", desc: "Clean SVG breadboard visualization generated straight from the canonical circuit netlist." },
              { icon: <FlaskConical size={20} />, title: "Schematic view", desc: "Logical circuit schematic derived from the exact same single source of truth as the breadboard." },
              { icon: <Cable size={20} />, title: "Pin-to-pin wiring matrix", desc: "Color-coded wiring table showing every connection endpoint and net. Exportable as CSV." },
              { icon: <FileCode2 size={20} />, title: "Ready-to-flash firmware", desc: "Arduino C++ code mapped to the generated pin assignments with safety guards and calibration constants." },
              { icon: <ShieldCheck size={20} />, title: "Deterministic safety checks", desc: "Catches common maker mistakes before you plug in: GPIO overload, missing common ground, inductive flyback spikes." },
            ] as const).map((feature) => (
              <div className={"flex gap-4 rounded-xl border border-line bg-white p-5 shadow-panel"} key={feature.title}>
                <div className={"grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"}>
                  {feature.icon}
                </div>
                <div>
                  <h3 className={"m-0 text-[13px] font-semibold text-ink-strong"}>{feature.title}</h3>
                  <p className={"mt-1.5 text-[12px] leading-[1.6] text-body"}>{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className={"border-t border-line bg-white py-20 max-[760px]:py-14"}>
        <div className={"mx-auto flex max-w-[600px] flex-col items-center px-6 text-center"}>
          <div className={"mb-5 grid size-[56px] place-items-center rounded-2xl bg-brand-soft text-brand"}>
            <Sparkles size={28} />
          </div>
          <h2 className={"m-0 text-[28px] font-bold tracking-[-.03em] text-ink max-[760px]:text-[22px]"}>
            Ready to build your next circuit?
          </h2>
          <p className={"mt-3 text-[14px] leading-[1.6] text-body"}>
            No account, no setup. Everything saves locally to your browser.
          </p>
          <Link
            href="/workbench"
            className={"mt-7 inline-flex min-h-[48px] items-center justify-center gap-2.5 rounded-xl bg-brand px-7 text-[15px] font-semibold text-white shadow-button hover:bg-brand-strong no-underline transition-colors"}
          >
            <CircuitBoard size={18} /> Launch ProtoPilot Workbench <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={"border-t border-line px-7 py-6 max-[760px]:px-4"}>
        <div className={"mx-auto flex max-w-[920px] items-center justify-between text-[11px] text-quiet max-[760px]:flex-col max-[760px]:gap-2 max-[760px]:text-center"}>
          <span>Built for makers, engineers, and physical computing.</span>
          <span>ProtoPilot <span className="px-1">·</span> 100% Local-First Storage</span>
        </div>
      </footer>
    </div>
  );
}
