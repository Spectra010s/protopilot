"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Check,
  ChevronDown,
  CircleHelp,
  CircuitBoard,
  Copy,
  Database,
  Download,
  Droplets,
  FileCode2,
  FlaskConical,
  Layers3,
  LoaderCircle,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Sprout,
  Waves,
  Cable,
  Cpu,
  X,
  FileSpreadsheet,
  Zap,
} from "lucide-react";
import { BreadboardView } from "@/components/breadboard-view";
import { SchematicView } from "@/components/schematic-view";
import { deriveWiringTable, validateElectrical } from "@/lib/project/derive";
import { ProjectSchema, type Project } from "@/lib/project/schema";
import { createId } from "@/lib/id";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  addProjectMessage,
  getMostRecentProjectDraft,
  getProjectDraft,
  listProjectDrafts,
  listProjectMessages,
  saveProjectDraft,
  type ProjectConversationMessage,
  type ProjectDraftSummary,
} from "@/lib/storage/indexeddb";
import { cn } from "cn";

type View = "breadboard" | "schematic";

export default function WorkbenchPage() {
  const [project, setProject] = useState<Project | null>(null);
  const [sessionId, setSessionId] = useState(() => createId());
  const [expandedArtifact, setExpandedArtifact] = useState<NonNullable<ProjectConversationMessage["artifact"]> | null>(null);
  const [view, setView] = useState<View>("breadboard");
  const [prompt, setPrompt] = useState("");
  const [activeGeneration, setActiveGeneration] = useState<string | null>(null);
  const [chatReply, setChatReply] = useState<string | null>(null);
  const [revision, setRevision] = useState("");
  const [busy, setBusy] = useState(false);
  const [generationSeconds, setGenerationSeconds] = useState(0);
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [conversations, setConversations] = useState<Record<string, ProjectConversationMessage[]>>({});
  const [projectDrafts, setProjectDrafts] = useState<ProjectDraftSummary[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [showAllSteps, setShowAllSteps] = useState(false);

  const diagramContainerRef = useRef<HTMLDivElement | null>(null);
  const generationControllerRef = useRef<AbortController | null>(null);

  const conversation = conversations[project?.id ?? sessionId] ?? [];
  const checks = useMemo(() => (project ? validateElectrical(project) : []), [project]);
  const wiring = useMemo(() => (project ? deriveWiringTable(project) : []), [project]);
  const failCount = checks.filter((item) => item.status === "fail").length;
  const warningCount = checks.filter((item) => item.status === "warning" || item.status === "unverified").length;

  // Initial load from IndexedDB
  useEffect(() => {
    let active = true;
    void getMostRecentProjectDraft()
      .then((saved) => {
        if (!active) return;
        if (saved) {
          setProject(saved);
          setNotice(`Restored "${saved.title}"`);
        } else {
          setNotice("");
        }
        setStorageReady(true);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setNotice(error instanceof Error ? `Local save unavailable: ${error.message}` : "Local storage unavailable");
        setStorageReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Autosave to IndexedDB
  useEffect(() => {
    if (!storageReady || !project) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void saveProjectDraft(project)
        .catch((error: unknown) => {
          if (active) setNotice(error instanceof Error ? `Draft save error: ${error.message}` : "Could not save draft");
        })
        .then(() => listProjectDrafts())
        .then((drafts) => {
          if (active) setProjectDrafts(drafts);
        })
        .catch(() => undefined);
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [project, storageReady]);

  // Load project list when library dialog opens
  useEffect(() => {
    if (!libraryOpen) return;
    let active = true;
    void listProjectDrafts()
      .then((drafts) => {
        if (active) setProjectDrafts(drafts);
      })
      .catch((error: unknown) => {
        if (active) setNotice(error instanceof Error ? `Could not load projects: ${error.message}` : "Could not load saved projects");
      });
    return () => {
      active = false;
    };
  }, [libraryOpen]);

  async function openSavedProject(id: string) {
    try {
      const saved = await getProjectDraft(id);
      if (!saved) throw new Error("This saved project is unavailable.");
      setProject(saved);
      setLibraryOpen(false);
      setNotice(`Opened: ${saved.title}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not open project");
    }
  }

  // Load conversation messages for the current project
  useEffect(() => {
    if (!storageReady || !project?.id) return;
    let active = true;
    void listProjectMessages(project.id)
      .then((messages) => {
        if (active) setConversations((current) => ({ ...current, [project.id]: messages }));
      })
      .catch((error: unknown) => {
        if (active) setNotice(error instanceof Error ? `Could not load messages: ${error.message}` : "Could not load conversation");
      });
    return () => {
      active = false;
    };
  }, [project?.id, storageReady]);

  async function recordMessage(role: ProjectConversationMessage["role"], content: string, projectId: string, artifact?: ProjectConversationMessage["artifact"]) {
    try {
      const message = await addProjectMessage(projectId, role, content, artifact);
      setConversations((current) => ({ ...current, [projectId]: [...(current[projectId] ?? []), message] }));
    } catch (error) {
      const message: ProjectConversationMessage = {
        id: createId(),
        projectId,
        role,
        content,
        artifact,
        createdAt: Date.now(),
      };
      setConversations((current) => ({ ...current, [projectId]: [...(current[projectId] ?? []), message] }));
      setNotice(error instanceof Error ? `Session only: ${error.message}` : "Message not saved");
    }
  }

  async function sendMessage(message: string) {
    const text = message.trim();
    if (!text || busy) return;
    const projectId = project?.id ?? sessionId;
    const history = conversation.filter(({ content }) => content.trim()).map(({ role, content }) => ({ role, content }));
    setActiveGeneration(text);
    setChatReply(null);
    setBusy(true);
    setGenerationSeconds(0);
    setNotice("ProtoPilot is responding…");
    setPrompt("");
    setRevision("");
    await recordMessage("user", text, projectId);
    const controller = new AbortController();
    generationControllerRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort("timeout"), 180_000);
    const ticker = window.setInterval(() => setGenerationSeconds((seconds) => seconds + 1), 1000);
    let answer = "";
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, projectId, project, history }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error ?? "ProtoPilot could not respond.");
      }
      if (!response.body) throw new Error("Response stream is unavailable.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as { type: string; delta?: string; message?: string; error?: string; project?: unknown; kind?: "breadboard" | "schematic" | "code" };
          if (event.type === "text" && event.delta) {
            answer += event.delta;
            setChatReply(answer);
          } else if (event.type === "status" && event.message) {
            setNotice(event.message);
          } else if (event.type === "project" && event.project) {
            const nextProject = ProjectSchema.parse(event.project);
            setProject(nextProject);
            setNotice(`Updated: ${nextProject.title}`);
          } else if (event.type === "artifact" && event.kind && event.project) {
            const artifact = { kind: event.kind, project: ProjectSchema.parse(event.project) };
            await recordMessage("assistant", "", projectId, artifact);
          } else if (event.type === "error") {
            throw new Error(event.error ?? "ProtoPilot could not respond.");
          }
        }
        if (done) break;
      }
      if (answer.trim()) await recordMessage("assistant", answer, projectId);
      setNotice("ProtoPilot replied.");
    } catch (error) {
      const message = controller.signal.aborted ? (controller.signal.reason === "cancelled" ? "Request cancelled." : "Gemma took too long. Please retry.") : error instanceof Error ? error.message : "ProtoPilot could not respond.";
      setNotice(message);
      if (!answer.trim()) await recordMessage("assistant", message, projectId);
    } finally {
      window.clearTimeout(timeout);
      window.clearInterval(ticker);
      generationControllerRef.current = null;
      setBusy(false);
    }
  }

  async function generateIdea(customPrompt?: string) {
    await sendMessage(customPrompt ?? prompt);
  }

  async function reviseProject() {
    await sendMessage(revision);
  }

  function startNewProject() {
    setProject(null);
    setSessionId(createId());
    setActiveGeneration(null);
    setChatReply(null);
    setPrompt("");
    setRevision("");
    setNotice("");
  }

  function resetChat() {
    setSessionId(createId());
    setActiveGeneration(null);
    setChatReply(null);
    setPrompt("");
    setRevision("");
  }

  async function copyFirmware() {
    if (!project) return;
    await navigator.clipboard.writeText(project.firmware.source);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function downloadFirmware() {
    if (!project) return;
    const file = new Blob([project.firmware.source], { type: "text/plain" });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = project.firmware.filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportWiringCSV() {
    if (!project || !wiring.length) return;
    const headers = ["From", "To", "Net", "Details"];
    const rows = wiring.map((w) => [
      `"${w.from.replace(/"/g, '""')}"`,
      `"${w.to.replace(/"/g, '""')}"`,
      `"${w.net.replace(/"/g, '""')}"`,
      `"${w.details.replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-wiring.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadDiagram() {
    if (!project) return;
    const svg = diagramContainerRef.current?.querySelector("svg");
    if (!svg) {
      setNotice("Diagram SVG element not ready for download.");
      return;
    }
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${view}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice(`Downloaded ${view} diagram as SVG`);
  }

  return (
    <div className={"min-h-screen bg-canvas text-[13px] text-ink"}>
      {/* ── Top Header ── */}
      <header className={"flex h-[62px] items-center gap-[24px] border-b border-line bg-white px-7 max-[760px]:h-14 max-[760px]:gap-3 max-[760px]:px-3.5"}>
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-[9px] text-base font-semibold tracking-[-.04em] text-ink no-underline hover:opacity-85">
            <span className={"grid size-[30px] place-items-center rounded-[9px] bg-brand-soft text-brand"}><CircuitBoard size={19} /></span>
            <span>Proto<span className={"text-brand-ink"}>Pilot</span></span>
            <span className={"rounded-[5px] bg-chip px-1.5 py-[3px] text-[9px] font-bold tracking-[.07em] text-quiet"}>WORKBENCH</span>
          </Link>
        </div>

        <nav className="flex h-full items-center gap-[20px] max-[760px]:hidden">
          <button
            type="button"
            onClick={() => setLibraryOpen(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-body hover:text-brand bg-transparent border-0 cursor-pointer p-0"
          >
            <Database size={14} className="text-brand" />
            <span>My Projects</span>
            {projectDrafts.length > 0 && (
              <span className="rounded-full bg-chip px-1.5 py-0.5 text-[9px] text-quiet font-bold">{projectDrafts.length}</span>
            )}
          </button>
          {project && (
            <button
              type="button"
              onClick={startNewProject}
              className="flex items-center gap-1 text-xs text-quiet hover:text-ink bg-transparent border-0 cursor-pointer p-0"
            >
              <Plus size={14} /> New Canvas
            </button>
          )}
        </nav>

        <button
          type="button"
          className="ml-auto hidden size-9 place-items-center rounded-lg border-0 bg-transparent text-brand max-[760px]:grid"
          onClick={() => setLibraryOpen(true)}
          aria-label="My Projects"
          title="My Projects"
        >
          <Database size={20} />
        </button>
      </header>


      {/* ── Main Workspace ── */}
      {!project ? (
        /* Empty / New Project Onboarding Canvas */
        <main className="mx-auto flex w-full max-w-[960px] flex-col items-center px-6 py-14 text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand mb-4">
            <CircuitBoard size={30} />
          </div>
          <h1 className="text-[26px] font-bold text-ink-strong tracking-tight">Create a New Hardware Design</h1>
          <p className="mt-2 max-w-[500px] text-[13px] text-body leading-relaxed">
            Enter what you want to build. ProtoPilot will choose microcontroller pins, build stages, generate wiring netlists, Arduino code, and verify safety checks.
          </p>

          {!activeGeneration && !busy && conversation.length === 0 ? (
            /* Initial Prompt Form before chat starts */
            <div className="mt-8 w-full max-w-[620px] rounded-2xl border border-line-strong bg-white p-5 shadow-panel text-left">
              <label className="text-xs font-semibold text-ink-strong flex items-center gap-2 mb-2" htmlFor="initial-prompt">
                <Sparkles size={15} className="text-brand" />
                What circuit are you designing?
              </label>
              <textarea
                id="initial-prompt"
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Build an ESP32-based plant watering system with a capacitive soil moisture sensor, MOSFET low-side switch for a 5V pump, and an emergency manual push button."
                className="w-full resize-none rounded-xl border border-line-strong bg-inset p-3 text-[12px] text-ink outline-none focus:border-brand focus:shadow-focus"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-[10px] text-quiet">Gemma 4 checks electrical compatibility</span>
                <button
                  type="button"
                  onClick={() => generateIdea()}
                  disabled={busy || !prompt.trim()}
                  className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-xl bg-brand px-4 text-[12px] font-semibold text-white shadow-button hover:bg-brand-strong disabled:opacity-50 cursor-pointer"
                >
                  {busy ? <LoaderCircle className="animate-spin" size={16} /> : <Sparkles size={15} />}
                  {busy ? "Responding…" : "Send to ProtoPilot"}
                </button>
              </div>
            </div>
          ) : (
            /* Dedicated Normal Chat UI once chat has started */
            <div className="mt-8 w-full max-w-[640px] rounded-2xl border border-line-strong bg-white shadow-panel overflow-hidden text-left flex flex-col" aria-live="polite">
              {/* Chat Header */}
              <div className="flex items-center justify-between border-b border-line px-5 py-3.5 bg-subtle/50">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-7 place-items-center rounded-lg bg-brand-soft text-brand">
                    <Bot size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-ink-strong">Hardware Design Assistant</h3>
                    <p className="text-[10px] text-faint flex items-center gap-1.5">
                      <span className={cn("inline-block size-1.5 rounded-full", busy ? "bg-amber-500 animate-pulse" : "bg-pass")} />
                      {busy ? `Gemma 4 is responding… (${generationSeconds}s)` : "Gemma 4 · Online"}
                    </p>
                  </div>
                </div>
                {!busy && (
                  <button
                    type="button"
                    onClick={resetChat}
                    className="text-[11px] font-medium text-quiet hover:text-ink cursor-pointer"
                  >
                    Start Over
                  </button>
                )}
              </div>

              {/* Chat Messages Body */}
              <div className="p-5 space-y-4 max-h-[440px] overflow-y-auto">
                {conversation.length > 0 ? (
                  conversation.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn("flex gap-2.5", msg.role === "user" ? "justify-end" : "justify-start")}
                    >
                      {msg.role !== "user" && (
                        <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand mt-0.5">
                          <Bot size={15} />
                        </div>
                      )}
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-2.5 text-xs leading-relaxed max-w-[85%]",
                          msg.role === "user"
                            ? "rounded-tr-sm bg-brand text-white shadow-sm"
                            : "rounded-tl-sm border border-line-soft bg-subtle text-ink-strong shadow-xs"
                        )}
                      >
                        {msg.content && (msg.role === "assistant" ? <AssistantMarkdown>{msg.content}</AssistantMarkdown> : <p className="whitespace-pre-line">{msg.content}</p>)}
                        {msg.artifact && <ChatArtifact artifact={msg.artifact} onExpand={() => setExpandedArtifact(msg.artifact ?? null)} />}
                        <span className={cn("block mt-1 text-[9px]", msg.role === "user" ? "text-white/70 text-right" : "text-faint")}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  ))
                ) : activeGeneration ? (
                  <div className="flex justify-end gap-2.5">
                    <div className="rounded-2xl rounded-tr-sm bg-brand px-4 py-2.5 text-xs text-white max-w-[85%] shadow-sm leading-relaxed">
                      <p className="whitespace-pre-line">{activeGeneration}</p>
                      <span className="block mt-1 text-[9px] text-white/70 text-right">Just now</span>
                    </div>
                  </div>
                ) : null}

                {/* Assistant Working Bubble */}
                {busy && (
                  <div className="flex items-start gap-2.5">
                    <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand mt-0.5">
                      <Bot size={15} />
                    </div>
                    <div className="rounded-2xl rounded-tl-sm border border-line-soft bg-subtle px-4 py-3 text-xs text-ink-strong max-w-[85%] shadow-xs space-y-2">
                      <div className="flex items-center gap-2 font-medium text-brand">
                        <LoaderCircle className="animate-spin" size={14} />
                        <span>Gemma 4 is responding… ({generationSeconds}s)</span>
                      </div>
                      {notice && <p className="text-[11px] text-body">{notice}</p>}
                      <button
                        type="button"
                        onClick={() => generationControllerRef.current?.abort("cancelled")}
                        className="text-[11px] text-faint hover:text-red-500 underline cursor-pointer"
                      >
                        Cancel request
                      </button>
                    </div>
                  </div>
                )}

                {chatReply && !conversation.some((m) => m.content === chatReply) && (
                  <div className="flex items-start gap-2.5">
                    <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand mt-0.5">
                      <Bot size={15} />
                    </div>
                    <div className="rounded-2xl rounded-tl-sm border border-line-soft bg-subtle px-4 py-3 text-xs text-ink-strong max-w-[85%] shadow-xs">
                      <AssistantMarkdown>{chatReply}</AssistantMarkdown>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input Footer */}
              <div className="border-t border-line p-3 bg-white">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (prompt.trim()) void generateIdea(prompt);
                  }}
                  className="flex gap-2"
                >
                  <label className="sr-only" htmlFor="chat-reply-input">
                    Your message
                  </label>
                  <textarea
                    id="chat-reply-input"
                    rows={2}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    disabled={busy}
                    placeholder="Ask ProtoPilot anything about your design…"
                    className="w-full resize-none rounded-xl border border-line-strong bg-inset p-3 text-xs text-ink outline-none focus:border-brand focus:shadow-focus"
                  />
                  <button
                    type="submit"
                    disabled={busy || !prompt.trim()}
                    className="self-end inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand px-4 text-xs font-semibold text-white shadow-button hover:bg-brand-strong disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {busy ? <LoaderCircle className="animate-spin" size={14} /> : <Send size={13} />}
                    <span>Send</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* 4 Separate Standalone Starter Cards Underneath (ONLY shown before chat starts) */}
          {!activeGeneration && !busy && conversation.length === 0 && (
            <div className="mt-8 w-full max-w-[620px]">
              <p className="text-[11px] font-semibold tracking-wider text-faint uppercase mb-3 text-left">
                Or pick an idea to start:
              </p>
              <div className="grid grid-cols-2 gap-3 max-[600px]:grid-cols-1">
                {[
                  {
                    title: "Smart Plant Watering",
                    prompt: "I want to build a smart plant watering system with a capacitive soil moisture sensor, ESP32, low-side MOSFET switch for a 5V pump, flyback diode, and a manual watering button.",
                    icon: <Sprout size={16} className="text-brand shrink-0" />,
                  },
                  {
                    title: "Weather & Environment",
                    prompt: "Can you design a weather station with an ESP32, DHT22 temperature and humidity sensor, and a status LED that turns on when humidity exceeds 70%?",
                    icon: <Activity size={16} className="text-brand shrink-0" />,
                  },
                  {
                    title: "Obstacle Avoidance Rover",
                    prompt: "I want to build an obstacle avoidance system using an HC-SR04 ultrasonic sensor, buzzer alert, and an ESP32 microcontroller with a motor driver stage.",
                    icon: <Bot size={16} className="text-brand shrink-0" />,
                  },
                  {
                    title: "Motion-Activated Nightlight",
                    prompt: "Can you build a PIR motion sensor nightlight with an ESP32, logic-level transistor switch for high-power LED strips, and adjustable cooldown in firmware?",
                    icon: <Zap size={16} className="text-brand shrink-0" />,
                  },
                ].map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setPrompt(item.prompt);
                      generateIdea(item.prompt);
                    }}
                    className="flex flex-col text-left rounded-xl border border-line bg-white p-4 shadow-panel hover:border-brand hover:shadow-focus transition cursor-pointer group disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold text-ink-strong group-hover:text-brand">
                      {item.icon}
                      <span>{item.title}</span>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-body line-clamp-2">
                      &ldquo;{item.prompt}&rdquo;
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </main>
      ) : (
        /* Full Active Project Workbench */
        <main id="workspace" className={"mx-auto grid w-full max-w-[1600px] grid-cols-[minmax(255px,292px)_minmax(400px,1fr)_minmax(270px,310px)] items-start gap-[18px] px-[26px] py-[22px] pb-8 max-[1180px]:grid-cols-[minmax(240px,280px)_minmax(380px,1fr)] max-[760px]:flex max-[760px]:flex-col max-[760px]:gap-[13px] max-[760px]:px-3 max-[760px]:py-4 max-[760px]:pb-[22px]"}>
          {/* ── Left Column: Project Overview & BOM ── */}
          <aside className={"flex min-w-0 flex-col gap-[14px] max-[760px]:w-full max-[760px]:gap-3 max-[760px]:order-2"}>
            <div className={"flex items-center justify-between text-[10px] text-faint"}>
              <div className="flex items-center gap-1.5">
                <button className={"p-0 text-inherit hover:text-brand hover:underline cursor-pointer border-0 bg-transparent"} type="button" onClick={() => setLibraryOpen(true)}>
                  My projects
                </button>
                <span>/</span>
                <strong className={"font-medium text-body truncate max-w-[140px]"}>{project.title}</strong>
              </div>
              <button
                type="button"
                onClick={startNewProject}
                className="text-brand hover:underline bg-transparent border-0 p-0 text-[10px] flex items-center gap-1 cursor-pointer"
              >
                <Plus size={11} /> New
              </button>
            </div>

            <div className={"flex items-center gap-2.5"}>
              <div className={"grid size-[38px] shrink-0 place-items-center rounded-[11px] border border-line bg-brand-soft text-brand-ink"}>
                <Sprout size={21} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={"m-0 text-[9px] font-bold tracking-[.11em] text-faint"}>CIRCUIT PROJECT</p>
                <h1 className={"mt-0.5 text-[17px] leading-tight tracking-[-.03em] truncate"}>{project.title}</h1>
              </div>
            </div>

            <p className={"text-[11px] leading-relaxed text-body"}>{project.summary}</p>

            {/* Prompt input card for new design or replacement */}
            <section className={"min-w-0 rounded-xl border border-line bg-white p-[15px] shadow-panel"}>
              <div className={"mb-3 flex items-center justify-between gap-2"}>
                <div className={"flex min-w-0 items-center gap-2 text-brand-icon [&>h2]:m-0 [&>h2]:text-xs [&>h2]:font-semibold [&>h2]:tracking-[-.01em] [&>h2]:text-ink-strong"}>
                  <Sparkles size={16} />
                  <h2>Redesign from prompt</h2>
                </div>
                <span className={"text-[9px] font-bold tracking-[.08em] text-quiet"}>AI</span>
              </div>
              <label className="sr-only" htmlFor="project-prompt">Describe a hardware project</label>
              <textarea
                className={"w-full min-h-[75px] resize-y rounded-lg border border-line-strong bg-inset p-2.5 text-[11px] leading-[1.5] text-ink-strong outline-none placeholder:text-faint focus:border-brand focus:shadow-focus"}
                id="project-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Replace with a new circuit idea..."
                rows={3}
              />
              <div className={"mt-[9px] flex items-center justify-end"}>
                <button
                  className={"inline-flex min-h-[30px] items-center justify-center gap-[7px] rounded-lg bg-brand px-3 text-[11px] font-semibold text-white shadow-button hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"}
                  onClick={() => generateIdea()}
                  disabled={busy || !prompt.trim()}
                >
                  {busy ? <LoaderCircle className="animate-spin" size={14} /> : <Sparkles size={13} />} {busy ? "Generating…" : "Generate"}
                </button>
              </div>
            </section>

            {/* Overview / Operating Principle */}
            <section className={"min-w-0 rounded-xl border border-line bg-white p-[15px] shadow-panel"}>
              <div className={"mb-3 flex items-center justify-between gap-2"}>
                <div className={"flex min-w-0 items-center gap-2 text-brand-icon [&>h2]:m-0 [&>h2]:text-xs [&>h2]:font-semibold [&>h2]:tracking-[-.01em] [&>h2]:text-ink-strong"}>
                  <Activity size={16} />
                  <h2>Operating principle</h2>
                </div>
              </div>
              <p className={"m-0 text-[10px] leading-relaxed text-body"}>{project.operatingPrinciple}</p>
              <div className={"mt-[14px] grid grid-cols-2 gap-[9px] border-t border-line-soft pt-3 [&>div]:flex [&>div]:min-w-0 [&>div]:flex-col [&>div]:gap-[5px] [&_span]:text-[8px] [&_span]:font-bold [&_span]:tracking-[.08em] [&_span]:text-faint [&_strong]:overflow-hidden [&_strong]:text-ellipsis [&_strong]:whitespace-nowrap [&_strong]:text-[10px] [&_strong]:font-semibold [&_strong]:text-ink-soft"}>
                <div>
                  <span>CONTROLLER</span>
                  <strong>{project.constraints.controller ?? "Generic MCU"}</strong>
                </div>
                <div>
                  <span>CONNECTIONS</span>
                  <strong>{project.connections.length} wires</strong>
                </div>
              </div>
            </section>

            {/* BOM / Components List */}
            <section className={"min-w-0 rounded-xl border border-line bg-white p-[15px] shadow-panel"} id="components">
              <div className={"mb-3 flex items-center justify-between gap-2"}>
                <div className={"flex min-w-0 items-center gap-2 text-brand-icon [&>h2]:m-0 [&>h2]:text-xs [&>h2]:font-semibold [&>h2]:tracking-[-.01em] [&>h2]:text-ink-strong"}>
                  <Layers3 size={16} />
                  <h2>Components BOM</h2>
                  <span className={"min-w-[19px] rounded-[10px] bg-brand-soft px-1.5 py-[3px] text-center text-[9px] font-semibold text-brand-ink"}>
                    {project.components.length}
                  </span>
                </div>
              </div>
              <div className={"flex flex-col"}>
                {project.components.map((component) => (
                  <div className={"flex min-w-0 items-center gap-[9px] border-t border-line-soft py-[9px]"} key={component.id}>
                    <div className={cn(
                      "grid size-[29px] shrink-0 place-items-center rounded-lg bg-sensor-soft text-sensor",
                      component.category === "controller" ? "bg-controller-soft text-controller" :
                      component.category === "power" ? "bg-power-soft text-power" :
                      component.category === "driver" ? "bg-driver-soft text-driver" : ""
                    )}>
                      <PartIcon category={component.category} />
                    </div>
                    <div className={"flex min-w-0 flex-1 flex-col gap-1 [&>strong]:overflow-hidden [&>strong]:text-ellipsis [&>strong]:whitespace-nowrap [&>strong]:text-[10px] [&>strong]:font-semibold [&>strong]:text-ink-soft [&>strong>span]:font-mono [&>strong>span]:text-[9px] [&>strong>span]:text-quiet [&>small]:overflow-hidden [&>small]:text-ellipsis [&>small]:whitespace-nowrap [&>small]:text-[9px] [&>small]:text-faint"}>
                      <strong><span>{component.reference}</span> {component.name}</strong>
                      <small>{component.specifications.some((spec) => spec.status === "unknown") ? "Ratings to confirm on datasheet" : component.description}</small>
                    </div>
                  </div>
                ))}
              </div>
              <div className={"mt-2.5 flex items-start gap-[7px] text-[9px] leading-relaxed text-quiet [&>svg]:shrink-0 [&>svg]:text-faint"}>
                <CircleHelp size={14} />
                <span>Specs with unknown ratings are flagged for verification.</span>
              </div>
            </section>
          </aside>

          {/* ── Middle Column: Circuit Canvas, Wiring Table, Firmware ── */}
          <section className={"flex min-w-0 flex-col gap-[14px] max-[760px]:w-full max-[760px]:gap-3 max-[760px]:order-1"}>
            <div className={"flex min-h-8 items-center justify-between gap-2.5 max-[760px]:items-start max-[760px]:flex-col"}>
              <div className={"flex items-center gap-2"}>
                <div className={"flex min-w-0 items-center gap-2 text-brand-icon [&>h2]:m-0 [&>h2]:text-[13px] [&>h2]:font-semibold [&>h2]:tracking-[-.01em] [&>h2]:text-ink-strong"}>
                  <Cable size={17} />
                  <h2>Circuit canvas</h2>
                </div>
                <span className={"rounded-[5px] bg-brand-soft px-1.5 py-1 text-[9px] font-semibold text-brand-ink"}>
                  rev {project.revision + 1}
                </span>
              </div>
              <div className={"flex items-center gap-2"}>
                <button
                  type="button"
                  className={"inline-flex min-h-[30px] items-center justify-center gap-1.5 rounded-md border border-line-strong bg-white px-[9px] text-[10px] text-body hover:bg-subtle cursor-pointer"}
                  onClick={downloadDiagram}
                  title="Download current diagram as SVG vector file"
                >
                  <Download size={14} /> Download SVG
                </button>
              </div>
            </div>

            {/* View Switcher Tabs */}
            <div className={"flex min-h-[42px] items-center justify-between gap-2 rounded-[10px] border border-line bg-white px-2 py-[5px] max-[760px]:items-start max-[430px]:flex-col"}>
              <Tabs value={view} onValueChange={(value) => setView(value as View)} className="contents">
                <TabsList className={"inline-flex items-center gap-1"} aria-label="Circuit view">
                  <TabsTrigger value="breadboard" className={"inline-flex h-[30px] items-center gap-1.5 rounded-[7px] bg-transparent px-2.5 text-[10px] text-quiet data-[active]:bg-brand-soft data-[active]:font-semibold data-[active]:text-brand cursor-pointer"}>
                    <CircuitBoard size={15} /> Breadboard <span className={"text-[9px] text-faint"}>view</span>
                  </TabsTrigger>
                  <TabsTrigger value="schematic" className={"inline-flex h-[30px] items-center gap-1.5 rounded-[7px] bg-transparent px-2.5 text-[10px] text-quiet data-[active]:bg-brand-soft data-[active]:font-semibold data-[active]:text-brand cursor-pointer"}>
                    <FlaskConical size={15} /> Schematic <span className={"text-[9px] text-faint"}>view</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <div className={"flex items-center gap-[7px] text-[9px] text-quiet"}>
                <span className="flex items-center gap-1 text-pass font-medium">
                  <span className={"inline-block size-1.5 shrink-0 rounded-full bg-pass"} />
                  Live Layout
                </span>
              </div>
            </div>

            {/* Circuit SVG Container */}
            <div
              ref={diagramContainerRef}
              id="circuit-diagram-container"
              className={"min-h-[430px] overflow-hidden rounded-[11px] border border-line-strong bg-canvas max-[760px]:min-h-[310px]"}
            >
              {view === "breadboard" ? <BreadboardView project={project} /> : <SchematicView project={project} />}
            </div>

            {/* Legend */}
            <div className={"flex min-h-8 items-center gap-[14px] text-[9px] text-quiet max-[760px]:flex-wrap max-[760px]:gap-[9px] [&>span]:flex [&>span]:items-center [&>span]:gap-[5px]"}>
              <span><span className={"inline-block h-0.5 w-[13px] rounded-sm bg-legend-power"} />Power (+V)</span>
              <span><span className={"inline-block h-0.5 w-[13px] rounded-sm bg-legend-ground"} />Ground (GND)</span>
              <span><span className={"inline-block h-0.5 w-[13px] rounded-sm bg-legend-signal"} />Signals / GPIO</span>
              <button
                type="button"
                className={"inline-flex items-center justify-center gap-1.5 whitespace-nowrap bg-transparent text-[10px] text-brand-ink hover:text-brand-strong ml-auto border-0 cursor-pointer p-0"}
                onClick={() => document.getElementById("wiring")?.scrollIntoView({ behavior: "smooth" })}
              >
                View wiring table <ArrowDownRight size={13} />
              </button>
            </div>

            {/* Wiring Table */}
            <section className={"min-w-0 rounded-xl border border-line bg-white px-4 py-[15px] shadow-panel"} id="wiring">
              <div className={"mb-3 flex items-center justify-between gap-2"}>
                <div className={"flex min-w-0 items-center gap-2 text-brand-icon [&>h2]:m-0 [&>h2]:text-xs [&>h2]:font-semibold [&>h2]:tracking-[-.01em] [&>h2]:text-ink-strong"}>
                  <Cable size={16} />
                  <h2>Pin-to-pin wiring netlist</h2>
                  <span className={"min-w-[19px] rounded-[10px] bg-brand-soft px-1.5 py-[3px] text-center text-[9px] font-semibold text-brand-ink"}>
                    {wiring.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={exportWiringCSV}
                  className={"inline-flex items-center justify-center gap-1.5 whitespace-nowrap bg-transparent text-[10px] text-brand-ink hover:text-brand-strong border-0 cursor-pointer p-0"}
                  title="Export wiring rows to CSV"
                >
                  <FileSpreadsheet size={13} /> Export CSV
                </button>
              </div>
              <div className={"overflow-auto"}>
                <table className={"w-full border-collapse text-left [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-line-soft [&_th]:px-2 [&_th]:py-[9px] [&_th]:text-[8px] [&_th]:font-bold [&_th]:tracking-[.07em] [&_th]:text-faint [&_td]:border-b [&_td]:border-line-soft [&_td]:px-2 [&_td]:py-2.5 [&_td]:align-top [&_td]:text-[9px] [&_td]:leading-[1.45] [&_td]:text-body [&_td:first-child]:min-w-[105px] [&_td:first-child]:font-medium [&_td:first-child]:text-ink-soft [&_td:nth-child(2)]:min-w-[105px] [&_td:nth-child(2)]:font-medium [&_td:nth-child(2)]:text-ink-soft [&_td:last-child]:min-w-[185px] [&_td:last-child]:text-quiet"}>
                  <thead>
                    <tr>
                      <th>FROM</th>
                      <th>TO</th>
                      <th>NET</th>
                      <th>CONNECTION DETAILS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wiring.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <span className={"mr-1.5 inline-block size-1.5 rounded-full"} style={{ background: row.color }} />
                          {row.from}
                        </td>
                        <td>{row.to}</td>
                        <td>
                          <span className={"inline-block rounded-[5px] bg-chip px-1.5 py-[3px] font-mono text-[8px] text-quiet"}>
                            {row.net}
                          </span>
                        </td>
                        <td>{row.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Firmware Code Block */}
            <section className={"min-w-0 rounded-xl border border-line bg-white px-4 py-[15px] shadow-panel"} id="firmware">
              <div className={"mb-3 flex items-center justify-between gap-2"}>
                <div className={"flex min-w-0 items-center gap-2 text-brand-icon [&>h2]:m-0 [&>h2]:text-xs [&>h2]:font-semibold [&>h2]:tracking-[-.01em] [&>h2]:text-ink-strong"}>
                  <FileCode2 size={16} />
                  <h2>Firmware source</h2>
                  <span className={"rounded-[5px] bg-chip px-1.5 py-1 text-[8px] text-quiet"}>Arduino C++</span>
                </div>
                <div className={"flex gap-2"}>
                  <button
                    type="button"
                    className={"inline-flex items-center justify-center gap-1.5 whitespace-nowrap bg-transparent text-[10px] text-brand-ink hover:text-brand-strong border-0 cursor-pointer p-0"}
                    onClick={copyFirmware}
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    type="button"
                    className={"inline-flex items-center justify-center gap-1.5 whitespace-nowrap bg-transparent text-[10px] text-brand-ink hover:text-brand-strong border-0 cursor-pointer p-0"}
                    onClick={downloadFirmware}
                  >
                    <Download size={13} /> Download
                  </button>
                </div>
              </div>
              <div className={"overflow-hidden rounded-[9px] border border-code-line bg-code"}>
                <div className={"flex h-[31px] items-center justify-between bg-code-bar px-2.5 text-[9px] text-code-muted [&>span:first-child]:flex [&>span:first-child]:gap-1 [&_i]:size-1.5 [&_i]:rounded-full [&_i]:bg-danger [&_i:nth-child(2)]:bg-warn [&_i:nth-child(3)]:bg-pass"}>
                  <span><i /><i /><i /></span>
                  <span>{project.firmware.filename}</span>
                  <span>{project.firmware.board || "ESP32"}</span>
                </div>
                <pre className={"m-0 max-h-[340px] overflow-auto p-[14px] font-mono text-[10px] leading-[1.6] text-code-ink [tab-size:2]"}>
                  <code>{project.firmware.source}</code>
                </pre>
              </div>
            </section>
          </section>

          {/* ── Right Column: Checks, Assistant, Build Steps ── */}
          <aside className={"flex min-w-0 flex-col gap-[14px] max-[760px]:w-full max-[760px]:gap-3 max-[1180px]:col-span-full max-[1180px]:grid max-[1180px]:grid-cols-2 max-[1180px]:items-start max-[760px]:order-3 max-[760px]:flex"}>
            {/* Deterministic Electrical Checks */}
            <section className={"min-w-0 rounded-xl border border-line bg-white p-[15px] shadow-panel max-[1180px]:row-span-2"}>
              <div className={"mb-3 flex items-center justify-between gap-2"}>
                <div className={"flex min-w-0 items-center gap-2 text-brand-icon [&>h2]:m-0 [&>h2]:text-xs [&>h2]:font-semibold [&>h2]:tracking-[-.01em] [&>h2]:text-ink-strong"}>
                  <ShieldCheck size={17} />
                  <h2>Engineering checks</h2>
                </div>
                <span className={cn(
                  "whitespace-nowrap rounded-md bg-brand-soft px-[7px] py-1 text-[9px] font-semibold text-brand-ink",
                  failCount ? "bg-danger-soft text-danger" : ""
                )}>
                  {failCount ? `${failCount} issue${failCount === 1 ? "" : "s"}` : warningCount ? `${warningCount} review` : "All clear"}
                </span>
              </div>
              <p className={"-mt-[3px] mb-3 text-[9px] leading-relaxed text-quiet"}>
                Audited against catalog pin boundaries, GPIO voltage ratings, and flyback protection.
              </p>
              <div className={"flex flex-col"}>
                {checks.map((check) => (
                  <div className={"flex gap-2 border-t border-line-soft py-2.5 [&_strong]:text-[9px] [&_strong]:font-semibold [&_strong]:text-ink-soft [&_p]:mt-1 [&_p]:text-[9px] [&_p]:leading-[1.5] [&_p]:text-quiet"} key={check.id}>
                    <div className={cn(
                      "grid size-[19px] shrink-0 place-items-center rounded-full bg-driver-soft text-pass-ink",
                      check.status === "warning" || check.status === "unverified" ? "bg-warn-soft text-warn-ink" :
                      check.status === "fail" ? "bg-danger-soft text-danger" : ""
                    )}>
                      {check.status === "pass" ? <Check size={13} /> : check.status === "fail" ? <X size={13} /> : <CircleHelp size={13} />}
                    </div>
                    <div>
                      <strong>{check.title}</strong>
                      <p>{check.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className={"flex flex-wrap gap-2.5 border-t border-line-soft pt-2.5 text-[8px] text-quiet [&>span]:flex [&>span]:items-center [&>span]:gap-[5px] [&_i]:size-1.5 [&_i]:rounded-full [&_i]:bg-pass"}>
                <span><i />Passed</span>
                <span><i className="bg-warn" />Review</span>
                <span><i className="bg-faint" />Unverified</span>
              </div>
            </section>

            {/* Design Assistant / Chat */}
            <section className={"min-w-0 overflow-hidden rounded-xl border border-line bg-white p-0 shadow-panel"}>
              <div className={"flex min-h-[53px] items-center gap-[9px] border-b border-line-soft px-[13px] py-2.5 [&>div:nth-child(2)]:flex [&>div:nth-child(2)]:flex-col [&>div:nth-child(2)]:gap-1 [&>div:nth-child(2)>span]:flex [&>div:nth-child(2)>span]:items-center [&>div:nth-child(2)>span]:gap-[5px] [&>div:nth-child(2)>span]:text-[8px] [&>div:nth-child(2)>span]:text-faint [&>h2]:m-0 [&>h2]:text-xs [&>h2]:font-semibold [&>h2]:text-ink-strong"}>
                <div className={"grid size-[30px] place-items-center rounded-[9px] bg-brand-soft text-brand-ink"}>
                  <Bot size={17} />
                </div>
                <div>
                  <h2>Hardware assistant</h2>
                  <span><span className={"inline-block size-[5px] rounded-full bg-pass"} />Gemma 4 · Online</span>
                </div>
              </div>
              <div className={"space-y-2.5 p-[13px] max-h-[320px] overflow-y-auto"}>
                {conversation.length ? (
                  conversation.map((message) => (
                    <div
                      className={cn(
                        "rounded-[9px_9px_9px_3px] border border-line-soft bg-subtle p-2.5 [&>p]:m-0 [&>p]:whitespace-pre-line [&>p]:text-[10px] [&>p]:leading-[1.55] [&>p]:text-body [&>span]:mt-[7px] [&>span]:block [&>span]:text-[8px] [&>span]:text-faint",
                        message.role === "user" ? "ml-[22px] rounded-[9px_9px_3px_9px] border-brand-soft bg-brand-soft [&>p]:text-brand-strong [&>span]:text-right" : ""
                      )}
                      key={message.id}
                    >
                      {message.content && (message.role === "assistant" ? <AssistantMarkdown>{message.content}</AssistantMarkdown> : <p>{message.content}</p>)}
                      {message.artifact && <ChatArtifact artifact={message.artifact} onExpand={() => setExpandedArtifact(message.artifact ?? null)} />}
                      <span>{message.role === "user" ? "You" : "Assistant"} · {new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                    </div>
                  ))
                ) : (
                  <div className={"rounded-[9px_9px_9px_3px] border border-line-soft bg-subtle p-2.5 [&>p]:m-0 [&>p]:text-[10px] [&>p]:leading-[1.55] [&>p]:text-body [&>span]:mt-[7px] [&>span]:block [&>span]:text-[8px] [&>span]:text-faint"}>
                    <p>Assistant ready for <strong>{project.title}</strong>. Ask to swap pins, add components, or modify thresholds.</p>
                    <span>Assistant · Ready</span>
                  </div>
                )}
                <div className={"mt-2.5 flex items-start gap-1.5 text-[9px] leading-[1.45] text-quiet [&>svg]:shrink-0 [&>svg]:text-faint"}>
                  <Sparkles size={13} />
                  <span>Try: &ldquo;Move input pin to GPIO35&rdquo; or &ldquo;Why do we need a diode?&rdquo;</span>
                </div>
              </div>
              <form
                className={"mx-3 rounded-[9px] border border-line-strong bg-white p-2"}
                onSubmit={(event) => {
                  event.preventDefault();
                  reviseProject();
                }}
              >
                <label className="sr-only" htmlFor="revision-request">
                  Ask ProtoPilot
                </label>
                <textarea
                  className={"w-full min-h-12 resize-none rounded-lg border-0 bg-transparent p-[5px] text-[10px] leading-[1.5] text-ink-strong outline-none placeholder:text-faint"}
                  id="revision-request"
                  rows={2}
                  placeholder="Ask for a change, a view, or an explanation…"
                  value={revision}
                  onChange={(event) => setRevision(event.target.value)}
                />
                <div className={"flex items-center justify-between text-[8px] text-faint"}>
                  <span>Updates circuit model & derived firmware</span>
                  <button
                    className={"grid size-[26px] place-items-center rounded-[7px] bg-brand text-white disabled:opacity-45 border-0 cursor-pointer"}
                    type="submit"
                    disabled={busy || !revision.trim()}
                    aria-label="Send request"
                  >
                    {busy ? <LoaderCircle className="animate-spin" size={15} /> : <Send size={15} />}
                  </button>
                </div>
              </form>
              <div className={"mt-[11px] border-t border-line-soft px-[13px] py-[9px] text-[8px] leading-[1.4] text-faint"}>
                AI circuit drafts should be checked against physical datasheets before soldering.
              </div>
            </section>

            {/* Assembly Notes */}
            <section className={"min-w-0 rounded-xl border border-line bg-white p-[15px] shadow-panel"}>
              <div className={"mb-3 flex items-center justify-between gap-2"}>
                <div className={"flex min-w-0 items-center gap-2 text-brand-icon [&>h2]:m-0 [&>h2]:text-xs [&>h2]:font-semibold [&>h2]:tracking-[-.01em] [&>h2]:text-ink-strong"}>
                  <Droplets size={16} />
                  <h2>Assembly guide</h2>
                </div>
                <span className="text-[10px] text-quiet font-medium">{project.buildSteps.length} steps</span>
              </div>
              <ol className={"m-0 flex list-none flex-col gap-[11px] p-0 [&>li]:flex [&>li]:items-start [&>li]:gap-2 [&>li>span]:grid [&>li>span]:size-[17px] [&>li>span]:shrink-0 [&>li>span]:place-items-center [&>li>span]:rounded-full [&>li>span]:bg-brand-soft [&>li>span]:text-[8px] [&>li>span]:text-brand-ink [&>li>p]:mt-px [&>li>p]:text-[9px] [&>li>p]:leading-[1.5] [&>li>p]:text-quiet"}>
                {(showAllSteps ? project.buildSteps : project.buildSteps.slice(0, 3)).map((step, index) => (
                  <li key={step}>
                    <span>{index + 1}</span>
                    <p>{step}</p>
                  </li>
                ))}
              </ol>
              {project.buildSteps.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllSteps(!showAllSteps)}
                  className={"mt-[13px] flex w-full items-center justify-between border-t border-line-soft pt-2.5 text-[10px] text-brand-ink bg-transparent border-0 cursor-pointer"}
                >
                  <span>{showAllSteps ? "Collapse guide" : `View all ${project.buildSteps.length} steps`}</span>
                  <ChevronDown size={13} className={cn("transition-transform", showAllSteps ? "rotate-180" : "")} />
                </button>
              )}
            </section>
          </aside>
        </main>
      )}

      {/* ── Footer ── */}
      <footer className={"mx-auto flex max-w-[1600px] justify-between gap-2.5 px-7 pb-5 text-[9px] text-faint max-[760px]:px-[14px] max-[760px]:pb-[17px] max-[760px]:text-[8px]"}>
        <span>ProtoPilot · 100% Local-First. Private by default.</span>
        <span>Hardware design that shows its work</span>
      </footer>

      {/* ── Saved Projects Left Drawer Sheet ── */}
      <Sheet open={libraryOpen} onOpenChange={setLibraryOpen}>
        <SheetContent side="left" className="w-[340px] sm:w-[400px] p-0 flex flex-col bg-white">
          <SheetHeader className="px-5 py-4 border-b border-line text-left">
            <SheetTitle className="text-[17px] font-bold tracking-tight text-ink">My Projects</SheetTitle>
            <SheetDescription className="text-[11px] text-quiet">
              Stored locally on this device. Select a design to load it into the workbench.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
            {projectDrafts.length ? (
              projectDrafts.map((draft) => (
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl border border-line bg-subtle/50 px-3 py-3 text-left hover:border-brand hover:bg-brand-soft/20 cursor-pointer transition-colors"
                  key={draft.id}
                  onClick={() => void openSavedProject(draft.id)}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                    <CircuitBoard size={16} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <strong className="truncate text-xs font-semibold text-ink-strong">{draft.title}</strong>
                    <small className="text-[10px] text-quiet">Saved {new Date(draft.updatedAt).toLocaleDateString()} at {new Date(draft.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small>
                  </span>
                  <ArrowRight size={14} className="text-quiet shrink-0" />
                </button>
              ))
            ) : (
              <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 text-center text-quiet p-6">
                <CircuitBoard size={24} className="text-faint" />
                <strong className="text-xs text-ink-soft">No saved projects yet</strong>
                <span className="text-[11px] text-quiet">Describe a circuit project to create your first design.</span>
              </div>
            )}
          </div>

          <SheetFooter className="border-t border-line p-3 flex justify-end bg-subtle/30">
            <button
              type="button"
              onClick={() => {
                setLibraryOpen(false);
                startNewProject();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-body hover:bg-subtle cursor-pointer shadow-sm"
            >
              <Plus size={13} /> Start Blank Project
            </button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      {expandedArtifact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3" role="dialog" aria-modal="true" aria-label="Expanded design result" onClick={() => setExpandedArtifact(null)}>
          <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <strong className="text-sm text-ink-strong">{expandedArtifact.kind === "code" ? expandedArtifact.project.firmware.filename : expandedArtifact.kind === "schematic" ? "Schematic" : "Circuit diagram"}</strong>
              {expandedArtifact.kind === "code" && <CopyCodeButton source={expandedArtifact.project.firmware.source} />}
              <button type="button" className="rounded-lg p-2 text-body hover:bg-subtle" onClick={() => setExpandedArtifact(null)} aria-label="Close expanded view"><X size={18} /></button>
            </div>
            <div className="overflow-auto p-3">
              {expandedArtifact.kind === "code" ? (
                <pre className="overflow-auto rounded-lg bg-slate-950 p-5 text-xs leading-relaxed text-slate-100"><code>{expandedArtifact.project.firmware.source}</code></pre>
              ) : expandedArtifact.kind === "schematic" ? (
                <SchematicView project={expandedArtifact.project} />
              ) : (
                <BreadboardView project={expandedArtifact.project} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChatArtifact({ artifact, onExpand }: { artifact: NonNullable<ProjectConversationMessage["artifact"]>; onExpand: () => void }) {
  const label = artifact.kind === "code" ? artifact.project.firmware.filename : artifact.kind === "schematic" ? "Schematic" : "Circuit diagram";
  return (
    <div className="mt-2 min-w-0 overflow-hidden rounded-xl border border-line bg-white text-left">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <strong className="truncate text-[11px] font-semibold text-ink-strong">{label}</strong>
        <div className="flex shrink-0 items-center gap-1">
          {artifact.kind === "code" && <CopyCodeButton source={artifact.project.firmware.source} />}
          <button type="button" onClick={onExpand} className="rounded-md border border-line px-2 py-1 text-[10px] font-medium text-brand hover:bg-brand-soft">Expand</button>
        </div>
      </div>
      {artifact.kind === "code" ? (
        <pre className="max-h-48 overflow-auto bg-slate-950 p-3 text-[10px] leading-relaxed text-slate-100"><code>{artifact.project.firmware.source}</code></pre>
      ) : (
        <button type="button" onClick={onExpand} className="block h-44 w-full overflow-hidden bg-canvas text-left" aria-label={`Expand ${label}`}>
          {artifact.kind === "schematic" ? <SchematicView project={artifact.project} /> : <BreadboardView project={artifact.project} />}
        </button>
      )}
    </div>
  );
}

function CopyCodeButton({ source }: { source: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[10px] font-medium text-brand hover:bg-brand-soft"
      onClick={async () => {
        await navigator.clipboard.writeText(source);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}{copied ? "Copied" : "Copy"}
    </button>
  );
}

function CopyablePre({ children }: { children: ReactNode }) {
  const codeRef = useRef<HTMLPreElement | null>(null);
  return (
    <div className="my-2 overflow-hidden rounded-lg bg-slate-950">
      <div className="flex justify-end border-b border-white/10 px-2 py-1">
        <button type="button" className="text-[10px] text-slate-200 hover:text-white" onClick={() => void navigator.clipboard.writeText(codeRef.current?.textContent ?? "")}>Copy code</button>
      </div>
      <pre ref={codeRef} className="overflow-auto p-3 text-[10px] leading-relaxed text-slate-100">{children}</pre>
    </div>
  );
}

function AssistantMarkdown({ children }: { children: string }) {
  return (
    <div className="min-w-0 text-left [&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-4 [&_a]:text-brand [&_a]:underline [&_strong]:font-semibold [&_h1]:my-2 [&_h1]:font-bold [&_h2]:my-2 [&_h2]:font-bold [&_h3]:my-2 [&_h3]:font-bold [&_code]:font-mono">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: ({ children: content }) => <CopyablePre>{content}</CopyablePre> }}>{children}</ReactMarkdown>
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
