import { normalizeFeishuExternalKey } from "./external-keys.js";

/**
 * Parse post (rich text) content and extract text and embedded image keys.
 * Post structure: { title?: string, content: [[{ tag, text?, image_key?, ... }]] }
 */
export function parsePostContent(content: string): {
  textContent: string;
  imageKeys: string[];
  mentionedOpenIds: string[];
} {
  try {
    const parsed = JSON.parse(content);
    const title = parsed.title || "";
    const contentBlocks = parsed.content || [];
    let textContent = title ? `${title}\n\n` : "";
    const imageKeys: string[] = [];
    const mentionedOpenIds: string[] = [];

    for (const paragraph of contentBlocks) {
      if (Array.isArray(paragraph)) {
        for (const element of paragraph) {
          if (element.tag === "text") {
            textContent += element.text || "";
          } else if (element.tag === "a") {
            textContent += element.text || element.href || "";
          } else if (element.tag === "at") {
            textContent += `@${element.user_name || element.user_id || ""}`;
            if (element.user_id) {
              mentionedOpenIds.push(element.user_id);
            }
          } else if (element.tag === "img" && element.image_key) {
            const imageKey = normalizeFeishuExternalKey(element.image_key);
            if (imageKey) {
              imageKeys.push(imageKey);
            }
          }
        }
        textContent += "\n";
      }
    }

    return {
      textContent: textContent.trim() || "[Rich text message]",
      imageKeys,
      mentionedOpenIds,
    };
  } catch {
    return { textContent: "[Rich text message]", imageKeys: [], mentionedOpenIds: [] };
  }
}

/**
 * Parse Feishu message content by type into plain text for agent context.
 * Handles text, post (rich text), and falls back to raw content for other types.
 */
export function parseFeishuMessageContent(content: string, messageType: string): string {
  try {
    const parsed = JSON.parse(content);
    if (messageType === "text") {
      return parsed.text ?? "";
    }
    if (messageType === "post") {
      const { textContent } = parsePostContent(content);
      return textContent;
    }
    return content;
  } catch {
    return content;
  }
}
