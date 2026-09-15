export interface FileTarget {
  path: string;
  line?: number;
}

/** Local Markdown destinations; web links and anchors retain their normal meaning. */
export function parseFileLink(href: string): FileTarget | undefined {
  let path = href.trim();
  if (!path || path.startsWith("#") || /^(?:https?|mailto|tel|data|javascript|blob):/i.test(path))
    return;
  if (/^file:/i.test(path)) {
    try {
      const url = new URL(path);
      if (url.hostname && url.hostname !== "localhost") return;
      path = url.pathname + url.hash;
    } catch {
      return;
    }
  } else if (
    /^[a-z][a-z\d+.-]*:/i.test(path) &&
    !/^[a-z]:[\\/]/i.test(path) &&
    !/:\d+(?::\d+)?$/.test(path)
  )
    return;
  if (path.startsWith("//") || path.startsWith("\\\\")) return;
  if (/^\/[a-z]:[\\/]/i.test(path)) path = path.slice(1);
  const suffix = path.match(/(?:#L(\d+)(?:C\d+)?(?:-L?\d+)?|:(\d+)(?::\d+)?)$/);
  const line = suffix ? Number(suffix[1] || suffix[2]) : undefined;
  if (suffix) path = path.slice(0, -suffix[0].length);
  else path = path.split("#", 1)[0];
  try {
    path = decodeURIComponent(path);
  } catch {
    return;
  }
  if (!path || Array.from(path).some((char) => char.charCodeAt(0) < 32)) return;
  return { path, ...(line && Number.isSafeInteger(line) ? { line } : {}) };
}

export const filePreviewContext = Symbol("file-preview");
export type OpenFile = (target: FileTarget, base?: string) => void;
