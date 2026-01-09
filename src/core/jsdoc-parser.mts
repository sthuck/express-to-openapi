import { JSDocableNode, Node } from "ts-morph";
import { JSDocInfo } from "../types/internal.mjs";

export function parseJsDoc(node: Node): JSDocInfo | null {
  let jsDocs = (node as unknown as JSDocableNode).getJsDocs();

  if (jsDocs.length === 0) {
    let current = node.getParent();

    while (current && jsDocs.length === 0) {
      if ("getJsDocs" in current && typeof current.getJsDocs === "function") {
        jsDocs = (current as unknown as JSDocableNode).getJsDocs();
      }

      if (jsDocs.length > 0 || Node.isSourceFile(current)) {
        break;
      }

      current = current.getParent();
    }
  }

  if (jsDocs.length === 0) {
    return null;
  }

  const jsDoc = jsDocs[0];
  const tags = new Map<string, string>();

  let description: string | undefined;
  let summary: string | undefined;

  const descriptionText = jsDoc.getDescription().trim();
  if (descriptionText) {
    description = descriptionText;
  }

  const jsDocTags = jsDoc.getTags();

  for (const tag of jsDocTags) {
    const tagName = tag.getTagName();
    const tagText = tag.getComment();
    const commentText = typeof tagText === "string" ? tagText : "";

    if (tagName === "summary") {
      summary = commentText.trim();
    } else if (tagName === "description") {
      description = commentText.trim();
    } else {
      tags.set(tagName, commentText.trim());
    }
  }

  if (!description && !summary && tags.size === 0) {
    return null;
  }

  return {
    summary,
    description,
    tags,
  };
}
