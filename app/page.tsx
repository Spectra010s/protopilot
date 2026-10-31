"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, ArrowUpRightFromSquare, Bot, Check, ChevronDown, CircleHelp, CircuitBoard, Copy, Download, Droplets, FileCode2, FlaskConical, Layers3, LoaderCircle, Plus, Send, ShieldCheck, Sparkles, Sprout, Waves, Cable, Cpu, Menu, X } from "lucide-react";
import { BreadboardView } from "@/components/breadboard-view";
import { SchematicView } from "@/components/schematic-view";
import { deriveWiringTable, validateElectrical } from "@/lib/project/derive";
import { plantProject, updateConnection } from "@/lib/project/demo-project";
import { ProjectSchema, type Project } from "@/lib/project/schema";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addProjectMessage, getMostRecentProjectDraft, getProjectDraft, listProjectDrafts, listProjectMessages, saveProjectDraft, type ProjectConversationMessage, type ProjectDraftSummary } from "@/lib/storage/indexeddb";
import { cn } from "cn";

type View = "breadboard" | "schematic";

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
  const [conversations, setConversations] = useState<Record<string, ProjectConversationMessage[]>>({});
  const conversation = conversations[project.id] ?? [];
  const [projectDrafts, setProjectDrafts] = useState<ProjectDraftSummary[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const libraryRef = useRef<HTMLElement | null>(null);
  const libraryTriggerRef = useRef<HTMLButtonElement | null>(null);
  const checks = useMemo(() => validateElectrical(project), [project]);
  const wiring = useMemo(() => deriveWiringTable(project), [project]);
  const failCount = checks.filter((item) => item.status === "fail").length;
  const warningCount = checks.filter((item) => item.status === "warning" || item.status === "unverified").length;

  useEffect(() => {
    let active = true;
    void getMostRecentProjectDraft().then((saved) => {
      if (!active) return;
      if (saved) {
        setProject(saved);
        setNotice("Project restored from IndexedDB");
      }
      setStorageReady(true);
    }).catch((error: unknown) => {
      if (!active) return;
      setNotice(error instanceof Error ? `Local save unavailable: ${error.message}` : "Local save unavailable; this session is not saved");
      setStorageReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void saveProjectDraft(project).catch((error: unknown) => {
        if (active) setNotice(error instanceof Error ? `Could not save draft: ${error.message}` : "Could not save draft to IndexedDB");
      }).then(() => listProjectDrafts()).then((drafts) => {
        if (active) setProjectDrafts(drafts);
      }).catch(() => undefined);
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [project, storageReady]);

  useEffect(() => {
    if (!libraryOpen) return;
    let active = true;
    void listProjectDrafts().then((drafts) => {
      if (active) setProjectDrafts(drafts);
    }).catch((error: unknown) => {
      if (active) setNotice(error instanceof Error ? `Could not load projects: ${error.message}` : "Could not load saved projects");
    });
    return () => { active = false; };
  }, [libraryOpen]);

  useEffect(() => {
    if (!libraryOpen) return;
    const dialog = libraryRef.current;
    const trigger = libraryTriggerRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () => Array.from(
      dialog?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [],
    ).filter((element) => element.offsetParent !== null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setLibraryOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const items = focusables();
      if (!items.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    dialog?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      (previousFocus ?? trigger)?.focus();
    };
  }, [libraryOpen]);

  async function openSavedProject(id: string) {
    try {
      const saved = await getProjectDraft(id);
      if (!saved) throw new Error("This saved project is unavailable or has an unsupported format.");
      setProject(saved);
      setLibraryOpen(false);
      setNotice("Project opened from this browser");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not open this project");
    }
  }

  useEffect(() => {
    if (!storageReady) return;
    let active = true;
    void listProjectMessages(project.id).then((messages) => {
      if (active) setConversations((current) => ({ ...current, [project.id]: messages }));
    }).catch((error: unknown) => {
      if (active) setNotice(error instanceof Error ? `Could not load conversation: ${error.message}` : "Could not load saved conversation");
    });
    return () => { active = false; };
  }, [project.id, storageReady]);

  async function recordMessage(role: ProjectConversationMessage["role"], content: string, projectId = project.id) {
    try {
      const message = await addProjectMessage(projectId, role, content);
      setConversations((current) => ({ ...current, [projectId]: [...(current[projectId] ?? []), message] }));
    } catch (error) {
      const message: ProjectConversationMessage = { id: crypto.randomUUID(), projectId, role, content, createdAt: Date.now() };
      setConversations((current) => ({ ...current, [projectId]: [...(current[projectId] ?? []), message] }));
      setNotice(error instanceof Error ? `Conversation stays in this session: ${error.message}` : "Conversation could not be saved");
    }
  }

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
    const request = revision.trim();
    const projectId = project.id;
    await recordMessage("user", request, projectId);
    try {
      const response = await fetch("/api/projects/revise", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project, request }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Revision failed");
      if (body.project) setProject(ProjectSchema.parse(body.project));
      setNotice(body.message ?? "Project updated");
      if (body.message) await recordMessage("assistant", body.message, projectId);
      setRevision("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not revise the design";
      setNotice(message);
      await recordMessage("assistant", message, projectId);
    }
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
    <div className={"min-h-screen bg-canvas text-[13px] text-ink"}>
      <header className={"flex h-[62px] items-center gap-[38px] border-b border-line bg-white px-7 max-[760px]:h-14 max-[760px]:gap-3 max-[760px]:px-3.5"}>
        <div className={"flex items-center gap-[9px] whitespace-nowrap text-base font-semibold tracking-[-.04em] text-ink"}><span className={"grid size-[30px] place-items-center rounded-[9px] bg-brand-soft text-brand"}><CircuitBoard size={19} /></span><span>Proto<span className={"text-brand-ink"}>Pilot</span></span><span className={"rounded-[5px] bg-chip px-1.5 py-[3px] text-[9px] font-bold tracking-[.07em] text-quiet"}>BETA</span></div>
        <nav className={cn("flex h-full items-center gap-[26px] max-[760px]:absolute max-[760px]:left-0 max-[760px]:right-0 max-[760px]:top-[55px] max-[760px]:z-10 max-[760px]:h-auto max-[760px]:border-b max-[760px]:border-line max-[760px]:bg-white max-[760px]:px-4 max-[760px]:py-1.5", mobileMenu ? "max-[760px]:flex" : "max-[760px]:hidden")}>
          <a className={"flex h-full items-center border-b-2 border-brand text-xs text-brand no-underline max-[760px]:h-[34px] max-[760px]:border-0"} href="#workspace">Workbench</a><a className={"flex h-full items-center border-b-2 border-transparent text-xs text-quiet no-underline max-[760px]:h-[34px] max-[760px]:border-0"} href="#components">Components</a><a className={"flex h-full items-center border-b-2 border-transparent text-xs text-quiet no-underline max-[760px]:h-[34px] max-[760px]:border-0"} href="#firmware">Firmware</a>
        </nav>
        <div className={"ml-auto flex items-center gap-4 max-[760px]:gap-[9px]"}><span className={"flex items-center gap-[7px] text-[11px] text-body max-[760px]:text-[0px]"}><span className={"inline-block size-[7px] shrink-0 rounded-full bg-pass max-[760px]:size-2"} />Saved locally</span><button className={"size-[30px] rounded-full bg-brand-soft text-[10px] font-bold text-brand-strong"} aria-label="Open project menu">AD</button></div>
        <button className={"hidden border-0 bg-transparent text-ink-soft max-[760px]:grid max-[760px]:size-[30px] max-[760px]:place-items-center"} onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle menu">{mobileMenu ? <X /> : <Menu />}</button>
      </header>

      <main id="workspace" className={"mx-auto grid w-full max-w-[1600px] grid-cols-[minmax(255px,292px)_minmax(400px,1fr)_minmax(270px,310px)] items-start gap-[18px] px-[26px] py-[22px] pb-8 max-[1180px]:grid-cols-[minmax(240px,280px)_minmax(380px,1fr)] max-[760px]:flex max-[760px]:flex-col max-[760px]:gap-[13px] max-[760px]:px-3 max-[760px]:py-4 max-[760px]:pb-[22px]"}>
        <aside className={"flex min-w-0 flex-col gap-[14px] max-[760px]:w-full max-[760px]:gap-3 max-[760px]:order-2"}>
          <div className={"flex gap-2 text-[10px] text-faint"}><button ref={libraryTriggerRef} className={"p-0 text-inherit hover:text-brand hover:underline"} type="button" onClick={() => setLibraryOpen(true)}>My projects</button><span>/</span><strong className={"font-medium text-body"}>{project.title}</strong></div>
          <div className={"flex items-center gap-2.5"}><div className={"grid size-[38px] shrink-0 place-items-center rounded-[11px] border border-line bg-brand-soft text-brand-ink"}><Sprout size={21} /></div><div><p className={"m-0 text-[9px] font-bold tracking-[.11em] text-faint"}>HARDWARE PROJECT</p><h1 className={"mt-0.5 text-[17px] leading-tight tracking-[-.03em]"}>{project.title}</h1></div><button className={"inline-grid size-[30px] min-w-[30px] place-items-center rounded-lg border border-line bg-white text-quiet hover:bg-subtle ml-auto"} aria-label="Project options"><ChevronDown size={16} /></button></div>
          <p className={"-mt-1.5 ml-12 text-[11px] leading-relaxed text-body"}>{project.summary}</p>
          <div className={"flex justify-between gap-2 text-[9px] text-quiet [&>span:first-child]:flex [&>span:first-child]:items-center [&>span:first-child]:gap-1.5 [&>span:first-child]:text-body [&>span:last-child]:max-[430px]:hidden"}><span><span className={"inline-block size-1.5 rounded-full bg-pass"} />{notice}</span><span>Edited just now</span></div>

          <section className={"min-w-0 rounded-xl border border-line bg-white p-[15px] shadow-panel"}>
            <div className={"mb-3 flex items-center justify-between gap-2"}><div className={"flex min-w-0 items-center gap-2 text-brand-icon [&>h2]:m-0 [&>h2]:text-xs [&>h2]:font-semibold [&>h2]:tracking-[-.01em] [&>h2]:text-ink-strong"}><Sparkles size={16} /><h2>Describe a project</h2></div><span className={"text-[9px] font-bold tracking-[.08em] text-quiet"}>NEW</span></div>
            <label className="sr-only" htmlFor="project-prompt">Describe a hardware project</label>
            <textarea className={"w-full min-h-[85px] resize-y rounded-lg border border-line-strong bg-inset p-2.5 text-[11px] leading-[1.5] text-ink-strong outline-none placeholder:text-faint focus:border-brand focus:shadow-focus"} id="project-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="What would you like to build? Include what it should do and any parts you have." rows={4} />
            <div className={"mt-[9px] flex items-center justify-between gap-[7px] text-[9px] text-faint"}><span>AI will ask if key details are missing</span><button className={"inline-flex min-h-[30px] items-center justify-center gap-[7px] rounded-lg bg-brand px-2.5 text-[11px] font-semibold text-white shadow-button hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"} onClick={generateIdea} disabled={busy || !prompt.trim()}>{busy ? <LoaderCircle className="animate-spin" size={15} /> : <Sparkles size={14} />} Generate</button></div>
            <details className={"mt-[11px] border-t border-line-soft pt-2.5 text-[10px] text-body [&>summary]:cursor-pointer"}><summary>Optional constraints</summary><div className={"mt-[9px] flex flex-wrap gap-1.5 [&>button]:inline-flex [&>button]:items-center [&>button]:gap-1 [&>button]:rounded-md [&>button]:border [&>button]:border-line-strong [&>button]:bg-white [&>button]:px-[7px] [&>button]:py-[5px] [&>button]:text-[9px] [&>button]:text-body"}><button type="button">ESP32 <ChevronDown size={12} /></button><button type="button">Parts I have <Plus size={12} /></button><button type="button">Budget <Plus size={12} /></button></div></details>
          </section>

          <section className={"min-w-0 rounded-xl border border-line bg-white p-[15px] shadow-panel"}>
            <div className={"mb-3 flex items-center justify-between gap-2"}><div className={"flex min-w-0 items-center gap-2 text-brand-icon [&>h2]:m-0 [&>h2]:text-xs [&>h2]:font-semibold [&>h2]:tracking-[-.01em] [&>h2]:text-ink-strong"}><Activity size={16} /><h2>Project overview</h2></div><button className={"inline-flex items-center justify-center gap-1.5 whitespace-nowrap bg-transparent text-[10px] text-brand-ink hover:text-brand-strong"}>Edit <ArrowUpRight size={13} /></button></div>
            <p className={"m-0 text-[10px] leading-relaxed text-body"}>{project.operatingPrinciple}</p>
            <div className={"mt-[14px] grid grid-cols-2 gap-[9px] border-t border-line-soft pt-3 [&>div]:flex [&>div]:min-w-0 [&>div]:flex-col [&>div]:gap-[5px] [&_span]:text-[8px] [&_span]:font-bold [&_span]:tracking-[.08em] [&_span]:text-faint [&_strong]:overflow-hidden [&_strong]:text-ellipsis [&_strong]:whitespace-nowrap [&_strong]:text-[10px] [&_strong]:font-semibold [&_strong]:text-ink-soft"}><div><span>CONTROLLER</span><strong>{project.constraints.controller}</strong></div><div><span>CONNECTIONS</span><strong>{project.connections.length} wires</strong></div></div>
          </section>

          <section className={"min-w-0 rounded-xl border border-line bg-white p-[15px] shadow-panel"} id="components">
            <div className={"mb-3 flex items-center justify-between gap-2"}><div className={"flex min-w-0 items-center gap-2 text-brand-icon [&>h2]:m-0 [&>h2]:text-xs [&>h2]:font-semibold [&>h2]:tracking-[-.01em] [&>h2]:text-ink-strong"}><Layers3 size={16} /><h2>Components</h2><span className={"min-w-[19px] rounded-[10px] bg-brand-soft px-1.5 py-[3px] text-center text-[9px] font-semibold text-brand-ink"}>{project.components.length}</span></div><button className={"inline-grid size-[30px] min-w-[30px] place-items-center rounded-lg border border-line bg-white text-quiet hover:bg-subtle"} aria-label="Add component"><Plus size={16} /></button></div>
            <div className={"flex flex-col"}>{project.components.map((component) => <div className={"flex min-w-0 items-center gap-[9px] border-t border-line-soft py-[9px]"} key={component.id}><div className={cn("grid size-[29px] shrink-0 place-items-center rounded-lg bg-sensor-soft text-sensor", (component.category === "controller" ? "bg-controller-soft text-controller" : component.category === "power" ? "bg-power-soft text-power" : component.category === "driver" ? "bg-driver-soft text-driver" : ""))}><PartIcon category={component.category} /></div><div className={"flex min-w-0 flex-1 flex-col gap-1 [&>strong]:overflow-hidden [&>strong]:text-ellipsis [&>strong]:whitespace-nowrap [&>strong]:text-[10px] [&>strong]:font-semibold [&>strong]:text-ink-soft [&>strong>span]:font-mono [&>strong>span]:text-[9px] [&>strong>span]:text-quiet [&>small]:overflow-hidden [&>small]:text-ellipsis [&>small]:whitespace-nowrap [&>small]:text-[9px] [&>small]:text-faint"}><strong><span>{component.reference}</span> {component.name}</strong><small>{component.specifications.some((spec) => spec.status === "unknown") ? "Some ratings not specified" : component.description}</small></div><button className={"ml-auto border-0 bg-transparent text-faint"} aria-label={`More about ${component.name}`}><ChevronDown size={14} /></button></div>)}</div>
            <div className={"mt-2.5 flex items-start gap-[7px] text-[9px] leading-relaxed text-quiet [&>svg]:shrink-0 [&>svg]:text-faint"}><CircleHelp size={14} /><span>Part specs with unknown ratings are flagged for review.</span></div>
          </section>
        </aside>

        <section className={"flex min-w-0 flex-col gap-[14px] max-[760px]:w-full max-[760px]:gap-3 max-[760px]:order-1"}>
          <div className={"flex min-h-8 items-center justify-between gap-2.5 max-[760px]:items-start max-[760px]:flex-col"}><div className={"flex items-center gap-2"}><div className={"flex min-w-0 items-center gap-2 text-brand-icon [&>h2]:m-0 [&>h2]:text-[13px] [&>h2]:font-semibold [&>h2]:tracking-[-.01em] [&>h2]:text-ink-strong"}><Cable size={17} /><h2>Circuit workspace</h2></div><span className={"rounded-[5px] bg-brand-soft px-1.5 py-1 text-[9px] font-semibold text-brand-ink"}>v{project.revision + 1}</span></div><div className={"flex items-center gap-2 max-[760px]:mt-[-35px] max-[760px]:self-end max-[430px]:mt-[-35px]"}><button className={"inline-flex min-h-[30px] items-center justify-center gap-1.5 rounded-md border border-line-strong bg-white px-[9px] text-[10px] text-body max-[760px]:max-w-[180px] max-[760px]:overflow-hidden max-[760px]:text-[9px]"} onClick={toggleConnectionProof}><Waves size={14} />Change test connection</button><button className={"inline-grid size-[30px] min-w-[30px] place-items-center rounded-lg border border-line bg-white text-quiet hover:bg-subtle"} aria-label="Download diagram"><Download size={16} /></button><button className={"inline-grid size-[30px] min-w-[30px] place-items-center rounded-lg border border-line bg-white text-quiet hover:bg-subtle"} aria-label="Expand diagram"><ArrowUpRightFromSquare size={15} /></button></div></div>
          <div className={"flex min-h-[42px] items-center justify-between gap-2 rounded-[10px] border border-line bg-white px-2 py-[5px] max-[760px]:items-start max-[430px]:flex-col"}>
            <Tabs value={view} onValueChange={(value) => setView(value as View)} className="contents">
              <TabsList className={"inline-flex items-center gap-1"} aria-label="Circuit view">
                <TabsTrigger value="breadboard" className={"inline-flex h-[30px] items-center gap-1.5 rounded-[7px] bg-transparent px-2.5 text-[10px] text-quiet data-[active]:bg-brand-soft data-[active]:font-semibold data-[active]:text-brand"}><CircuitBoard size={15} />Breadboard <span className={"text-[9px] text-faint"}>view</span></TabsTrigger>
                <TabsTrigger value="schematic" className={"inline-flex h-[30px] items-center gap-1.5 rounded-[7px] bg-transparent px-2.5 text-[10px] text-quiet data-[active]:bg-brand-soft data-[active]:font-semibold data-[active]:text-brand"}><FlaskConical size={15} />Schematic <span className={"text-[9px] text-faint"}>view</span><span className={"ml-px rounded-[5px] bg-chip px-1 py-0.5 text-[8px] font-bold tracking-[.07em] text-quiet"}>POC</span></TabsTrigger>
              </TabsList>
            </Tabs>
            <div className={"flex items-center gap-[7px] text-[9px] text-quiet [&>span:first-child]:mr-[5px] [&>span:first-child]:inline-flex [&>span:first-child]:items-center [&>span:first-child]:gap-[5px] max-[760px]:gap-[5px] max-[760px]:[&>span:first-child]:text-[0px] max-[430px]:self-end"}><span><span className={"inline-block size-1.5 shrink-0 rounded-full bg-pass"} />Live layout</span><button className={"inline-grid size-[23px] min-w-[23px] place-items-center rounded-lg border border-line bg-white text-[13px] text-quiet hover:bg-subtle"} aria-label="Zoom in">+</button><span>100%</span><button className={"inline-grid size-[23px] min-w-[23px] place-items-center rounded-lg border border-line bg-white text-[13px] text-quiet hover:bg-subtle"} aria-label="Zoom out">−</button></div>
          </div>
          <div className={"min-h-[430px] overflow-hidden rounded-[11px] border border-line-strong bg-canvas max-[760px]:min-h-[310px]"}>{view === "breadboard" ? <BreadboardView project={project} /> : <SchematicView project={project} />}</div>
          <div className={"flex min-h-8 items-center gap-[14px] text-[9px] text-quiet max-[760px]:flex-wrap max-[760px]:gap-[9px] [&>span]:flex [&>span]:items-center [&>span]:gap-[5px] [&>.text-button]:ml-auto"}><span><span className={"inline-block h-0.5 w-[13px] rounded-sm bg-legend-power"} />Power</span><span><span className={"inline-block h-0.5 w-[13px] rounded-sm bg-legend-ground"} />Ground</span><span><span className={"inline-block h-0.5 w-[13px] rounded-sm bg-legend-signal"} />Signal</span><button className={"inline-flex items-center justify-center gap-1.5 whitespace-nowrap bg-transparent text-[10px] text-brand-ink hover:text-brand-strong ml-auto"} onClick={() => document.getElementById("wiring")?.scrollIntoView({ behavior: "smooth" })}>View wiring table <ArrowDownRight size={13} /></button></div>

          <section className={"min-w-0 rounded-xl border border-line bg-white px-4 py-[15px] shadow-panel"} id="wiring">
            <div className={"mb-3 flex items-center justify-between gap-2"}><div className={"flex min-w-0 items-center gap-2 text-brand-icon [&>h2]:m-0 [&>h2]:text-xs [&>h2]:font-semibold [&>h2]:tracking-[-.01em] [&>h2]:text-ink-strong"}><Cable size={16} /><h2>Pin-to-pin wiring</h2><span className={"min-w-[19px] rounded-[10px] bg-brand-soft px-1.5 py-[3px] text-center text-[9px] font-semibold text-brand-ink"}>{wiring.length}</span></div><button className={"inline-flex items-center justify-center gap-1.5 whitespace-nowrap bg-transparent text-[10px] text-brand-ink hover:text-brand-strong"}>Export CSV <Download size={13} /></button></div>
            <div className={"overflow-auto"}><table className={"w-full border-collapse text-left [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-line-soft [&_th]:px-2 [&_th]:py-[9px] [&_th]:text-[8px] [&_th]:font-bold [&_th]:tracking-[.07em] [&_th]:text-faint [&_td]:border-b [&_td]:border-line-soft [&_td]:px-2 [&_td]:py-2.5 [&_td]:align-top [&_td]:text-[9px] [&_td]:leading-[1.45] [&_td]:text-body [&_td:first-child]:min-w-[105px] [&_td:first-child]:font-medium [&_td:first-child]:text-ink-soft [&_td:nth-child(2)]:min-w-[105px] [&_td:nth-child(2)]:font-medium [&_td:nth-child(2)]:text-ink-soft [&_td:last-child]:min-w-[185px] [&_td:last-child]:text-quiet"}><thead><tr><th>FROM</th><th>TO</th><th>NET</th><th>CONNECTION DETAILS</th></tr></thead><tbody>{wiring.map((row) => <tr key={row.id}><td><span className={"mr-1.5 inline-block size-1.5 rounded-full"} style={{ background: row.color }} />{row.from}</td><td>{row.to}</td><td><span className={"inline-block rounded-[5px] bg-chip px-1.5 py-[3px] font-mono text-[8px] text-quiet"}>{row.net}</span></td><td>{row.details}</td></tr>)}</tbody></table></div>
          </section>

          <section className={"min-w-0 rounded-xl border border-line bg-white px-4 py-[15px] shadow-panel"} id="firmware">
            <div className={"mb-3 flex items-center justify-between gap-2"}><div className={"flex min-w-0 items-center gap-2 text-brand-icon [&>h2]:m-0 [&>h2]:text-xs [&>h2]:font-semibold [&>h2]:tracking-[-.01em] [&>h2]:text-ink-strong"}><FileCode2 size={16} /><h2>Firmware</h2><span className={"rounded-[5px] bg-chip px-1.5 py-1 text-[8px] text-quiet"}>Arduino C++</span></div><div className={"flex gap-2"}><button className={"inline-flex items-center justify-center gap-1.5 whitespace-nowrap bg-transparent text-[10px] text-brand-ink hover:text-brand-strong"} onClick={copyFirmware}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "Copied" : "Copy"}</button><button className={"inline-flex items-center justify-center gap-1.5 whitespace-nowrap bg-transparent text-[10px] text-brand-ink hover:text-brand-strong"} onClick={downloadFirmware}><Download size={13} />Download</button></div></div>
            <div className={"overflow-hidden rounded-[9px] border border-code-line bg-code"}><div className={"flex h-[31px] items-center justify-between bg-code-bar px-2.5 text-[9px] text-code-muted [&>span:first-child]:flex [&>span:first-child]:gap-1 [&_i]:size-1.5 [&_i]:rounded-full [&_i]:bg-danger [&_i:nth-child(2)]:bg-warn [&_i:nth-child(3)]:bg-pass"}><span><i /><i /><i /></span><span>{project.firmware.filename}</span><span>ESP32</span></div><pre className={"m-0 max-h-[340px] overflow-auto p-[14px] font-mono text-[10px] leading-[1.6] text-code-ink [tab-size:2]"}><code>{project.firmware.source}</code></pre></div>
            <div className={"mt-2.5 flex items-start gap-[7px] text-[9px] leading-relaxed text-quiet [&>svg]:shrink-0 [&>svg]:text-faint"}><CircleHelp size={14} /><span>Moisture calibration constants are placeholders. Measure your sensor before enabling automatic watering.</span></div>
          </section>
        </section>

        <aside className={"flex min-w-0 flex-col gap-[14px] max-[760px]:w-full max-[760px]:gap-3 max-[1180px]:col-span-full max-[1180px]:grid max-[1180px]:grid-cols-2 max-[1180px]:items-start max-[760px]:order-3 max-[760px]:flex"}>
          <section className={"min-w-0 rounded-xl border border-line bg-white p-[15px] shadow-panel max-[1180px]:row-span-2"}>
            <div className={"mb-3 flex items-center justify-between gap-2"}><div className={"flex min-w-0 items-center gap-2 text-brand-icon [&>h2]:m-0 [&>h2]:text-xs [&>h2]:font-semibold [&>h2]:tracking-[-.01em] [&>h2]:text-ink-strong"}><ShieldCheck size={17} /><h2>Engineering checks</h2></div><span className={cn("whitespace-nowrap rounded-md bg-brand-soft px-[7px] py-1 text-[9px] font-semibold text-brand-ink", failCount ? "bg-danger-soft text-danger" : "")}>{failCount ? `${failCount} issue${failCount === 1 ? "" : "s"}` : warningCount ? `${warningCount} review` : "All clear"}</span></div>
            <p className={"-mt-[3px] mb-3 text-[9px] leading-relaxed text-quiet"}>Deterministic checks from the component catalog. Passing checks do not guarantee safe or functional hardware.</p>
            <div className={"flex flex-col"}>{checks.map((check) => <div className={"flex gap-2 border-t border-line-soft py-2.5 [&_strong]:text-[9px] [&_strong]:font-semibold [&_strong]:text-ink-soft [&_p]:mt-1 [&_p]:text-[9px] [&_p]:leading-[1.5] [&_p]:text-quiet"} key={check.id}><div className={cn("grid size-[19px] shrink-0 place-items-center rounded-full bg-driver-soft text-pass-ink", check.status === "warning" || check.status === "unverified" ? "bg-warn-soft text-warn-ink" : check.status === "fail" ? "bg-danger-soft text-danger" : "")}>{check.status === "pass" ? <Check size={13} /> : check.status === "fail" ? <X size={13} /> : <CircleHelp size={13} />}</div><div><strong>{check.title}</strong><p>{check.detail}</p></div></div>)}</div>
            <div className={"flex flex-wrap gap-2.5 border-t border-line-soft pt-2.5 text-[8px] text-quiet [&>span]:flex [&>span]:items-center [&>span]:gap-[5px] [&_i]:size-1.5 [&_i]:rounded-full [&_i]:bg-pass"}><span><i />Passed</span><span><i className="bg-warn" />Review</span><span><i className="bg-faint" />Unverified</span></div>
          </section>

          <section className={"min-w-0 overflow-hidden rounded-xl border border-line bg-white p-0 shadow-panel"}>
            <div className={"flex min-h-[53px] items-center gap-[9px] border-b border-line-soft px-[13px] py-2.5 [&>div:nth-child(2)]:flex [&>div:nth-child(2)]:flex-col [&>div:nth-child(2)]:gap-1 [&>div:nth-child(2)>span]:flex [&>div:nth-child(2)>span]:items-center [&>div:nth-child(2)>span]:gap-[5px] [&>div:nth-child(2)>span]:text-[8px] [&>div:nth-child(2)>span]:text-faint [&>h2]:m-0 [&>h2]:text-xs [&>h2]:font-semibold [&>h2]:text-ink-strong"}><div className={"grid size-[30px] place-items-center rounded-[9px] bg-brand-soft text-brand-ink"}><Bot size={17} /></div><div><h2>Design assistant</h2><span><span className={"inline-block size-[5px] rounded-full bg-pass"} />Mock demo provider</span></div><button className={"inline-grid size-[30px] min-w-[30px] place-items-center rounded-lg border border-transparent bg-white text-quiet hover:bg-subtle ml-auto"} aria-label="Assistant settings"><ChevronDown size={14} /></button></div>
            <div className={"space-y-2.5 p-[13px]"}>
              {conversation.length ? conversation.map((message) => (
                <div className={cn("rounded-[9px_9px_9px_3px] border border-line-soft bg-subtle p-2.5 [&>p]:m-0 [&>p]:text-[10px] [&>p]:leading-[1.55] [&>p]:text-body [&>span]:mt-[7px] [&>span]:block [&>span]:text-[8px] [&>span]:text-faint", message.role === "user" ? "ml-[22px] rounded-[9px_9px_3px_9px] border-brand-soft bg-brand-soft [&>p]:text-brand-strong [&>span]:text-right" : "")} key={message.id}>
                  <p>{message.content}</p><span>{message.role === "user" ? "You" : "Assistant"} · {new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                </div>
              )) : <div className={"rounded-[9px_9px_9px_3px] border border-line-soft bg-subtle p-2.5 [&>p]:m-0 [&>p]:text-[10px] [&>p]:leading-[1.55] [&>p]:text-body [&>span]:mt-[7px] [&>span]:block [&>span]:text-[8px] [&>span]:text-faint"}><p>The pump is switched by a MOSFET, so the ESP32 pin controls the gate instead of carrying the pump current.</p><span>Assistant · Ready</span></div>}
              <div className={"mt-2.5 flex items-start gap-1.5 text-[9px] leading-[1.45] text-quiet [&>svg]:shrink-0 [&>svg]:text-faint"}><Sparkles size={13} /><span>Try moving the moisture input to GPIO35 or ask why a component is needed.</span></div>
            </div>
            <form className={"mx-3 rounded-[9px] border border-line-strong bg-white p-2"} onSubmit={(event) => { event.preventDefault(); reviseProject(); }}><label className="sr-only" htmlFor="revision-request">Ask for a design change</label><textarea className={"w-full min-h-12 resize-none rounded-lg border-0 bg-transparent p-[5px] text-[10px] leading-[1.5] text-ink-strong outline-none placeholder:text-faint"} id="revision-request" rows={2} placeholder="Ask for a change or explanation…" value={revision} onChange={(event) => setRevision(event.target.value)} /><div className={"flex items-center justify-between text-[8px] text-faint"}><span>Updates the model and derived outputs</span><button className={"grid size-[26px] place-items-center rounded-[7px] bg-brand text-white disabled:opacity-45"} type="submit" disabled={busy || !revision.trim()} aria-label="Send revision request">{busy ? <LoaderCircle className="animate-spin" size={15} /> : <Send size={15} />}</button></div></form>
            <div className={"mt-[11px] border-t border-line-soft px-[13px] py-[9px] text-[8px] leading-[1.4] text-faint"}>AI suggestions are drafts. Verify exact part ratings before building.</div>
          </section>

          <section className={"min-w-0 rounded-xl border border-line bg-white p-[15px] shadow-panel"}><div className={"mb-3 flex items-center justify-between gap-2"}><div className={"flex min-w-0 items-center gap-2 text-brand-icon [&>h2]:m-0 [&>h2]:text-xs [&>h2]:font-semibold [&>h2]:tracking-[-.01em] [&>h2]:text-ink-strong"}><Droplets size={16} /><h2>Build notes</h2></div><button className={"inline-flex items-center justify-center gap-1.5 whitespace-nowrap bg-transparent text-[10px] text-brand-ink hover:text-brand-strong"}>{project.buildSteps.length} steps <ChevronDown size={13} /></button></div><ol className={"m-0 flex list-none flex-col gap-[11px] p-0 [&>li]:flex [&>li]:items-start [&>li]:gap-2 [&>li>span]:grid [&>li>span]:size-[17px] [&>li>span]:shrink-0 [&>li>span]:place-items-center [&>li>span]:rounded-full [&>li>span]:bg-brand-soft [&>li>span]:text-[8px] [&>li>span]:text-brand-ink [&>li>p]:mt-px [&>li>p]:text-[9px] [&>li>p]:leading-[1.5] [&>li>p]:text-quiet"}>{project.buildSteps.slice(0, 3).map((step, index) => <li key={step}><span>{index + 1}</span><p>{step}</p></li>)}</ol><button className={"mt-[13px] flex w-full items-center justify-between border-t border-line-soft pt-2.5 text-[10px] text-brand-ink"}>Open full assembly guide <ArrowUpRight size={13} /></button></section>
          <div className={"flex items-start gap-[7px] px-1 py-[3px] text-[9px] leading-[1.5] text-faint [&>svg]:shrink-0 [&>svg]:text-quiet"}><Cpu size={14} /><span>Projects save in this browser only. No account needed.</span></div>
        </aside>
      </main>
      <footer className={"mx-auto flex max-w-[1600px] justify-between gap-2.5 px-7 pb-5 text-[9px] text-faint max-[760px]:px-[14px] max-[760px]:pb-[17px] max-[760px]:text-[8px] [&>span:first-child]:max-[430px]:max-w-[140px]"}><span>Built for people who make things.</span><span>ProtoPilot <span className="px-1">·</span> Design with care</span></footer>
      {libraryOpen && <div className={"fixed inset-0 z-50 grid place-items-center bg-scrim p-4 backdrop-blur-[3px]"} onMouseDown={(event) => { if (event.target === event.currentTarget) setLibraryOpen(false); }}>
        <section ref={libraryRef} tabIndex={-1} className={"flex max-h-[min(80vh,620px)] w-full max-w-[460px] flex-col overflow-hidden rounded-2xl border border-line-strong bg-white shadow-pop outline-none"} role="dialog" aria-modal="true" aria-labelledby="project-library-title">
          <div className={"flex items-center justify-between px-5 pb-3 pt-[18px] [&_h2]:mt-1 [&_h2]:text-[18px] [&_h2]:tracking-[-.03em] [&_h2]:text-ink"}><div><p className={"m-0 text-[9px] font-bold tracking-[.11em] text-faint"}>BROWSER SAVES</p><h2 id="project-library-title">My projects</h2></div><button type="button" className={"inline-grid size-[30px] min-w-[30px] place-items-center rounded-lg border border-line bg-white text-quiet hover:bg-subtle"} onClick={() => setLibraryOpen(false)} aria-label="Close project library"><X size={16} /></button></div>
          <p className={"m-0 px-5 pb-[14px] text-[11px] leading-[1.5] text-quiet"}>Saved on this device in IndexedDB. Projects are not synced to other devices.</p>
          <div className={"min-h-[100px] overflow-auto px-2.5 pb-3"}>{projectDrafts.length ? projectDrafts.map((draft) => <button type="button" className={"flex w-full items-center gap-3 rounded-[10px] bg-transparent px-2.5 py-3 text-left text-quiet hover:bg-chip"} key={draft.id} onClick={() => void openSavedProject(draft.id)}>
            <span className={"grid size-9 shrink-0 place-items-center rounded-[10px] bg-brand-soft text-brand-icon"}><Sprout size={17} /></span><span className={"flex min-w-0 flex-1 flex-col gap-1 [&>strong]:overflow-hidden [&>strong]:text-ellipsis [&>strong]:whitespace-nowrap [&>strong]:text-xs [&>strong]:text-ink-strong [&>small]:text-[10px] [&>small]:text-quiet"}><strong>{draft.title}</strong><small>Edited {new Date(draft.updatedAt).toLocaleString()}</small></span><ArrowUpRight size={15} />
          </button>) : <div className={"flex min-h-[180px] flex-col items-center justify-center gap-2 text-center text-quiet [&>svg]:text-faint [&>strong]:text-xs [&>strong]:text-ink-soft [&>span]:text-[10px]"}><CircuitBoard size={22} /><strong>No saved projects yet</strong><span>Generate a design and it will appear here.</span></div>}</div>
        </section>
      </div>}
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
