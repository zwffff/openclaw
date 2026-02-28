import { describe, expect, it } from "vitest";
import { parseFeishuMessageContent, parsePostContent } from "./parse-content.js";

describe("parseFeishuMessageContent", () => {
  it("extracts text from text message type", () => {
    const content = JSON.stringify({ text: "Hello world" });
    expect(parseFeishuMessageContent(content, "text")).toBe("Hello world");
  });

  it("extracts textContent from post (rich text) message type", () => {
    const content = JSON.stringify({
      title: "Summary",
      content: [
        [
          { tag: "text", text: "Learn from " },
          { tag: "at", user_name: "Alice", user_id: "ou-alice" },
          { tag: "text", text: " above." },
        ],
      ],
    });
    expect(parseFeishuMessageContent(content, "post")).toBe("Summary\n\nLearn from @Alice above.");
  });

  it("returns raw content for unknown message type", () => {
    const content = JSON.stringify({ text: "fallback" });
    expect(parseFeishuMessageContent(content, "image")).toBe(content);
  });

  it("returns content as-is when JSON parse fails", () => {
    expect(parseFeishuMessageContent("not json", "text")).toBe("not json");
  });
});

describe("parsePostContent", () => {
  it("returns textContent and imageKeys for post with text and image", () => {
    const content = JSON.stringify({
      content: [[{ tag: "text", text: "See image" }], [{ tag: "img", image_key: "img_xxx" }]],
    });
    const out = parsePostContent(content);
    expect(out.textContent).toContain("See image");
    expect(out.imageKeys).toEqual(["img_xxx"]);
  });
});
