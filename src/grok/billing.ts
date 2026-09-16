export interface BillingInfo {
  label: string;
  tier: string;
  used: number;
  reset: string;
}
export function parseBilling(response: Record<string, unknown>): BillingInfo {
  const config = response.config as {
    creditUsagePercent?: number;
    currentPeriod?: { type?: string; end?: string };
  } | null;
  if (!config?.currentPeriod) throw new Error("账号尚未返回额度周期");
  // Grok TUI uses zero when the successful credits response omits the percentage.
  const value = config.creditUsagePercent ?? 0;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("额度百分比格式无效");
  const type = config.currentPeriod.type || "";
  return {
    label: type.includes("WEEKLY") ? "周额度" : type.includes("MONTHLY") ? "月额度" : "账号额度",
    tier: typeof response.subscription_tier === "string" ? response.subscription_tier : "",
    used: Math.floor(Math.max(0, Math.min(100, value))),
    reset: config.currentPeriod.end || "",
  };
}
