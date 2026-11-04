import { describe, expect, it } from "vitest";

import { defaultPostPlatforms, platformChoices, usedPlatforms } from "../accounts";
import type { PlatformId } from "../platforms";

const account = (platform: PlatformId, status = "todo", defaultOnPosts = false) => ({
  platform,
  status,
  defaultOnPosts,
});

const accounts = [
  account("facebook", "active", true),
  account("instagram", "active", true),
  account("tiktok", "todo", false),
  account("youtube", "unused", true),
  account("linkedin", "in_progress", false),
];

describe("réseaux de la marque", () => {
  it("garde les réseaux utilisés, dans l'ordre habituel", () => {
    expect(usedPlatforms(accounts)).toEqual(["instagram", "tiktok", "linkedin", "facebook"]);
  });

  it("coche d'office les réseaux choisis, sauf ceux non utilisés", () => {
    expect(defaultPostPlatforms(accounts)).toEqual(["instagram", "facebook"]);
  });

  it("propose aussi un réseau non utilisé s'il est déjà choisi sur le post", () => {
    expect(platformChoices(accounts, ["youtube"])).toEqual(["instagram", "tiktok", "youtube", "linkedin", "facebook"]);
    expect(platformChoices(accounts)).not.toContain("youtube");
  });

  it("sans fiches de comptes : tous les réseaux, Instagram et TikTok cochés", () => {
    expect(usedPlatforms([])).toHaveLength(6);
    expect(defaultPostPlatforms([])).toEqual(["instagram", "tiktok"]);
  });
});
