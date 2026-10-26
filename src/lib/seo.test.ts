import { describe, expect, it } from "bun:test";
import { BRAND, buildMeta, buildTitle, sanitizeText } from "./seo";

describe("SEO text sanitizers", () => {
  it('normalizes a dash without losing the following space', () => {
    expect(sanitizeText("A  –B")).toBe("A – B");
  });

  it("collapses repeated whitespace", () => {
    expect(sanitizeText("A   B")).toBe("A B");
  });

  it("normalizes editorial hyphens but preserves numeric ranges and lowercase slugs", () => {
    expect(sanitizeText("Management  - Previous Years")).toBe("Management – Previous Years");
    expect(sanitizeText("2024-2025")).toBe("2024-2025");
    expect(sanitizeText("atomic-habits")).toBe("atomic-habits");
  });

  it("builds clean titles", () => {
    expect(buildTitle(["X", "Y", BRAND], 60)).not.toMatch(/ {2,}/);
  });

  it("replaces legacy brand suffixes with the canonical brand", () => {
    expect(buildTitle(["Prepare for Competitive Exams | EduWallet Hub", BRAND])).toBe("Prepare for Competitive Exams | EduWallet");
  });

  it("keeps the brand and respects the title length", () => {
    const title = buildTitle(["X".repeat(105), "EduWallet"], 60);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith("| EduWallet")).toBe(true);
    expect(title).not.toMatch(/\|\||\s\|$/);
  });

  it("cuts metadata at a word boundary and appends a period, not an ellipsis", () => {
    const meta = buildMeta("word ".repeat(32).trim(), 158);
    expect(meta.length).toBeLessThanOrEqual(158);
    expect(meta.endsWith(".")).toBe(true);
    expect(meta).not.toContain("…");
  });
});
