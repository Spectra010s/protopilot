import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { plantProject } from "@/lib/project/demo-project";
import {
  addProjectMessage,
  getMostRecentProjectDraft,
  getProjectDraft,
  getProjectImage,
  listProjectDrafts,
  listProjectImages,
  listProjectMessages,
  saveProjectDraft,
  saveProjectImage,
} from "@/lib/storage/indexeddb";

async function main() {
const project = { ...plantProject, id: "storage-smoke", revision: 0 };
await saveProjectDraft(project);
assert.equal((await getProjectDraft(project.id))?.id, project.id);
assert.equal((await listProjectDrafts()).some((item) => item.id === project.id), true);

const sent = await addProjectMessage(project.id, "user", "Please explain the MOSFET.");
await addProjectMessage(project.id, "assistant", "It switches the pump current.");
const history = await listProjectMessages(project.id);
assert.equal(history.length, 2);
assert.equal(history[0].id, sent.id);

const svg = new Blob(["<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 10 10\"><circle cx=\"5\" cy=\"5\" r=\"4\"/></svg>"], { type: "image/svg+xml" });
const image = await saveProjectImage(project.id, svg, "schematic.svg");
const storedImage = await getProjectImage(image.id);
assert.equal(storedImage?.asset.mimeType, "image/svg+xml");
assert.equal(await storedImage?.blob.text(), await svg.text());
assert.equal((await listProjectImages(project.id))[0]?.id, image.id);

const legacyProject = { ...plantProject, id: "legacy-local-draft", revision: 1 };
const memoryStorage = new Map([["protopilot:project:v1", JSON.stringify(legacyProject)]]);
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { localStorage: {
    getItem: (key: string) => memoryStorage.get(key) ?? null,
    removeItem: (key: string) => { memoryStorage.delete(key); },
  } },
});
assert.equal((await getMostRecentProjectDraft())?.id, legacyProject.id);
assert.equal(memoryStorage.has("protopilot:project:v1"), false);

console.log("IndexedDB smoke check passed: project, messages, SVG Blob, and legacy migration.");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
