import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTabs } from "./tabs.ts";

describe("createTabs", () => {
  it("opens a note as the active tab", () => {
    const tabs = createTabs();
    tabs.open("a");
    assert.deepEqual([...tabs.ids], ["a"]);
    assert.equal(tabs.active, "a");
  });

  it("keeps several notes open and activates the latest", () => {
    const tabs = createTabs();
    tabs.open("a");
    tabs.open("b");
    tabs.open("c");
    assert.deepEqual([...tabs.ids], ["a", "b", "c"]);
    assert.equal(tabs.active, "c");
    assert.equal(tabs.has("a"), true);
    assert.equal(tabs.has("z"), false);
  });

  it("does not duplicate a note that is already open", () => {
    const tabs = createTabs();
    tabs.open("a");
    tabs.open("b");
    tabs.open("a");
    assert.deepEqual([...tabs.ids], ["a", "b"]);
    assert.equal(tabs.active, "a");
  });

  it("closes the active tab and activates the neighbor to the right", () => {
    const tabs = createTabs();
    tabs.open("a");
    tabs.open("b");
    tabs.open("c");
    tabs.open("b");
    assert.equal(tabs.close("b"), "c");
    assert.deepEqual([...tabs.ids], ["a", "c"]);
    assert.equal(tabs.active, "c");
  });

  it("closes the last tab and activates the neighbor to the left", () => {
    const tabs = createTabs();
    tabs.open("a");
    tabs.open("b");
    assert.equal(tabs.close("b"), "a");
    assert.equal(tabs.active, "a");
  });

  it("clears the active tab when the last open note is closed", () => {
    const tabs = createTabs();
    tabs.open("a");
    assert.equal(tabs.close("a"), "");
    assert.deepEqual([...tabs.ids], []);
    assert.equal(tabs.active, "");
  });

  it("keeps the active tab when an inactive tab is closed", () => {
    const tabs = createTabs();
    tabs.open("a");
    tabs.open("b");
    assert.equal(tabs.close("a"), "b");
    assert.equal(tabs.active, "b");
  });

  it("ignores closing a note that is not open", () => {
    const tabs = createTabs();
    tabs.open("a");
    assert.equal(tabs.close("missing"), "a");
    assert.deepEqual([...tabs.ids], ["a"]);
  });

  it("deactivates without closing open notes", () => {
    const tabs = createTabs();
    tabs.open("a");
    tabs.open("b");
    tabs.deactivate();
    assert.equal(tabs.active, "");
    assert.deepEqual([...tabs.ids], ["a", "b"]);
  });

  it("cycles forward and wraps around", () => {
    const tabs = createTabs();
    tabs.open("a");
    tabs.open("b");
    tabs.open("c");
    assert.equal(tabs.cycle(1), "a");
    assert.equal(tabs.cycle(1), "b");
    assert.equal(tabs.cycle(1), "c");
  });

  it("cycles backward and wraps around", () => {
    const tabs = createTabs();
    tabs.open("a");
    tabs.open("b");
    tabs.open("c");
    assert.equal(tabs.cycle(-1), "b");
    assert.equal(tabs.cycle(-1), "a");
    assert.equal(tabs.cycle(-1), "c");
  });

  it("activates the first tab when cycling from home", () => {
    const tabs = createTabs();
    tabs.open("a");
    tabs.open("b");
    tabs.deactivate();
    assert.equal(tabs.cycle(1), "a");
  });

  it("activates the last tab when cycling backward from home", () => {
    const tabs = createTabs();
    tabs.open("a");
    tabs.open("b");
    tabs.deactivate();
    assert.equal(tabs.cycle(-1), "b");
  });
});
