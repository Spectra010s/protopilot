"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Activity,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Check,
  ChevronDown,
  CircleHelp,
  CircuitBoard,
  Code2,
  Copy,
  Database,
  Download,
  Droplets,
  ExternalLink,
  FileCode2,
  FileSpreadsheet,
  FlaskConical,
  Layers3,
  LayoutGrid,
  LoaderCircle,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Sprout,
  Square,
  Trash2,
  Waves,
  Cable,
  Cpu,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
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
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  addProjectMessage,
  deleteProjectDraft,
  clearAllProjects,
  getProjectDraft,
  listProjectDrafts,
  listProjectMessages,
  saveProjectDraft,
  type ProjectConversationMessage,
  type ProjectDraftSummary,
} from "@/lib/storage/indexeddb";
import { cn } from "cn";

type View = "breadboard" | "schematic";
type ActiveTab = "chat" | "workbench";
type WorkbenchSubView = "overview" | "circuit" | "code" | "wiring";

export default function WorkbenchPage() {
  const [project, setProject] = useState<Project | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("chat");
  const [workbenchSubView, setWorkbenchSubView] = useState<WorkbenchSubView>("overview");
  const [expandedArtifact, setExpandedArtifact] = useState<NonNullable<ProjectConversationMessage["artifact"]> | null>(null);
  const [view, setView] = useState<View>("breadboard");
  const [prompt, setPrompt] = useState("");
  const [activeGeneration, setActiveGeneration] = useState<string | null>(null);
  const [chatReply, setChatReply] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [generationSeconds, setGenerationSeconds] = useState(0);
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [conversations, setConversations] = useState<Record<string, ProjectConversationMessage[]>>({});
  const [projectDrafts, setProjectDrafts] = useState<ProjectDraftSummary[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);

  const diagramContainerRef = useRef<HTMLDivElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const generationControllerRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);

  const conversation = useMemo(() => {
    const raw = conversations[project?.id ?? sessionId ?? ""] ?? [];
    const seen = new Set<string>();
    return raw.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, [conversations, project?.id, sessionId]);
  const checks = useMemo(() => (project ? validateElectrical(project) : []), [project]);
  const wiring = useMemo(() => (project ? deriveWiringTable(project) : []), [project]);
  const failCount = checks.filter((item) => item.status === "fail").length;
  const warningCount = checks.filter((item) => item.status === "warning" || item.status === "unverified").length;

  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [conversation.length, chatReply, project?.id]);

  // Disable background scrolling when expanded artifact/image modal is open
  useEffect(() => {
    if (!expandedArtifact) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [expandedArtifact]);

  // Initial load from IndexedDB — load drafts index only, start fresh session without mock defaults
  useEffect(() => {
    let active = true;
    void listProjectDrafts()
      .then((drafts) => {
        if (!active) return;
        setProjectDrafts(drafts);
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

  // Autosave active project to IndexedDB
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
      if (saved) {
        setProject(saved);
        setSessionId(saved.id);
        setNotice(`Opened: ${saved.title}`);
        setActiveTab("workbench");
        setWorkbenchSubView("overview");
      } else {
        setProject(null);
        setSessionId(id);
        setNotice("Opened design conversation");
        setActiveTab("chat");
      }
      setActiveGeneration(null);
      setChatReply(null);
      setLibraryOpen(false);
      const messages = await listProjectMessages(id);
      setConversations((current) => ({ ...current, [id]: messages }));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not open project");
    }
  }

  async function handleDeleteProject(id: string) {
    try {
      await deleteProjectDraft(id);
      const drafts = await listProjectDrafts();
      setProjectDrafts(drafts);
      if (project?.id === id) {
        setProject(null);
        setSessionId(createId());
        setActiveTab("chat");
      }
      setNotice("Project deleted.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not delete project");
    }
  }

  async function handleClearAll() {
    try {
      await clearAllProjects();
      setProjectDrafts([]);
      setProject(null);
      setSessionId(createId());
      setConversations({});
      setActiveTab("chat");
      setNotice("All local projects and history cleared.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not clear data");
    }
  }

  // Load conversation messages for the current project or active session
  useEffect(() => {
    const activeId = project?.id ?? sessionId;
    if (!storageReady || !activeId) return;
    let active = true;
    void listProjectMessages(activeId)
      .then((messages) => {
        if (active) setConversations((current) => ({ ...current, [activeId]: messages }));
      })
      .catch((error: unknown) => {
        if (active) setNotice(error instanceof Error ? `Could not load messages: ${error.message}` : "Could not load conversation");
      });
    return () => {
      active = false;
    };
  }, [project?.id, sessionId, storageReady]);

  async function recordMessage(role: ProjectConversationMessage["role"], content: string, projectId: string, artifact?: ProjectConversationMessage["artifact"]) {
    try {
      const message = await addProjectMessage(projectId, role, content, artifact);
      setConversations((current) => {
        const existing = current[projectId] ?? [];
        if (existing.some((m) => m.id === message.id)) return current;
        return { ...current, [projectId]: [...existing, message] };
      });
      void listProjectDrafts().then((drafts) => setProjectDrafts(drafts)).catch(() => undefined);
    } catch (error) {
      const message: ProjectConversationMessage = {
        id: createId(),
        projectId,
        role,
        content,
        artifact,
        createdAt: Date.now(),
      };
      setConversations((current) => {
        const existing = current[projectId] ?? [];
        if (existing.some((m) => m.id === message.id)) return current;
        return { ...current, [projectId]: [...existing, message] };
      });
      setNotice(error instanceof Error ? `Session only: ${error.message}` : "Message not saved");
    }
  }

  async function sendMessage(message: string) {
    const text = message.trim();
    if (!text || busy || sendingRef.current) return;
    sendingRef.current = true;
    const projectId = project?.id ?? sessionId ?? createId();
    if (!project && !sessionId) setSessionId(projectId);
    const history = conversation.filter(({ content }) => content.trim()).map(({ role, content }) => ({ role, content }));
    setActiveGeneration(text);
    setChatReply(null);
    setBusy(true);
    setGenerationSeconds(0);
    setNotice("ProtoPilot is responding…");
    setPrompt("");
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
      sendingRef.current = false;
      setBusy(false);
    }
  }

  function startNewProject() {
    setProject(null);
    setSessionId(createId());
    setActiveGeneration(null);
    setChatReply(null);
    setPrompt("");
    setNotice("");
    setActiveTab("chat");
    setWorkbenchSubView("overview");
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
    <div className="min-h-screen bg-canvas text-[13px] text-ink">
      {/* ── Top Header ── */}
      <header className="flex h-[62px] items-center justify-between border-b border-line bg-white px-7 max-[760px]:h-14 max-[760px]:px-3.5">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-[9px] text-base font-semibold tracking-[-.04em] text-ink no-underline hover:opacity-85">
            <span className="grid size-[30px] place-items-center rounded-[9px] bg-brand-soft text-brand"><CircuitBoard size={19} /></span>
            <span>Proto<span className="text-brand-ink">Pilot</span></span>
            <span className="rounded-[5px] bg-chip px-1.5 py-[3px] text-[9px] font-bold tracking-[.07em] text-quiet">WORKBENCH</span>
          </Link>
        </div>

        <nav className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setLibraryOpen(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-body hover:text-brand bg-transparent border-0 cursor-pointer p-0"
          >
            <Database size={14} className="text-brand" />
            <span className="max-[600px]:hidden">My Projects</span>
            {projectDrafts.length > 0 && (
              <span className="rounded-full bg-chip px-1.5 py-0.5 text-[9px] text-quiet font-bold">{projectDrafts.length}</span>
            )}
          </button>
          {project && (
            <button
              type="button"
              onClick={startNewProject}
              className="flex items-center gap-1 text-xs text-quiet hover:text-ink bg-transparent border-0 cursor-pointer p-0 ml-2"
            >
              <Plus size={14} /> <span className="max-[600px]:hidden">New</span>
            </button>
          )}
        </nav>
      </header>

      {/* ── Tab Bar: Chat / Workbench ── */}
      <div className="flex items-center justify-center border-b border-line bg-white px-7 py-2 max-[760px]:px-3.5">
        <div className="flex items-center rounded-xl bg-chip/70 p-1 border border-line-soft">
          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer",
              activeTab === "chat"
                ? "bg-white text-ink-strong shadow-sm"
                : "text-quiet hover:text-ink"
            )}
          >
            <Bot size={15} />
            <span>Chat</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("workbench")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer relative",
              activeTab === "workbench"
                ? "bg-white text-ink-strong shadow-sm"
                : "text-quiet hover:text-ink"
            )}
          >
            <LayoutGrid size={15} />
            <span>Workbench</span>
            {project && (
              <span className="flex size-2 rounded-full bg-brand" title={`rev ${project.revision + 1}`} />
            )}
          </button>
        </div>
      </div>

      {/* ── Main View: Chat or Workbench ── */}
      {activeTab === "chat" ? (
        !activeGeneration && !busy && conversation.length === 0 ? (
          /* Clean Empty Prompt Canvas (No mock data, no fake projects) */
          <main className="mx-auto flex w-full max-w-[800px] flex-col items-center px-6 py-16 text-center">
            <div className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand mb-4">
              <CircuitBoard size={30} />
            </div>
            <h1 className="text-[26px] font-bold text-ink-strong tracking-tight">Create a New Hardware Design</h1>
            <p className="mt-2 max-w-[500px] text-[13px] text-body leading-relaxed">
              Enter what you want to build. ProtoPilot will choose microcontroller pins, build stages, generate wiring netlists, Arduino code, and verify safety checks.
            </p>

            {/* Clean Prompt Form */}
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
                placeholder="e.g. Build an ESP32 robot with two DC motors driven by an L298N driver, two ultrasonic distance sensors, and a 7.4V LiPo battery pack."
                className="w-full resize-none rounded-xl border border-line-strong bg-inset p-3 text-xs text-ink outline-none focus:border-brand focus:shadow-focus"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-[10px] text-quiet">Live hardware generation with safety checks</span>
                {busy ? (
                  <button
                    type="button"
                    onClick={() => generationControllerRef.current?.abort("cancelled")}
                    className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-xl bg-danger px-4 text-xs font-semibold text-white shadow-button hover:bg-danger/90 cursor-pointer"
                    title="Stop"
                  >
                    <Square size={12} className="fill-current" />
                    <span>Stop</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void sendMessage(prompt)}
                    disabled={!prompt.trim()}
                    aria-label="Send to ProtoPilot"
                    className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-xl bg-brand px-4 text-xs font-semibold text-white shadow-button hover:bg-brand-strong disabled:opacity-50 cursor-pointer"
                  >
                    <Send size={13} />
                    <span>Send</span>
                  </button>
                )}
              </div>
            </div>

            {/* Suggestion Prompt Cards Underneath */}
            <div className="mt-8 w-full max-w-[620px]">
              <p className="text-[11px] font-semibold tracking-wider text-faint uppercase mb-3 text-left">
                Or pick an idea to start:
              </p>
              <div className="grid grid-cols-2 gap-3 max-[600px]:grid-cols-1">
                {[
                  {
                    title: "Smart Plant Watering",
                    prompt: "I want to build a smart plant watering system with a capacitive soil moisture sensor, ESP32, low-side MOSFET switch for a 5V pump, flyback diode, and a manual watering button.",
                  },
                  {
                    title: "Solar Battery Charger",
                    prompt: "Design a solar lithium battery charger monitor with INA219 current sensor, TP4056 charge controller, 18650 cell, and an OLED display.",
                  },
                  {
                    title: "Servo Robotic Arm",
                    prompt: "Build an 8-servo quadruped robot controller using a Raspberry Pi Pico, PCA9685 I2C PWM driver, and a 5V 5A UBEC power supply.",
                  },
                  {
                    title: "Ultrasonic Distance Alarm",
                    prompt: "Create an ultrasonic parking sensor alarm with HC-SR04, active buzzer, RGB LED indicator, and Arduino Nano.",
                  },
                ].map((card) => (
                  <button
                    key={card.title}
                    type="button"
                    onClick={() => {
                      if (!busy) void sendMessage(card.prompt);
                    }}
                    className="flex flex-col gap-1.5 rounded-xl border border-line bg-white p-3.5 text-left shadow-xs hover:border-brand hover:shadow-sm cursor-pointer transition"
                  >
                    <strong className="text-xs font-semibold text-ink-strong">{card.title}</strong>
                    <p className="text-[11px] leading-relaxed text-quiet line-clamp-2">{card.prompt}</p>
                  </button>
                ))}
              </div>
            </div>
          </main>
        ) : (
          /* Full Page Chat UI */
          <main className="mx-auto flex h-[calc(100vh-108px)] w-full max-w-[880px] flex-col px-4 pb-4 pt-3" aria-live="polite">
            {/* Chat Header Status */}
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2.5">
                <div className="grid size-8 place-items-center rounded-xl bg-brand-soft text-brand">
                  <Bot size={18} />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-ink-strong">Hardware Design Assistant</h3>
                  <p className="text-[10px] text-faint flex items-center gap-1.5">
                    <span className={cn("inline-block size-1.5 rounded-full", busy ? "bg-amber-500 animate-pulse" : "bg-pass")} />
                    {busy ? "ProtoPilot is responding…" : "ProtoPilot · Online"}
                  </p>
                </div>
              </div>
            </div>

            {/* Chat Messages Body */}
            <div ref={chatScrollRef} className="flex-1 space-y-4 overflow-y-auto py-4 pr-1">
              {conversation.length > 0 ? (
                conversation.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}
                  >
                    {msg.role !== "user" && (
                      <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand mt-0.5">
                        <Bot size={15} />
                      </div>
                    )}
                    <div
                      className={cn(
                        "text-xs leading-relaxed max-w-[85%]",
                        msg.role === "user"
                          ? "rounded-2xl rounded-tr-sm bg-brand px-4 py-2.5 text-white shadow-sm"
                          : "text-ink-strong py-1"
                      )}
                    >
                      {msg.content && (msg.role === "assistant" ? <AssistantMarkdown>{msg.content}</AssistantMarkdown> : <p className="whitespace-pre-line">{msg.content}</p>)}
                      {msg.artifact && (
                        <ChatArtifact
                          artifact={msg.artifact}
                          onExpand={() => setExpandedArtifact(msg.artifact ?? null)}
                          onOpenInWorkbench={(subView) => {
                            setActiveTab("workbench");
                            setWorkbenchSubView(subView);
                          }}
                        />
                      )}
                      <span className={cn("block mt-1 text-[9px]", msg.role === "user" ? "text-white/70 text-right" : "text-faint")}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                ))
              ) : activeGeneration ? (
                <div className="flex justify-end gap-3">
                  <div className="rounded-2xl rounded-tr-sm bg-brand px-4 py-2.5 text-xs text-white max-w-[85%] shadow-sm leading-relaxed">
                    <p className="whitespace-pre-line">{activeGeneration}</p>
                    <span className="block mt-1 text-[9px] text-white/70 text-right">Just now</span>
                  </div>
                </div>
              ) : null}

              {/* Working Bubble */}
              {busy && (
                <div className="flex items-start gap-3">
                  <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand mt-0.5">
                    <Bot size={15} />
                  </div>
                  <div className="py-1 text-xs text-ink-strong max-w-[85%]">
                    <div className="flex items-center gap-2 font-medium text-brand">
                      <LoaderCircle className="animate-spin" size={14} />
                      <span>{notice && notice !== "ProtoPilot is responding…" ? notice : "ProtoPilot is responding…"}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Assistant Streamed Reply */}
              {chatReply && !conversation.some((m) => m.content === chatReply) && (
                <div className="flex items-start gap-3">
                  <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand mt-0.5">
                    <Bot size={15} />
                  </div>
                  <div className="py-1 text-xs text-ink-strong max-w-[85%]">
                    <AssistantMarkdown>{chatReply}</AssistantMarkdown>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input Footer */}
            <div className="pt-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (busy) {
                    generationControllerRef.current?.abort("cancelled");
                  } else if (prompt.trim()) {
                    void sendMessage(prompt);
                  }
                }}
                className="flex items-center gap-2 rounded-2xl border border-line-strong bg-white p-2.5 shadow-panel"
              >
                <label className="sr-only" htmlFor="chat-reply-input">
                  Your message
                </label>
                <textarea
                  id="chat-reply-input"
                  rows={2}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ask ProtoPilot to generate code, change pins, or modify circuit…"
                  className="w-full resize-none border-0 bg-transparent p-2 text-xs text-ink outline-none"
                />
                {busy ? (
                  <button
                    type="button"
                    onClick={() => generationControllerRef.current?.abort("cancelled")}
                    className="self-end inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-danger px-3.5 text-xs font-semibold text-white shadow-button hover:bg-danger/90 cursor-pointer shrink-0"
                    title="Stop response"
                  >
                    <Square size={12} className="fill-current" />
                    <span className="hidden sm:inline">Stop</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!prompt.trim()}
                    className="self-end inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-brand px-3.5 text-xs font-semibold text-white shadow-button hover:bg-brand-strong disabled:opacity-50 cursor-pointer shrink-0"
                    title="Send message"
                  >
                    <Send size={13} />
                    <span className="hidden sm:inline">Send</span>
                  </button>
                )}
              </form>
            </div>
          </main>
        )
      ) : (
        /* ── Workbench View ── */
        !project ? (
          <main className="mx-auto flex h-[calc(100vh-108px)] w-full max-w-[800px] flex-col items-center justify-center px-6 py-14 text-center">
            <div className="grid size-16 place-items-center rounded-2xl bg-brand-soft text-brand mb-4">
              <LayoutGrid size={32} />
            </div>
            <h2 className="text-xl font-bold text-ink-strong">No Hardware Design Active</h2>
            <p className="mt-2 max-w-[460px] text-xs text-body leading-relaxed">
              ProtoPilot creates circuits and code dynamically through conversation. Ask in the Chat tab to design a circuit, and its schema, vector diagrams, and firmware will be generated here.
            </p>
            <button
              type="button"
              onClick={() => setActiveTab("chat")}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-semibold text-white shadow-button hover:bg-brand-strong cursor-pointer"
            >
              <Bot size={15} /> Open Chat
            </button>
          </main>
        ) : (
          <main className="flex min-h-[calc(100vh-108px)] flex-col bg-canvas">
            {workbenchSubView === "overview" && (
              /* ── Workbench Artifact Gallery ── */
              <div className="flex-1 px-6 py-8 sm:px-10">
                <div className="mx-auto max-w-[1200px]">
                  {/* Project Header */}
                  <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand font-bold text-sm">
                        <Cpu size={20} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5">
                          <h2 className="text-lg font-bold text-ink-strong truncate max-w-[300px] sm:max-w-[460px]">
                            {project.title}
                          </h2>
                          <span className="rounded-md bg-chip px-2 py-0.5 text-[10px] font-semibold text-quiet shrink-0">
                            rev {project.revision + 1}
                          </span>
                          <span className="hidden sm:inline-block rounded-md bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand-ink shrink-0">
                            {project.constraints.controller ?? "MCU"}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-body max-w-[500px] truncate">{project.summary}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("chat")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-body hover:bg-subtle cursor-pointer shadow-xs shrink-0"
                    >
                      <Bot size={13} /> Back to Chat
                    </button>
                  </div>

                  {/* Generated Artifacts Grid */}
                  <div className="mb-4">
                    <h3 className="text-xs font-semibold text-quiet uppercase tracking-wider mb-4">Generated Artifacts</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {/* Circuit Diagram Card — always available when components + connections exist */}
                    {project.components.length > 0 && project.connections.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setWorkbenchSubView("circuit")}
                        className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-panel text-left cursor-pointer transition hover:border-brand hover:shadow-md"
                      >
                        <div className="flex items-center gap-3 border-b border-line bg-subtle/40 px-4 py-3">
                          <span className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand">
                            <CircuitBoard size={16} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <strong className="text-xs font-bold text-ink-strong block">Circuit Diagram</strong>
                            <span className="text-[10px] text-quiet">Breadboard & Schematic Views</span>
                          </div>
                          <ArrowRight size={14} className="text-faint group-hover:text-brand transition shrink-0" />
                        </div>
                        <div className="flex-1 p-4">
                          <div className="flex flex-wrap gap-1.5">
                            {project.components.slice(0, 5).map((c) => (
                              <span key={c.id} className="rounded-md bg-chip px-2 py-0.5 text-[10px] font-mono text-quiet">{c.reference}</span>
                            ))}
                            {project.components.length > 5 && (
                              <span className="rounded-md bg-chip px-2 py-0.5 text-[10px] text-faint">+{project.components.length - 5} more</span>
                            )}
                          </div>
                          <p className="mt-2 text-[11px] text-body leading-relaxed line-clamp-2">
                            {project.components.length} components · {project.connections.length} connections
                          </p>
                        </div>
                      </button>
                    )}

                    {/* Firmware Code Card — available when source is non-empty */}
                    {project.firmware.source.trim().length > 0 && (
                      <button
                        type="button"
                        onClick={() => setWorkbenchSubView("code")}
                        className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-panel text-left cursor-pointer transition hover:border-brand hover:shadow-md"
                      >
                        <div className="flex items-center gap-3 border-b border-line bg-subtle/40 px-4 py-3">
                          <span className="grid size-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
                            <FileCode2 size={16} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <strong className="text-xs font-bold text-ink-strong block">{project.firmware.filename}</strong>
                            <span className="text-[10px] text-quiet">{project.firmware.language} · {project.firmware.board || "Arduino"}</span>
                          </div>
                          <ArrowRight size={14} className="text-faint group-hover:text-brand transition shrink-0" />
                        </div>
                        <div className="flex-1 p-4">
                          <div className="rounded-lg bg-slate-950 p-3 max-h-24 overflow-hidden">
                            <pre className="font-mono text-[10px] leading-relaxed text-slate-300 whitespace-pre-wrap">
                              {project.firmware.source.slice(0, 200)}{project.firmware.source.length > 200 ? "…" : ""}
                            </pre>
                          </div>
                        </div>
                      </button>
                    )}

                    {/* Wiring & BOM Card — available when components exist */}
                    {project.components.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setWorkbenchSubView("wiring")}
                        className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-panel text-left cursor-pointer transition hover:border-brand hover:shadow-md"
                      >
                        <div className="flex items-center gap-3 border-b border-line bg-subtle/40 px-4 py-3">
                          <span className="grid size-8 place-items-center rounded-lg bg-amber-50 text-amber-600">
                            <Cable size={16} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <strong className="text-xs font-bold text-ink-strong block">Wiring & BOM</strong>
                            <span className="text-[10px] text-quiet">Pin Netlist & Components</span>
                          </div>
                          <ArrowRight size={14} className="text-faint group-hover:text-brand transition shrink-0" />
                        </div>
                        <div className="flex-1 p-4">
                          <div className="flex items-center gap-4 text-[11px] text-body">
                            <span className="flex items-center gap-1.5">
                              <Layers3 size={13} className="text-quiet" />
                              {project.components.length} components
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Cable size={13} className="text-quiet" />
                              {wiring.length} wires
                            </span>
                          </div>
                        </div>
                      </button>
                    )}

                    {/* Safety Checks Card — available when checks have results */}
                    {checks.length > 0 && (
                      <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-panel text-left">
                        <div className="flex items-center gap-3 border-b border-line bg-subtle/40 px-4 py-3">
                          <span className={cn(
                            "grid size-8 place-items-center rounded-lg",
                            failCount > 0 ? "bg-red-50 text-red-600" : warningCount > 0 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                          )}>
                            <ShieldCheck size={16} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <strong className="text-xs font-bold text-ink-strong block">Safety Checks</strong>
                            <span className="text-[10px] text-quiet">Electrical validation results</span>
                          </div>
                        </div>
                        <div className="flex-1 p-4 space-y-2">
                          <div className="flex items-center gap-3 text-[11px]">
                            {failCount > 0 && (
                              <span className="flex items-center gap-1 text-red-600 font-semibold">
                                <X size={12} /> {failCount} fail{failCount !== 1 ? "s" : ""}
                              </span>
                            )}
                            {warningCount > 0 && (
                              <span className="flex items-center gap-1 text-amber-600 font-semibold">
                                <CircleHelp size={12} /> {warningCount} warning{warningCount !== 1 ? "s" : ""}
                              </span>
                            )}
                            {failCount === 0 && warningCount === 0 && (
                              <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                                <Check size={12} /> All {checks.length} checks passed
                              </span>
                            )}
                          </div>
                          {checks.slice(0, 3).map((check, i) => (
                            <div key={i} className="flex items-start gap-2 text-[10px] text-body">
                              <span className={cn(
                                "mt-0.5 size-1.5 rounded-full shrink-0",
                                check.status === "fail" ? "bg-red-500" : check.status === "warning" || check.status === "unverified" ? "bg-amber-400" : "bg-emerald-500"
                              )} />
                              <span className="line-clamp-1">{check.title}: {check.detail}</span>
                            </div>
                          ))}
                          {checks.length > 3 && (
                            <p className="text-[10px] text-faint">+{checks.length - 3} more checks</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Build Steps Card — available when buildSteps exist */}
                    {project.buildSteps.length > 0 && (
                      <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-panel text-left">
                        <div className="flex items-center gap-3 border-b border-line bg-subtle/40 px-4 py-3">
                          <span className="grid size-8 place-items-center rounded-lg bg-violet-50 text-violet-600">
                            <Sprout size={16} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <strong className="text-xs font-bold text-ink-strong block">Build Steps</strong>
                            <span className="text-[10px] text-quiet">{project.buildSteps.length} step{project.buildSteps.length !== 1 ? "s" : ""}</span>
                          </div>
                        </div>
                        <div className="flex-1 p-4 space-y-1.5">
                          {project.buildSteps.slice(0, 4).map((step, i) => (
                            <div key={i} className="flex items-start gap-2 text-[11px] text-body">
                              <span className="grid size-4 shrink-0 place-items-center rounded-full bg-chip text-[9px] font-bold text-quiet mt-0.5">{i + 1}</span>
                              <span className="line-clamp-1">{step}</span>
                            </div>
                          ))}
                          {project.buildSteps.length > 4 && (
                            <p className="text-[10px] text-faint pl-6">+{project.buildSteps.length - 4} more steps</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Warnings Card — available when warnings exist */}
                    {project.warnings.length > 0 && (
                      <div className="flex flex-col overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-panel text-left">
                        <div className="flex items-center gap-3 border-b border-amber-100 bg-amber-50/60 px-4 py-3">
                          <span className="grid size-8 place-items-center rounded-lg bg-amber-100 text-amber-600">
                            <CircleHelp size={16} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <strong className="text-xs font-bold text-ink-strong block">Warnings & Notes</strong>
                            <span className="text-[10px] text-quiet">{project.warnings.length} item{project.warnings.length !== 1 ? "s" : ""}</span>
                          </div>
                        </div>
                        <div className="flex-1 p-4 space-y-1.5">
                          {project.warnings.slice(0, 3).map((w, i) => (
                            <p key={i} className="text-[11px] text-amber-800 leading-relaxed line-clamp-2">⚠ {w}</p>
                          ))}
                          {project.warnings.length > 3 && (
                            <p className="text-[10px] text-faint">+{project.warnings.length - 3} more</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {workbenchSubView === "circuit" && (
                /* ── Fullscreen Circuit Canvas View ── */
                <div className="flex h-[calc(100vh-125px)] flex-col bg-canvas">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-4 py-2.5 sm:px-6">
                    <button
                      type="button"
                      onClick={() => setWorkbenchSubView("overview")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-body hover:bg-subtle cursor-pointer transition shrink-0"
                    >
                      <ArrowLeft size={14} /> Back to Overview
                    </button>

                    <div className="flex items-center rounded-xl bg-chip/80 p-1 border border-line-soft shrink-0">
                      <button
                        type="button"
                        onClick={() => setView("breadboard")}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer",
                          view === "breadboard" ? "bg-white text-ink-strong shadow-xs" : "text-quiet hover:text-ink"
                        )}
                      >
                        <CircuitBoard size={14} className={view === "breadboard" ? "text-brand" : ""} />
                        <span>Breadboard</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setView("schematic")}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer",
                          view === "schematic" ? "bg-white text-ink-strong shadow-xs" : "text-quiet hover:text-ink"
                        )}
                      >
                        <FlaskConical size={14} className={view === "schematic" ? "text-brand" : ""} />
                        <span>Schematic</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={downloadDiagram}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-body hover:bg-subtle cursor-pointer transition shrink-0"
                      title={`Download ${view} SVG`}
                    >
                      <Download size={13} />
                      <span className="hidden sm:inline">Download</span> SVG
                    </button>
                  </div>

                  {/* Circuit Canvas Full Screen with ZoomableCircuitView */}
                  <div ref={diagramContainerRef} className="flex-1 overflow-hidden relative">
                    <ZoomableCircuitView>
                      {view === "breadboard" ? <BreadboardView project={project} /> : <SchematicView project={project} />}
                    </ZoomableCircuitView>
                  </div>
                </div>
              )}

              {workbenchSubView === "code" && (
                /* ── Fullscreen Firmware Code View ── */
                <div className="flex h-[calc(100vh-125px)] flex-col bg-slate-950">
                  <div className="flex items-center justify-between border-b border-white/10 bg-slate-900 px-6 py-2.5 text-slate-200">
                    <button
                      type="button"
                      onClick={() => setWorkbenchSubView("overview")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/20 cursor-pointer transition shrink-0"
                    >
                      <ArrowLeft size={14} /> Back to Overview
                    </button>

                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="font-semibold text-white">{project.firmware.filename}</span>
                      <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-slate-300">
                        {project.firmware.board || "ESP32"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={copyFirmware}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 cursor-pointer"
                      >
                        {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy Code"}
                      </button>
                      <button
                        type="button"
                        onClick={downloadFirmware}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-strong cursor-pointer"
                      >
                        <Download size={13} /> Download .ino
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto p-6 font-mono text-xs leading-relaxed text-slate-100">
                    <pre className="max-w-[1200px] mx-auto">
                      <code>{project.firmware.source}</code>
                    </pre>
                  </div>
                </div>
              )}

              {workbenchSubView === "wiring" && (
                /* ── Fullscreen Wiring Netlist & Components BOM View ── */
                <div className="min-h-[calc(100vh-125px)] bg-canvas p-6 sm:p-10">
                  <div className="mx-auto max-w-[1100px] space-y-6">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setWorkbenchSubView("overview")}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-body hover:bg-subtle cursor-pointer transition shrink-0"
                      >
                        <ArrowLeft size={14} /> Back to Overview
                      </button>
                      <button
                        type="button"
                        onClick={exportWiringCSV}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-body hover:bg-subtle cursor-pointer"
                      >
                        <FileSpreadsheet size={13} /> Export CSV
                      </button>
                    </div>

                    {/* Components BOM Card */}
                    <div className="rounded-2xl border border-line bg-white p-5 shadow-panel">
                      <h3 className="text-sm font-bold text-ink-strong mb-3 flex items-center gap-2">
                        <Layers3 size={16} className="text-brand" /> Components BOM ({project.components.length})
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-xs">
                          <thead>
                            <tr className="border-b border-line-soft text-quiet text-[10px] font-bold uppercase tracking-wider">
                              <th className="py-2.5 px-3">Reference</th>
                              <th className="py-2.5 px-3">Name</th>
                              <th className="py-2.5 px-3">Category</th>
                              <th className="py-2.5 px-3">Specifications / Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {project.components.map((comp) => (
                              <tr key={comp.id} className="border-b border-line-soft/60 hover:bg-subtle/50">
                                <td className="py-2.5 px-3 font-mono font-semibold text-ink-strong">{comp.reference}</td>
                                <td className="py-2.5 px-3 text-ink-strong font-medium">{comp.name}</td>
                                <td className="py-2.5 px-3">
                                  <span className="rounded-md bg-chip px-2 py-0.5 text-[10px] font-mono text-quiet">
                                    {comp.category}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-quiet text-[11px]">
                                  {comp.specifications.some((s) => s.status === "unknown")
                                    ? "Rating to confirm on datasheet"
                                    : comp.description}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Pin Netlist Card */}
                    <div className="rounded-2xl border border-line bg-white p-5 shadow-panel">
                      <h3 className="text-sm font-bold text-ink-strong mb-3 flex items-center gap-2">
                        <Cable size={16} className="text-brand" /> Pin-to-Pin Netlist ({wiring.length})
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-xs">
                          <thead>
                            <tr className="border-b border-line-soft text-quiet text-[10px] font-bold uppercase tracking-wider">
                              <th className="py-2.5 px-3">From Pin</th>
                              <th className="py-2.5 px-3">To Pin</th>
                              <th className="py-2.5 px-3">Net Name</th>
                              <th className="py-2.5 px-3">Details</th>
                            </tr>
                          </thead>
                          <tbody>
                            {wiring.map((row) => (
                              <tr key={row.id} className="border-b border-line-soft/60 hover:bg-subtle/50">
                                <td className="py-2.5 px-3 font-medium text-ink-strong">
                                  <span className="mr-2 inline-block size-2 rounded-full" style={{ backgroundColor: row.color }} />
                                  {row.from}
                                </td>
                                <td className="py-2.5 px-3 font-medium text-ink-strong">{row.to}</td>
                                <td className="py-2.5 px-3">
                                  <span className="rounded-md bg-chip px-2 py-0.5 font-mono text-[10px] text-ink">
                                    {row.net}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-quiet text-[11px]">{row.details}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
          </main>
        )
      )}

      {/* ── Footer ── */}
      <footer className="mx-auto flex max-w-[1400px] justify-between gap-2.5 px-7 py-4 text-[9px] text-faint max-[760px]:px-4">
        <span>ProtoPilot · 100% Local-First &amp; Private by Default.</span>
        <span>Deterministic Verification Engine</span>
      </footer>

      {/* ── Saved Projects Left Drawer Sheet ── */}
      <Sheet open={libraryOpen} onOpenChange={setLibraryOpen}>
        <SheetContent side="left" className="w-[340px] sm:w-[400px] p-0 flex flex-col bg-white">
          <SheetHeader className="px-5 py-4 border-b border-line text-left">
            <SheetTitle className="text-[17px] font-bold tracking-tight text-ink">My Projects</SheetTitle>
            <SheetDescription className="text-[11px] text-quiet">
              Saved locally on this device. Select a design to load it into the workbench.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
            {projectDrafts.length ? (
              projectDrafts.map((draft) => (
                <div
                  key={draft.id}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-subtle/50 px-3 py-2.5 text-left hover:border-brand hover:bg-brand-soft/20 transition-colors"
                >
                  <button
                    type="button"
                    className="flex flex-1 items-center gap-3 min-w-0 bg-transparent border-0 p-0 text-left cursor-pointer"
                    onClick={() => void openSavedProject(draft.id)}
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                      <CircuitBoard size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <strong className="block text-xs font-semibold text-ink-strong truncate">{draft.title}</strong>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-quiet">
                        <span>{new Date(draft.updatedAt).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm({ id: draft.id, title: draft.title })}
                    className="grid size-7 place-items-center rounded-lg text-quiet hover:text-danger hover:bg-danger-soft/40 cursor-pointer transition shrink-0"
                    title="Delete project"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-xs text-quiet">
                <Database size={24} className="mx-auto mb-2 text-faint" />
                <p>No saved projects yet.</p>
                <p className="text-[10px] text-faint mt-1">Start chatting to create your first design.</p>
              </div>
            )}
          </div>
          {projectDrafts.length > 0 && (
            <div className="p-3 border-t border-line bg-subtle/30">
              <button
                type="button"
                onClick={() => void handleClearAll()}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-white px-3 py-2 text-xs font-medium text-danger hover:bg-danger-soft/20 cursor-pointer transition"
              >
                <Trash2 size={13} /> Clear All Saved Projects
              </button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong className="text-ink-strong">{deleteConfirm?.title}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setDeleteConfirm(null)}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-line bg-white px-4 text-xs font-medium text-body hover:bg-subtle cursor-pointer transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (deleteConfirm) {
                  void handleDeleteProject(deleteConfirm.id);
                  setDeleteConfirm(null);
                }
              }}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-danger px-4 text-xs font-semibold text-white hover:bg-danger/90 cursor-pointer transition"
            >
              <Trash2 size={13} />
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Expanded Artifact Modal ── */}
      {expandedArtifact && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setExpandedArtifact(null)}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <div className="flex items-center gap-2">
                <CircuitBoard size={16} className="text-brand" />
                <strong className="text-sm font-bold text-ink-strong">
                  {expandedArtifact.kind === "code" ? expandedArtifact.project.firmware.filename : expandedArtifact.kind === "schematic" ? "Schematic Diagram" : "Breadboard Diagram"}
                </strong>
                <span className="rounded-md bg-chip px-2 py-0.5 text-[10px] font-semibold text-quiet">
                  {expandedArtifact.project.title}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {expandedArtifact.kind === "code" && (
                  <CopyCodeButton source={expandedArtifact.project.firmware.source} />
                )}
                <button
                  type="button"
                  onClick={() => setExpandedArtifact(null)}
                  className="grid size-7 place-items-center rounded-lg hover:bg-subtle text-body cursor-pointer"
                  title="Close modal"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-canvas">
              {expandedArtifact.kind === "code" ? (
                <pre className="overflow-auto rounded-xl bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100">
                  <code>{expandedArtifact.project.firmware.source}</code>
                </pre>
              ) : (
                <ZoomableCircuitView>
                  {expandedArtifact.kind === "schematic" ? (
                    <SchematicView project={expandedArtifact.project} />
                  ) : (
                    <BreadboardView project={expandedArtifact.project} />
                  )}
                </ZoomableCircuitView>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ZoomableCircuitView({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  function handleZoomIn() {
    setScale((s) => Math.min(Number((s + 0.25).toFixed(2)), 3.5));
  }

  function handleZoomOut() {
    setScale((s) => {
      const next = Math.max(Number((s - 0.25).toFixed(2)), 0.5);
      if (next <= 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  }

  function handleReset() {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (scale <= 1) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  }

  function handleMouseUp() {
    setIsDragging(false);
  }

  return (
    <div className="relative flex min-h-[460px] max-h-[82vh] flex-1 flex-col overflow-hidden bg-canvas">
      {/* Zoom controls floating bar */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1 rounded-xl border border-line bg-white/95 px-2 py-1.5 shadow-panel backdrop-blur-sm">
        <button
          type="button"
          onClick={handleZoomOut}
          disabled={scale <= 0.5}
          className="grid size-7 place-items-center rounded-lg hover:bg-subtle text-body disabled:opacity-40 cursor-pointer"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <ZoomOut size={15} />
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="px-2 text-[11px] font-semibold text-ink-strong hover:text-brand cursor-pointer"
          title="Reset zoom"
        >
          {Math.round(scale * 100)}%
        </button>
        <button
          type="button"
          onClick={handleZoomIn}
          disabled={scale >= 3.5}
          className="grid size-7 place-items-center rounded-lg hover:bg-subtle text-body disabled:opacity-40 cursor-pointer"
          title="Zoom in"
          aria-label="Zoom in"
        >
          <ZoomIn size={15} />
        </button>
        {scale !== 1 && (
          <button
            type="button"
            onClick={handleReset}
            className="ml-1 grid size-7 place-items-center rounded-lg hover:bg-subtle text-quiet hover:text-ink cursor-pointer"
            title="Reset to 100%"
          >
            <RotateCcw size={13} />
          </button>
        )}
      </div>

      {/* Circuit drawing canvas */}
      <div
        className={cn(
          "flex flex-1 items-center justify-center p-6 select-none overflow-hidden",
          scale > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-default"
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isDragging ? "none" : "transform 0.15s ease-out",
          }}
          className="w-full max-w-[960px] flex items-center justify-center origin-center"
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function ChatArtifact({
  artifact,
  onExpand,
  onOpenInWorkbench,
}: {
  artifact: NonNullable<ProjectConversationMessage["artifact"]>;
  onExpand: () => void;
  onOpenInWorkbench?: (subView: WorkbenchSubView) => void;
}) {
  const isCode = artifact.kind === "code";
  const label = isCode
    ? artifact.project.firmware.filename
    : artifact.kind === "schematic"
    ? "Schematic Diagram"
    : "Breadboard Circuit Diagram";

  return (
    <div className="mt-2.5 min-w-0 overflow-hidden rounded-xl border border-line bg-white shadow-sm text-left">
      <div className="flex items-center justify-between gap-2 border-b border-line bg-subtle/50 px-3 py-2">
        <div className="flex items-center gap-2 truncate">
          {isCode ? <FileCode2 size={14} className="text-brand shrink-0" /> : <CircuitBoard size={14} className="text-brand shrink-0" />}
          <strong className="truncate text-[11px] font-semibold text-ink-strong">{label}</strong>
          {isCode && (
            <span className="rounded-md bg-chip px-1.5 py-0.5 text-[9px] font-mono text-quiet shrink-0">
              {artifact.project.firmware.board || "Arduino"}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {isCode && <CopyCodeButton source={artifact.project.firmware.source} />}
          {onOpenInWorkbench && (
            <button
              type="button"
              onClick={() => onOpenInWorkbench(isCode ? "code" : "circuit")}
              className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-1 text-[10px] font-medium text-brand hover:bg-brand-soft cursor-pointer transition"
              title="Open in Workbench tab"
            >
              <LayoutGrid size={11} />
              <span>Workbench</span>
            </button>
          )}
          <button
            type="button"
            onClick={onExpand}
            className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-1 text-[10px] font-medium text-quiet hover:text-ink hover:bg-subtle cursor-pointer transition"
          >
            <ZoomIn size={11} />
            <span>Expand</span>
          </button>
        </div>
      </div>
      {isCode ? (
        <div className="bg-slate-950 p-3">
          <pre className="max-h-60 overflow-auto font-mono text-[10.5px] leading-relaxed text-slate-100">
            <code>{artifact.project.firmware.source}</code>
          </pre>
        </div>
      ) : (
        <button
          type="button"
          onClick={onExpand}
          className="group block w-full bg-canvas p-3 text-left cursor-pointer transition hover:bg-subtle"
          aria-label={`Expand and zoom ${label}`}
        >
          <div className="flex h-auto max-h-56 w-full items-center justify-center overflow-hidden">
            {artifact.kind === "schematic" ? <SchematicView project={artifact.project} /> : <BreadboardView project={artifact.project} />}
          </div>
          <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] font-medium text-quiet group-hover:text-brand">
            <ZoomIn size={12} /> Click to expand &amp; zoom
          </div>
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
      className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[10px] font-medium text-brand hover:bg-brand-soft cursor-pointer"
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
        <button type="button" className="text-[10px] text-slate-200 hover:text-white cursor-pointer" onClick={() => void navigator.clipboard.writeText(codeRef.current?.textContent ?? "")}>Copy code</button>
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

function DatabaseSchemaView({
  project,
  onOpenView,
}: {
  project: Project;
  onOpenView: (subView: WorkbenchSubView) => void;
}) {
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);

  // Group connections by component and pin
  const connectionsByPin = useMemo(() => {
    const map = new Map<string, Array<{ wireId: string; net: string; color: string; otherComp: string; otherPin: string }>>();
    project.connections.forEach((wire) => {
      const fromKey = `${wire.from.componentId}:${wire.from.pinId}`;
      const toKey = `${wire.to.componentId}:${wire.to.pinId}`;
      const fromComp = project.components.find((c) => c.id === wire.from.componentId);
      const toComp = project.components.find((c) => c.id === wire.to.componentId);

      const fromList = map.get(fromKey) ?? [];
      fromList.push({
        wireId: wire.id,
        net: wire.net,
        color: wire.color,
        otherComp: toComp?.reference ?? wire.to.componentId,
        otherPin: wire.to.pinId,
      });
      map.set(fromKey, fromList);

      const toList = map.get(toKey) ?? [];
      toList.push({
        wireId: wire.id,
        net: wire.net,
        color: wire.color,
        otherComp: fromComp?.reference ?? wire.from.componentId,
        otherPin: wire.from.pinId,
      });
      map.set(toKey, toList);
    });
    return map;
  }, [project]);

  return (
    <div className="min-h-[calc(100vh-125px)] bg-canvas [background-image:radial-gradient(#cbd5e1_1.25px,transparent_1.25px)] [background-size:24px_24px] p-6 sm:p-10">
      <div className="mx-auto max-w-[1400px]">
        {/* ERD Schema Header */}
        <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Database size={18} className="text-brand" />
              <h3 className="text-sm font-bold text-ink-strong uppercase tracking-wider">Hardware Entity Schema (ERD View)</h3>
              <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand-ink">
                {project.components.length} entities · {project.connections.length} relationships
              </span>
            </div>
            <p className="mt-1 text-xs text-body">
              Entity-relationship table view showing component schemas, pin fields, data types, and foreign net relationships.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenView("circuit")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-body hover:bg-subtle cursor-pointer shadow-xs"
            >
              <CircuitBoard size={13} className="text-brand" /> Open CAD Canvas
            </button>
            <button
              type="button"
              onClick={() => onOpenView("code")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-body hover:bg-subtle cursor-pointer shadow-xs"
            >
              <FileCode2 size={13} className="text-brand" /> Open Firmware Code
            </button>
          </div>
        </div>

        {/* ERD Entity Tables Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
          {project.components.map((comp) => {
            const isSelected = selectedComponentId === comp.id;
            return (
              <div
                key={comp.id}
                onClick={() => setSelectedComponentId(isSelected ? null : comp.id)}
                className={cn(
                  "overflow-hidden rounded-2xl border bg-white shadow-panel transition cursor-pointer",
                  isSelected ? "border-brand ring-2 ring-brand/20 shadow-md" : "border-line hover:border-brand/60"
                )}
              >
                {/* Table Header: ERD Entity Title */}
                <div className="flex items-center justify-between border-b border-line bg-subtle/60 px-4 py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white border border-line-soft font-mono text-xs font-bold text-brand shadow-2xs">
                      {comp.reference}
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-ink-strong truncate">{comp.name}</h4>
                      <p className="text-[10px] text-faint font-mono">entity: {comp.partId}</p>
                    </div>
                  </div>
                  <span className={cn(
                    "rounded-md px-2 py-0.5 text-[9px] font-mono uppercase font-semibold shrink-0",
                    comp.category === "controller" ? "bg-controller-soft text-controller" :
                    comp.category === "sensor" ? "bg-sensor-soft text-sensor" :
                    comp.category === "driver" ? "bg-driver-soft text-driver" :
                    comp.category === "power" ? "bg-power-soft text-power" : "bg-chip text-quiet"
                  )}>
                    {comp.category}
                  </span>
                </div>

                {/* Table Schema Fields: Pins & Foreign Net Relationships */}
                <div className="divide-y divide-line-soft/60">
                  <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 bg-inset/50 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-faint">
                    <span>Port</span>
                    <span>Field &amp; Type</span>
                    <span className="text-right">Foreign Link / Net</span>
                  </div>

                  {comp.pins.map((pin) => {
                    const links = connectionsByPin.get(`${comp.id}:${pin.id}`) ?? [];
                    const isLinked = links.length > 0;
                    return (
                      <div
                        key={pin.id}
                        className={cn(
                          "grid grid-cols-[auto_1fr_auto] items-center gap-2.5 px-3 py-2 text-xs transition-colors",
                          isLinked ? "bg-white hover:bg-brand-soft/10" : "bg-subtle/20 text-faint"
                        )}
                      >
                        {/* Port connection dot indicator */}
                        <div className="flex items-center">
                          <span
                            className={cn(
                              "size-2 rounded-full",
                              isLinked
                                ? links[0].color === "red"
                                  ? "bg-red-500 ring-2 ring-red-200"
                                  : links[0].color === "black"
                                  ? "bg-slate-900 ring-2 ring-slate-300"
                                  : "bg-brand ring-2 ring-brand-soft"
                                : "bg-slate-300"
                            )}
                            title={isLinked ? `Connected via ${links[0].net}` : "Unconnected"}
                          />
                        </div>

                        {/* Pin Name & Kind */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px] font-semibold text-ink-strong">{pin.label || pin.id}</span>
                            <span className="rounded bg-chip/60 px-1.5 py-0.5 text-[9px] font-mono text-quiet">{pin.kind}</span>
                          </div>
                        </div>

                        {/* Connected Net / Foreign Key Table Reference */}
                        <div className="text-right">
                          {isLinked ? (
                            <div className="flex flex-col items-end gap-0.5">
                              {links.map((link, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 rounded-md bg-chip px-1.5 py-0.5 text-[9px] font-mono text-ink font-medium"
                                  title={`Connected to ${link.otherComp}.${link.otherPin}`}
                                >
                                  <span className="text-brand">⇄</span>
                                  <span className="truncate max-w-[95px]">{link.otherComp}.{link.otherPin}</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-faint italic">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Table Footer */}
                <div className="flex items-center justify-between border-t border-line-soft bg-subtle/40 px-3.5 py-2 text-[10px] text-quiet">
                  <span>{comp.pins.length} schema fields</span>
                  <span className="text-brand font-medium">Click to inspect</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
