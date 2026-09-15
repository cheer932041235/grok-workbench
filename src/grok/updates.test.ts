import { describe, expect, it } from "vitest";
import { newer, latestRelease, checkRelease } from "./updates";
describe("release checks", () => {
  it("compares numeric versions across each segment", () => {
    expect(newer("0.2.10", "0.2.9")).toBe(true);
    expect(newer("1.0.0", "0.99.99")).toBe(true);
    expect(newer("0.3.0", "0.2.99")).toBe(true);
    expect(newer("0.2.3", "0.2.3")).toBe(false);
    expect(newer("0.2.2", "0.2.3")).toBe(false);
    expect(newer("bad", "0.2.3")).toBe(false);
  });
  it("includes previews and ignores drafts and unrecognized tags", () => {
    expect(
      latestRelease([
        { tag_name: "v0.2.9" },
        { tag_name: "v0.2.10", prerelease: true },
        { tag_name: "v1.0.0", draft: true },
        { tag_name: "nightly" },
        null,
      ]),
    ).toEqual({ version: "0.2.10", preview: true });
    expect(() => latestRelease([])).toThrow();
    expect(() => latestRelease({})).toThrow();
  });
  it("reports rate limits and server failures", async () => {
    await expect(checkRelease(async () => new Response("", { status: 403 }))).rejects.toThrow(
      "次数受限",
    );
    await expect(checkRelease(async () => new Response("", { status: 500 }))).rejects.toThrow(
      "500",
    );
    await expect(
      checkRelease(async () => Response.json([{ tag_name: "v0.2.4", prerelease: true }])),
    ).resolves.toEqual({ version: "0.2.4", preview: true });
  });
});
