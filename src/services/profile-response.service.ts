import { Prisma } from '@prisma/client';
import { mapProfileManagerToPublicUrls, toPublicMediaUrl } from '../middleware/upload';
import { enrichSafeUser } from './user-display.service';
import { formatPartnerPreferencesList } from './partner-preference.service';
import { getProfileCompletion, maskEmail, maskPhone } from '../utils/helpers';
import { serialize } from '../utils/response';

export const FULL_PROFILE_INCLUDE = {
  profileManager: true,
  trustBadge: true,
  partnerPreferences: true,
  familyInformation: true,
  religiousInfo: true,
  subscriptions: {
    include: { plan: true, variant: true },
    orderBy: { created_at: 'desc' as const },
    take: 5,
  },
} satisfies Prisma.UserInclude;

type FullProfileUser = Record<string, unknown>;

function applyProfileMediaUrls(user: Record<string, unknown>): Record<string, unknown> {
  const out = { ...user };

  if (out.profileManager && typeof out.profileManager === 'object') {
    out.profileManager = mapProfileManagerToPublicUrls(out.profileManager as Record<string, unknown>);
    const manager = out.profileManager as Record<string, unknown>;
    if (manager.profile_image) {
      out.profile_image = manager.profile_image;
    }
  }

  if (out.profile_picture) {
    out.profile_picture = toPublicMediaUrl(String(out.profile_picture));
    if (!out.profile_image) {
      out.profile_image = out.profile_picture;
    }
  }

  if (out.trustBadge && typeof out.trustBadge === 'object') {
    const badge = { ...(out.trustBadge as Record<string, unknown>) };
    if (badge.image) badge.image = toPublicMediaUrl(String(badge.image));
    if (badge.image2) badge.image2 = toPublicMediaUrl(String(badge.image2));
    out.trustBadge = badge;
  }

  return out;
}

export type BuildFullProfileOptions = {
  /** Mask email and phone — use when viewing another member's profile */
  maskContact?: boolean;
  /** Hide subscription history — default true when maskContact is true */
  hideSubscriptions?: boolean;
};

/** Same payload shape as GET /me/profile — user + completion */
export async function buildFullProfileResponse(user: FullProfileUser, options: BuildFullProfileOptions = {}) {
  const hideSubscriptions = options.hideSubscriptions ?? Boolean(options.maskContact);
  const { password: _p, remember_token: _r, ...rest } = user;

  const safe: Record<string, unknown> = { ...rest };

  if (options.maskContact) {
    safe.contact_number = maskPhone(String(user.contact_number ?? ''));
    safe.email = maskEmail(String(user.email ?? ''));
  }

  if (hideSubscriptions) {
    delete safe.subscriptions;
  }

  if (Array.isArray(safe.partnerPreferences)) {
    safe.partnerPreferences = formatPartnerPreferencesList(safe.partnerPreferences as never);
  } else {
    safe.partnerPreferences = [];
  }

  if (!Array.isArray(safe.familyInformation)) {
    safe.familyInformation = [];
  }

  if (!Array.isArray(safe.religiousInfo)) {
    safe.religiousInfo = [];
  }

  const enriched = applyProfileMediaUrls((await enrichSafeUser(safe)) as Record<string, unknown>);

  return {
    user: serialize(enriched),
    completion: getProfileCompletion(user as never),
  };
}
