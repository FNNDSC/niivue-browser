import { expect, test } from "vitest";
import { Mesh } from "./visualstate";

test("Mesh.name", () => {
  console.log("test started");
  expect(
    Mesh.create("https://example.org/data/subj05/lh.wm._81920.mz3", []).name,
  ).toBe("lh.wm._81920.mz3");
  expect(
    Mesh.create("https://example.org/data/subj22/rh.innersp.mz3", []).name,
  ).toBe("rh.innersp.mz3");
});

test("Mesh.layerUrls", () => {
  const meshUrl = "https://example.org/data/subj05/lh.wm._81920.mz3";
  const meshOverlays = [
    "https://example.org/data/subj05/lh.innersp.disterr.mz3",
    "https://example.org/data/subj05/lh.innersp.disterr.abs.mz3",
    "https://example.org/data/subj05/lh.innersp.smtherr.mz3",
    "https://example.org/data/subj05/lh.innersp.tlink_0mm.mz3",
    "https://example.org/data/subj05/lh.innersp.tlink_5mm.mz3",
    "https://example.org/data/subj05/rh.innersp.disterr.mz3",
    "https://example.org/data/subj05/rh.innersp.disterr.abs.mz3",
    "https://example.org/data/subj05/rh.innersp.smtherr.mz3",
    "https://example.org/data/subj05/rh.innersp.tlink_0mm.mz3",
    "https://example.org/data/subj05/rh.innersp.tlink_5mm.mz3",
    "https://example.org/data/subj05/lh.wm._81920.disterr.mz3",
    "https://example.org/data/subj05/lh.wm._81920.disterr.abs.mz3",
    "https://example.org/data/subj05/lh.wm._81920.smtherr.mz3",
    "https://example.org/data/subj05/lh.wm._81920.tlink_0mm.mz3",
    "https://example.org/data/subj05/lh.wm._81920.tlink_5mm.mz3",
    "https://example.org/data/subj05/rh.wm._81920.disterr.mz3",
    "https://example.org/data/subj05/rh.wm._81920.disterr.abs.mz3",
    "https://example.org/data/subj05/rh.wm._81920.smtherr.mz3",
    "https://example.org/data/subj05/rh.wm._81920.tlink_0mm.mz3",
    "https://example.org/data/subj05/rh.wm._81920.tlink_5mm.mz3",
  ];
  const expectedOverlays = [
    "https://example.org/data/subj05/lh.wm._81920.disterr.mz3",
    "https://example.org/data/subj05/lh.wm._81920.disterr.abs.mz3",
    "https://example.org/data/subj05/lh.wm._81920.smtherr.mz3",
    "https://example.org/data/subj05/lh.wm._81920.tlink_0mm.mz3",
    "https://example.org/data/subj05/lh.wm._81920.tlink_5mm.mz3",
  ];
  expect(Mesh.create(meshUrl, meshOverlays).layerUrls).toStrictEqual(
    expectedOverlays,
  );
});
