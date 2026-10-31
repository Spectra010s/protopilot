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
await addProjectMessage(project.id, "assistant", "", { kind: "code", project });
const history = await listProjectMessages(project.id);
assert.equal(history.length, 3);
assert.equal(history[0].id, sent.id);
assert.equal(history[2].artifact?.kind, "code");

const svg = new Blob(["<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 10 10\"><circle cx=\"5\" cy=\"5\" r=\"4\"/></svg>"], { type: "image/svg+xml" });
const image = await saveProjectImage(project.id, svg, "schematic.svg");
const storedImage = await getProjectImage(image.id);
assert.equal(storedImage?.asset.mimeType, "image/svg+xml");
assert.equal(await storedImage?.blob.text(), await svg.text());
assert.equal((await listProjectImages(project.id))[0]?.id, image.id);

assert.equal((await getMostRecentProjectDraft())?.id, project.id);

console.log("IndexedDB smoke check passed: project, messages, artifact, and SVG Blob.");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
