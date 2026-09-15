export const releasesApi =
  "https://api.github.com/repos/cheer932041235/grok-workbench/releases?per_page=20";
export type Release = { version: string; preview: boolean };
function parts(version: string): number[] | undefined {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version);
  return match ? match.slice(1).map(Number) : undefined;
}
export function newer(candidate: string, current: string): boolean {
  const a = parts(candidate),
    b = parts(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}
export function latestRelease(data: unknown): Release {
  if (!Array.isArray(data)) throw new Error("GitHub 返回的版本列表无法读取");
  let latest: Release | undefined;
  for (const item of data) {
    if (!item || item.draft || typeof item.tag_name !== "string" || !parts(item.tag_name)) continue;
    const version = item.tag_name.replace(/^v/, "");
    if (!latest || newer(version, latest.version))
      latest = { version, preview: item.prerelease === true };
  }
  if (!latest) throw new Error("暂未找到可用版本，请查看发布页面");
  return latest;
}
export async function checkRelease(fetcher: typeof fetch = fetch): Promise<Release> {
  const response = await fetcher(releasesApi, {
    headers: { Accept: "application/vnd.github+json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(
      response.status === 403 || response.status === 429
        ? "GitHub 查询次数受限，请稍后再试"
        : `查询失败（HTTP ${response.status}）`,
    );
  return latestRelease(await response.json());
}
