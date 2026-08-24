import type { Badge, UserBadge } from "@db/schema";
import type { BadgeDTO, UserBadgeDTO } from "@contracts/types";

export function toBadgeDTO(badge: Badge): BadgeDTO {
  return {
    id: badge.id,
    slug: badge.slug,
    name: badge.name,
    description: badge.description,
    icon: badge.icon,
    category: badge.category,
    rarity: badge.rarity,
    grantType: badge.grantType,
    permanent: badge.permanent,
    visible: badge.visible,
    canHide: badge.canHide,
    displayOrder: badge.displayOrder,
    restricted: badge.restricted,
  };
}

export function toUserBadgeDTO(badge: Badge, userBadge: UserBadge): UserBadgeDTO {
  return {
    ...toBadgeDTO(badge),
    grantedAt: userBadge.grantedAt,
    grantSource: userBadge.grantSource,
    expiresAt: userBadge.expiresAt,
  };
}
