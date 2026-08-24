import { describe, expect, it } from "vitest";
import type { OfficialAnnouncement } from "@db/schema";
import { toOfficialAnnouncementDTO } from "./platformDtos";

const announcement = {
  id: 7,
  title: "Atualização",
  content: "O Nexora recebeu uma atualização.",
  contentFormat: "PLAIN_TEXT",
  kind: "UPDATE",
  type: "ANNOUNCEMENT",
  buttonLabel: null,
  buttonUrl: null,
  startsAt: null,
  dismissible: true,
  clicks: 0,
  publishedByUserId: 99,
  isActive: true,
  publishedAt: new Date("2026-08-22T12:00:00Z"),
  expiresAt: null,
  updatedAt: new Date("2026-08-22T12:00:00Z"),
} as OfficialAnnouncement;

describe("official announcement DTO", () => {
  it("uses the fixed verified Nexora identity and never exposes the publisher", () => {
    const dto = toOfficialAnnouncementDTO(announcement);
    expect(dto.sender).toEqual({
      id: "nexora-official",
      name: "Nexora",
      verified: true,
      official: true,
      avatarUrl: "/icon.svg",
    });
    expect(dto.isRead).toBe(false);
    expect(dto).not.toHaveProperty("publishedByUserId");
  });

  it("defaults legacy rows (sem contentFormat) para PLAIN_TEXT", () => {
    const legacy = {
      ...announcement,
      contentFormat: "PLAIN_TEXT" as const,
    };
    const dto = toOfficialAnnouncementDTO(legacy);
    expect(dto.contentFormat).toBe("PLAIN_TEXT");
  });

  it("derives per-user read state only from the read row", () => {
    const readAt = new Date("2026-08-22T13:00:00Z");
    const dto = toOfficialAnnouncementDTO(announcement, readAt);
    expect(dto.isRead).toBe(true);
    expect(dto.readAt).toBe(readAt);
  });
});
