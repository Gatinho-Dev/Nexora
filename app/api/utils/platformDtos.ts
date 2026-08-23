import type {
  OfficialAnnouncementDTO,
  PlatformBadgeDTO,
  UserBadgeDTO,
} from "@contracts/types";
import type {
  OfficialAnnouncement,
  PlatformBadge,
  UserBadge,
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
    kind: announcement.kind,
    publishedAt: announcement.publishedAt,
    expiresAt: announcement.expiresAt,
    isActive: announcement.isActive,
    isRead: readAt !== null,
    readAt,
    sender: OFFICIAL_SENDER,
  };
}

export function toPlatformBadgeDTO(badge: PlatformBadge): PlatformBadgeDTO {
  return {
    id: badge.id,
    slug: badge.slug,
    label: badge.label,
    description: badge.description,
    icon: badge.icon,
    color: badge.color,
    isStaff: badge.isStaff,
  };
}

export function toUserBadgeDTO(
  badge: PlatformBadge,
  assignment: UserBadge,
): UserBadgeDTO {
  return {
    ...toPlatformBadgeDTO(badge),
    assignedAt: assignment.assignedAt,
  };
}
