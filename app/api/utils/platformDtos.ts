import type {
  OfficialAnnouncementDTO,
} from "@contracts/types";
import type {
  OfficialAnnouncement,
} from "@db/schema";

const OFFICIAL_SENDER = {
  id: "nexora-official",
  name: "Nexora",
  verified: true,
  official: true,
  avatarUrl: "/icon.svg",
} as const;

export function toOfficialAnnouncementDTO(
  announcement: OfficialAnnouncement,
  readAt: Date | null = null,
): OfficialAnnouncementDTO {
  return {
    id: announcement.id,
    title: announcement.title,
    content: announcement.content,
    contentFormat: announcement.contentFormat ?? "PLAIN_TEXT",
    kind: announcement.kind,
    type: announcement.type,
    buttonLabel: announcement.buttonLabel,
    buttonUrl: announcement.buttonUrl,
    startsAt: announcement.startsAt,
    expiresAt: announcement.expiresAt,
    dismissible: announcement.dismissible,
    clicks: announcement.clicks,
    publishedAt: announcement.publishedAt,
    isActive: announcement.isActive,
    isRead: readAt !== null,
    readAt,
    sender: OFFICIAL_SENDER,
  };
}
