import { describe, expect, it } from "vitest";

import { DEFAULT_AI_SETTINGS } from "../ai/settings";
import { onboardingSteps } from "../onboarding";
import type { AccountDTO, PostDTO } from "../types";

const account = (overrides: Partial<AccountDTO>): AccountDTO => ({
  id: 1,
  platform: "instagram",
  status: "todo",
  handle: "",
  profileUrl: "",
  accountType: "business",
  bio: "",
  bioLink: "",
  followersGoal: null,
  postsPerWeek: null,
  defaultOnPosts: false,
  notes: "",
  avatarUrl: null,
  updatedAt: 0,
  checklist: [],
  ...overrides,
});

const done = (steps: ReturnType<typeof onboardingSteps>) => steps.filter((s) => s.done).map((s) => s.id);

describe("onboardingSteps", () => {
  it("ne coche rien sur une installation neuve", () => {
    expect(done(onboardingSteps({ ai: DEFAULT_AI_SETTINGS, accounts: [account({})] }, []))).toEqual([]);
  });

  it("coche ce qui est déjà rempli", () => {
    const ai = { ...DEFAULT_AI_SETTINGS, model: "ministral", brand: { ...DEFAULT_AI_SETTINGS.brand, description: "Une app" } };
    const accounts = [account({ handle: "marque", postsPerWeek: 3 })];
    const posts = [{ scheduledAt: 1 } as PostDTO];
    expect(done(onboardingSteps({ ai, accounts }, posts))).toEqual([
      "brand",
      "accounts",
      "rhythm",
      "ai",
      "post",
      "schedule",
    ]);
  });
});
