import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  displayMarkdown,
  extForImage,
  imageAlt,
  imageFileName,
  imageSrcInNote,
  imageWritePath,
  localImagePaths,
  markdownImage,
  noteDir,
  resolveAssetUrl,
  storageMarkdown,
} from "./images.ts";

describe("image paths", () => {
  it("splits the note directory from a nested markdown path", () => {
    assert.equal(noteDir("work/meet.md"), "work");
    assert.equal(noteDir("meet.md"), "");
  });

  it("writes images next to the note", () => {
    assert.equal(imageWritePath("meet.md", "meet-1.png"), "images/meet-1.png");
    assert.equal(imageWritePath("work/meet.md", "meet-1.png"), "work/images/meet-1.png");
    assert.equal(imageSrcInNote("work/images/meet-1.png", "work/meet.md"), "images/meet-1.png");
  });

  it("picks an extension from the file type", () => {
    assert.equal(extForImage({ type: "image/png" }), ".png");
    assert.equal(extForImage({ type: "image/jpeg", name: "cut.jpeg" }), ".jpg");
    assert.equal(extForImage({ type: "application/octet-stream", name: "shot.WEBP" }), ".webp");
  });

  it("names a screenshot after the note", () => {
    assert.equal(imageFileName("work/周会.md", ".png", "abc"), "周会-abc.png");
    assert.equal(imageAlt({ name: "image.png" }), "图片");
    assert.equal(imageAlt({ name: "白板.png" }), "白板");
    assert.equal(markdownImage("白板", "images/a.png"), "![白板](images/a.png)\n");
  });

  it("rewrites relative images for the desktop preview and back", () => {
    const noteId = "work/meet.md";
    const stored = "见 ![](images/a.png) 和 [链接](https://example.com)";
    const shown = displayMarkdown(stored, noteId);
    assert.equal(shown, "见 ![](/~notes/work/images/a.png) 和 [链接](https://example.com)");
    assert.equal(storageMarkdown(shown, noteId), stored);
    assert.equal(resolveAssetUrl("images/a.png", "meet.md"), "/~notes/images/a.png");
  });

  it("lists local image paths for cleanup", () => {
    assert.deepEqual(localImagePaths("x ![](images/a.png) y ![](https://e.com/b.png) ![](data:image/png;base64,aa)"), ["images/a.png"]);
  });
});
