import { expect, it } from "vitest";
import { parseBilling } from "./billing";
it("reads real weekly credits shape including omitted zero percentage", () => {
  const data = {
    config: { currentPeriod: { type: "USAGE_PERIOD_TYPE_WEEKLY", end: "2026-09-23T02:28:38Z" } },
    subscription_tier: "SuperGrok Heavy",
  };
  expect(parseBilling(data)).toEqual({
    label: "周额度",
    tier: "SuperGrok Heavy",
    used: 0,
    reset: "2026-09-23T02:28:38Z",
  });
  expect(parseBilling({ ...data, config: { ...data.config, creditUsagePercent: 99.9 } }).used).toBe(
    99,
  );
});
it("does not treat unavailable billing as zero", () => {
  expect(() => parseBilling({ config: null })).toThrow();
});
