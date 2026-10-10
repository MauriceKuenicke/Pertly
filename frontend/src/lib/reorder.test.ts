import { describe, expect, it } from "vitest";
import { dropIndex, moveItem } from "./reorder";

describe("moveItem", () => {
  const list = ["a", "b", "c", "d"];

  it("moves an item down and up without mutating the input", () => {
    expect(moveItem(list, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(list, 3, 1)).toEqual(["a", "d", "b", "c"]);
    expect(list).toEqual(["a", "b", "c", "d"]);
  });

  it("clamps the target and ignores an out-of-range source", () => {
    expect(moveItem(list, 1, 99)).toEqual(["a", "c", "d", "b"]);
    expect(moveItem(list, 2, -5)).toEqual(["c", "a", "b", "d"]);
    expect(moveItem(list, 7, 0)).toEqual(list);
  });
});

describe("dropIndex", () => {
  const list = ["a", "b", "c", "d"];
  const drop = (from: number, over: number, position: "before" | "after") =>
    moveItem(list, from, dropIndex(from, over, position));

  it("inserts between two items when dragging downwards", () => {
    expect(drop(0, 2, "before")).toEqual(["b", "a", "c", "d"]);
    expect(drop(0, 2, "after")).toEqual(["b", "c", "a", "d"]);
  });

  it("inserts between two items when dragging upwards", () => {
    expect(drop(3, 1, "before")).toEqual(["a", "d", "b", "c"]);
    expect(drop(3, 1, "after")).toEqual(["a", "b", "d", "c"]);
  });

  it("supports the very first and very last slot", () => {
    expect(drop(2, 0, "before")).toEqual(["c", "a", "b", "d"]);
    expect(drop(1, 3, "after")).toEqual(["a", "c", "d", "b"]);
  });

  it("leaves the list unchanged when dropped onto its own position", () => {
    expect(drop(1, 1, "before")).toEqual(list);
    expect(drop(1, 1, "after")).toEqual(list);
    expect(drop(1, 0, "after")).toEqual(list);
    expect(drop(1, 2, "before")).toEqual(list);
  });
});
