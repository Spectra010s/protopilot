import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { z } from "zod";
import { ProjectSchema, type Project } from "@/lib/project/schema";
import { createId } from "@/lib/id";

const DB_NAME = "protopilot.v1";
const DB_VERSION = 1;
const LEGACY_LOCAL_STORAGE_KEY = "protopilot:project:v1";

export type ProjectDraftSummary = { id: string; title: string; updatedAt: number };
export type ProjectConversationMessage = {
  id: string;
  projectId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};
export type ProjectImageAsset = {
  id: string;
  projectId: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: number;
};

type StoredProject = { id: string; title: string; updatedAt: number; project: unknown };
type StoredImage = ProjectImageAsset & { blob: Blob };

interface ProtoPilotDatabase extends DBSchema {
  projects: { key: string; value: StoredProject };
  messages: {
    key: string;
    value: ProjectConversationMessage;
    indexes: { "by-project-created": [string, number] };
  };
  images: {
    key: string;
    value: StoredImage;
    indexes: { "by-project": string };
  };
}

let databasePromise: Promise<IDBPDatabase<ProtoPilotDatabase>> | undefined;

function indexedDbAvailable() {
  try { return typeof indexedDB !== "undefined"; }
  catch { return false; }
}

function getDatabase(): Promise<IDBPDatabase<ProtoPilotDatabase>> {
  if (!indexedDbAvailable()) return Promise.reject(new Error("IndexedDB is not available in this browser."));
  if (!databasePromise) {
    databasePromise = openDB<ProtoPilotDatabase>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        database.createObjectStore("projects", { keyPath: "id" });
        const messages = database.createObjectStore("messages", { keyPath: "id" });
        messages.createIndex("by-project-created", ["projectId", "createdAt"]);
        const images = database.createObjectStore("images", { keyPath: "id" });
        images.createIndex("by-project", "projectId");
      },
      blocked() {
        console.warn("ProtoPilot storage upgrade is blocked by another open tab.");
      },
      blocking() {
        databasePromise = undefined;
      },
      terminated() {
        databasePromise = undefined;
      },
    }).catch((error: unknown) => {
      databasePromise = undefined;
      throw error;
    });
  }
  return databasePromise;
}

export async function saveProjectDraft(project: Project): Promise<void> {
  const database = await getDatabase();
  await database.put("projects", { id: project.id, title: project.title, updatedAt: Date.now(), project });
}

export async function getProjectDraft(id: string): Promise<Project | null> {
  const database = await getDatabase();
  const stored = await database.get("projects", id);
  const parsed = stored ? ProjectSchema.safeParse(stored.project) : null;
  return parsed?.success ? parsed.data : null;
}

export async function listProjectDrafts(): Promise<ProjectDraftSummary[]> {
  const database = await getDatabase();
  const rows = await database.getAll("projects");
  return rows.flatMap((row) => {
    const parsed = ProjectSchema.safeParse(row.project);
    return parsed.success ? [{ id: parsed.data.id, title: parsed.data.title, updatedAt: row.updatedAt }] : [];
  }).sort((a, b) => b.updatedAt - a.updatedAt);
}

async function migrateLegacyDraft(): Promise<void> {
  if (typeof window === "undefined") return;
  let raw: string | null;
  try { raw = window.localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY); }
  catch { return; }
  if (!raw) return;

  try {
    const parsed = ProjectSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return;
    const database = await getDatabase();
    if (!(await database.get("projects", parsed.data.id))) {
      await saveProjectDraft(parsed.data);
    }
    window.localStorage.removeItem(LEGACY_LOCAL_STORAGE_KEY);
  } catch (error) {
    console.warn("Could not migrate the previous browser draft to IndexedDB.", error);
  }
}

export async function getMostRecentProjectDraft(): Promise<Project | null> {
  await migrateLegacyDraft();
  const database = await getDatabase();
  const rows = await database.getAll("projects");
  rows.sort((a, b) => b.updatedAt - a.updatedAt);
  for (const row of rows) {
    const parsed = ProjectSchema.safeParse(row.project);
    if (parsed.success) return parsed.data;
  }
  return null;
}

const ConversationMessageSchema = z.object({
  id: z.string().min(1), projectId: z.string().min(1),
  role: z.enum(["user", "assistant"]), content: z.string(), createdAt: z.number(),
});

export async function listProjectMessages(projectId: string): Promise<ProjectConversationMessage[]> {
  const database = await getDatabase();
  const range = IDBKeyRange.bound([projectId, 0], [projectId, Number.MAX_SAFE_INTEGER]);
  const rows = await database.getAllFromIndex("messages", "by-project-created", range);
  return rows.flatMap((row) => {
    const parsed = ConversationMessageSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

export async function addProjectMessage(
  projectId: string,
  role: ProjectConversationMessage["role"],
  content: string,
): Promise<ProjectConversationMessage> {
  const message = ConversationMessageSchema.parse({ id: createId(), projectId, role, content, createdAt: Date.now() });
  const database = await getDatabase();
  await database.put("messages", message);
  return message;
}

export async function saveProjectImage(projectId: string, blob: Blob, name: string): Promise<ProjectImageAsset> {
  if (!blob.type.startsWith("image/")) throw new Error("Only image files can be stored as project assets.");
  const asset: StoredImage = {
    id: createId(), projectId, name: name.trim() || "image",
    mimeType: blob.type, size: blob.size, createdAt: Date.now(), blob,
  };
  const database = await getDatabase();
  await database.put("images", asset);
  const { blob: _blob, ...metadata } = asset;
  return metadata;
}

export async function getProjectImage(id: string): Promise<{ asset: ProjectImageAsset; blob: Blob } | null> {
  const database = await getDatabase();
  const stored = await database.get("images", id);
  if (!stored) return null;
  const { blob, ...asset } = stored;
  return { asset, blob };
}

export async function listProjectImages(projectId: string): Promise<ProjectImageAsset[]> {
  const database = await getDatabase();
  const rows = await database.getAllFromIndex("images", "by-project", projectId);
  return rows.map(({ blob: _blob, ...asset }) => asset).sort((a, b) => a.createdAt - b.createdAt);
}

export async function deleteProjectImage(id: string): Promise<void> {
  const database = await getDatabase();
  await database.delete("images", id);
}
