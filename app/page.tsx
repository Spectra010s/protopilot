"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, ArrowUpRightFromSquare, Bot, Check, ChevronDown, CircleHelp, CircuitBoard, Copy, Download, Droplets, FileCode2, FlaskConical, Layers3, LoaderCircle, Plus, Send, ShieldCheck, Sparkles, Sprout, Waves, Cable, Cpu, Menu, X } from "lucide-react";
import { BreadboardView } from "@/components/breadboard-view";
import { SchematicView } from "@/components/schematic-view";
import { deriveWiringTable, validateElectrical } from "@/lib/project/derive";
import { plantProject, updateConnection } from "@/lib/project/demo-project";
import { ProjectSchema, type Project } from "@/lib/project/schema";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type View = "breadboard" | "schematic";
const STORAGE_KEY = "protopilot:project:v1";

export default function Home() {
  const [project, setProject] = useState<Project>(plantProject);
  const [view, setView] = useState<View>("breadboard");
  const [prompt, setPrompt] = useState("");
  const [revision, setRevision] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("Demo project loaded");
  const [copied, setCopied] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const checks = useMemo(() => validateElectrical(project), [project]);
  const wiring = useMemo(() => deriveWiringTable(project), [project]);
  const failCount = checks.filter((item) => item.status === "fail").length;
  const warningCount = checks.filter((item) => item.status === "warning" || item.status === "unverified").length;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setProject(ProjectSchema.parse(JSON.parse(saved)));
        setNotice("Project restored from this browser");
      }
    } catch {
      setNotice("Demo project loaded; saved project could not be read");
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project)); }
    catch { setNotice("Browser storage is full; changes are not saved"); }
  }, [project, storageReady]);

  async function generateIdea() {
    if (!prompt.trim()) return;
    setBusy(true);
    try {
      const response = await fetch("/api/projects/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: prompt.trim() }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Generation failed");
      if (body.project) setProject(ProjectSchema.parse(body.project));
      setNotice(body.mode === "mock" ? "Demo design generated" : "Gemma design generated");
      if (body.questions?.length) setNotice(`${body.questions.length} clarification question${body.questions.length === 1 ? "" : "s"} needed`);
      setPrompt("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not generate the design");
    } finally { setBusy(false); }
  }

  async function reviseProject() {
    if (!revision.trim()) return;
    setBusy(true);
    try {
      const response = await fetch("/api/projects/revise", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project, request: revision.trim() }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Revision failed");
      if (body.project) setProject(ProjectSchema.parse(body.project));
      setNotice(body.message ?? "Project updated");
      setRevision("");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not revise the design"); }
    finally { setBusy(false); }
  }

  function toggleConnectionProof() {
    const nextPin = project.connections.find((connection) => connection.id === "c3")?.to.pinId === "gpio35" ? "gpio34" : "gpio35";
    setProject((current) => updateConnection(current, "c3", nextPin));
    setNotice(`Shared connection changed to ${nextPin === "gpio35" ? "GPIO35" : "GPIO34"}`);
  }

  async function copyFirmware() {
    await navigator.clipboard.writeText(project.firmware.source);
    setCopied(true); window.setTimeout(() => setCopied(false), 1600);
  }

  function downloadFirmware() {
    const file = new Blob([project.firmware.source], { type: "text/plain" });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = project.firmware.filename; anchor.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><CircuitBoard size={19} /></span><span>Proto<span className="brand-strong">Pilot</span></span><span className="beta-pill">BETA</span></div>
        <nav className={mobileMenu ? "top-nav nav-open" : "top-nav"}>
          <a className="nav-active" href="#workspace">Workbench</a><a href="#components">Components</a><a href="#firmware">Firmware</a>
        </nav>
        <div className="top-actions"><span className="saved-indicator"><span className="saved-dot" />Saved locally</span><button className="avatar-button" aria-label="Open project menu">AD</button></div>
        <button className="mobile-menu" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle menu">{mobileMenu ? <X /> : <Menu />}</button>
      </header>

      <main id="workspace" className="workspace">
        <aside className="left-column">
          <div className="breadcrumb"><span>My projects</span><span>/</span><strong>Plant watering</strong></div>
          <div className="project-heading"><div className="project-icon"><Sprout size={21} /></div><div><p className="eyebrow">HARDWARE PROJECT</p><h1>{project.title}</h1></div><button className="icon-button more-button" aria-label="Project options"><ChevronDown size={16} /></button></div>
          <p className="project-summary">{project.summary}</p>
          <div className="project-meta"><span><span className="live-dot" />{notice}</span><span>Edited just now</span></div>

          <section className="panel prompt-panel">
            <div className="panel-title-row"><div className="panel-title"><Sparkles size={16} /><h2>Describe a project</h2></div><span className="optional">NEW</span></div>
            <label className="sr-only" htmlFor="project-prompt">Describe a hardware project</label>
            <textarea id="project-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="What would you like to build? Include what it should do and any parts you have." rows={4} />
            <div className="prompt-foot"><span>AI will ask if key details are missing</span><button className="primary-button compact" onClick={generateIdea} disabled={busy || !prompt.trim()}>{busy ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={14} />} Generate</button></div>
            <details className="constraint-details"><summary>Optional constraints</summary><div className="constraint-chip-row"><button type="button">ESP32 <ChevronDown size={12} /></button><button type="button">Parts I have <Plus size={12} /></button><button type="button">Budget <Plus size={12} /></button></div></details>
          </section>

          <section className="panel overview-panel">
            <div className="panel-title-row"><div className="panel-title"><Activity size={16} /><h2>Project overview</h2></div><button className="text-button">Edit <ArrowUpRight size={13} /></button></div>
            <p>{project.operatingPrinciple}</p>
            <div className="overview-stats"><div><span>CONTROLLER</span><strong>{project.constraints.controller}</strong></div><div><span>CONNECTIONS</span><strong>{project.connections.length} wires</strong></div></div>
          </section>

          <section className="panel parts-panel" id="components">
            <div className="panel-title-row"><div className="panel-title"><Layers3 size={16} /><h2>Components</h2><span className="count-pill">{project.components.length}</span></div><button className="icon-button" aria-label="Add component"><Plus size={16} /></button></div>
            <div className="part-list">{project.components.map((component) => <div className="part-row" key={component.id}><div className={`part-icon ${component.category}`}><PartIcon category={component.category} /></div><div className="part-copy"><strong><span>{component.reference}</span> {component.name}</strong><small>{component.specifications.some((spec) => spec.status === "unknown") ? "Some ratings not specified" : component.description}</small></div><button className="part-menu" aria-label={`More about ${component.name}`}><ChevronDown size={14} /></button></div>)}</div>
            <div className="parts-footer"><CircleHelp size={14} /><span>Part specs with unknown ratings are flagged for review.</span></div>
          </section>
        </aside>

        <section className="center-column">
          <div className="canvas-toolbar"><div className="canvas-heading"><div className="panel-title"><Cable size={17} /><h2>Circuit workspace</h2></div><span className="revision-badge">v{project.revision + 1}</span></div><div className="canvas-actions"><button className="outline-button" onClick={toggleConnectionProof}><Waves size={14} />Change test connection</button><button className="icon-button" aria-label="Download diagram"><Download size={16} /></button><button className="icon-button" aria-label="Expand diagram"><ArrowUpRightFromSquare size={15} /></button></div></div>
          <div className="view-tabs-row">
            <Tabs value={view} onValueChange={(value) => setView(value as View)} className="circuit-tabs">
              <TabsList className="view-tabs" aria-label="Circuit view">
                <TabsTrigger value="breadboard" className="view-tab"><CircuitBoard size={15} />Breadboard <span className="view-label">view</span></TabsTrigger>
                <TabsTrigger value="schematic" className="view-tab"><FlaskConical size={15} />Schematic <span className="view-label">view</span><span className="poc-tag">POC</span></TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="view-tools"><span><span className="view-dot" />Live layout</span><button className="icon-button zoom-button" aria-label="Zoom in">+</button><span>100%</span><button className="icon-button zoom-button" aria-label="Zoom out">−</button></div>
          </div>
          <div className="diagram-stage">{view === "breadboard" ? <BreadboardView project={project} /> : <SchematicView project={project} />}</div>
          <div className="diagram-footer"><span><span className="legend-line red" />Power</span><span><span className="legend-line dark" />Ground</span><span><span className="legend-line blue" />Signal</span><button className="text-button" onClick={() => document.getElementById("wiring")?.scrollIntoView({ behavior: "smooth" })}>View wiring table <ArrowDownRight size={13} /></button></div>

          <section className="panel wiring-panel" id="wiring">
            <div className="panel-title-row"><div className="panel-title"><Cable size={16} /><h2>Pin-to-pin wiring</h2><span className="count-pill">{wiring.length}</span></div><button className="text-button">Export CSV <Download size={13} /></button></div>
            <div className="table-scroll"><table><thead><tr><th>FROM</th><th>TO</th><th>NET</th><th>CONNECTION DETAILS</th></tr></thead><tbody>{wiring.map((row) => <tr key={row.id}><td><span className="wire-color" style={{ background: row.color }} />{row.from}</td><td>{row.to}</td><td><span className="net-pill">{row.net}</span></td><td>{row.details}</td></tr>)}</tbody></table></div>
          </section>

          <section className="panel firmware-panel" id="firmware">
            <div className="panel-title-row"><div className="panel-title"><FileCode2 size={16} /><h2>Firmware</h2><span className="language-pill">Arduino C++</span></div><div className="code-actions"><button className="text-button" onClick={copyFirmware}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "Copied" : "Copy"}</button><button className="text-button" onClick={downloadFirmware}><Download size={13} />Download</button></div></div>
            <div className="code-window"><div className="code-window-top"><span><i /><i /><i /></span><span>{project.firmware.filename}</span><span>ESP32</span></div><pre><code>{project.firmware.source}</code></pre></div>
            <div className="firmware-note"><CircleHelp size={14} /><span>Moisture calibration constants are placeholders. Measure your sensor before enabling automatic watering.</span></div>
          </section>
        </section>

        <aside className="right-column">
          <section className="panel validation-panel">
            <div className="panel-title-row"><div className="panel-title"><ShieldCheck size={17} /><h2>Engineering checks</h2></div><span className={failCount ? "check-summary risk" : "check-summary"}>{failCount ? `${failCount} issue${failCount === 1 ? "" : "s"}` : warningCount ? `${warningCount} review` : "All clear"}</span></div>
            <p className="panel-description">Deterministic checks from the component catalog. Passing checks do not guarantee safe or functional hardware.</p>
            <div className="check-list">{checks.map((check) => <div className={`check-row ${check.status}`} key={check.id}><div className="check-icon">{check.status === "pass" ? <Check size={13} /> : check.status === "fail" ? <X size={13} /> : <CircleHelp size={13} />}</div><div><strong>{check.title}</strong><p>{check.detail}</p></div></div>)}</div>
            <div className="check-legend"><span><i className="pass-dot" />Passed</span><span><i className="warn-dot" />Review</span><span><i className="unknown-dot" />Unverified</span></div>
          </section>

          <section className="panel assistant-panel">
            <div className="assistant-header"><div className="assistant-avatar"><Bot size={17} /></div><div><h2>Design assistant</h2><span><span className="ai-online" />Mock demo provider</span></div><button className="icon-button" aria-label="Assistant settings"><ChevronDown size={14} /></button></div>
            <div className="assistant-thread"><div className="assistant-message"><p>The pump is switched by a MOSFET, so the ESP32 pin controls the gate instead of carrying the pump current.</p><span>Just now</span></div><div className="assistant-tip"><Sparkles size={13} /><span>Try asking to change the controller or add a status LED.</span></div></div>
            <form className="revision-form" onSubmit={(event) => { event.preventDefault(); reviseProject(); }}><label className="sr-only" htmlFor="revision-request">Ask for a design change</label><textarea id="revision-request" rows={2} placeholder="Ask for a change or explanation…" value={revision} onChange={(event) => setRevision(event.target.value)} /><div className="revision-form-footer"><span>Updates the model and derived outputs</span><button className="send-button" type="submit" disabled={busy || !revision.trim()} aria-label="Send revision request">{busy ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />}</button></div></form>
            <div className="assistant-disclaimer">AI suggestions are drafts. Verify exact part ratings before building.</div>
          </section>

          <section className="panel build-panel"><div className="panel-title-row"><div className="panel-title"><Droplets size={16} /><h2>Build notes</h2></div><button className="text-button">{project.buildSteps.length} steps <ChevronDown size={13} /></button></div><ol>{project.buildSteps.slice(0, 3).map((step, index) => <li key={step}><span>{index + 1}</span><p>{step}</p></li>)}</ol><button className="full-link">Open full assembly guide <ArrowUpRight size={13} /></button></section>
          <div className="persist-note"><Cpu size={14} /><span>Projects save in this browser only. No account needed.</span></div>
        </aside>
      </main>
      <footer className="app-footer"><span>Built for people who make things.</span><span>ProtoPilot <span className="footer-sep">·</span> Design with care</span></footer>
    </div>
  );
}

function PartIcon({ category }: { category: string }) {
  if (category === "controller") return <Cpu size={16} />;
  if (category === "sensor") return <Activity size={16} />;
  if (category === "load") return <Waves size={16} />;
  if (category === "power") return <ArrowUpRight size={16} />;
  if (category === "input") return <Plus size={16} />;
  if (category === "protection") return <ShieldCheck size={16} />;
  return <CircuitBoard size={16} />;
}
