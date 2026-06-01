/** Single source of truth for enum-like fields — used by validators, Swagger, and GET /reference/field-options */

export type FieldOption = { value: string; label: string; description: string };

export const FIELD_OPTIONS = {
  gender: [
    { value: 'male', label: 'Male', description: 'Male member' },
    { value: 'female', label: 'Female', description: 'Female member' },
  ],
  profile_visibility: [
    { value: 'no-one', label: 'No one', description: 'Profile hidden from all members' },
    { value: 'everyone', label: 'Everyone', description: 'Visible to all members (default at registration)' },
    { value: 'interested', label: 'Interested only', description: 'Visible only to members you have sent interest to' },
    { value: 'verified', label: 'Verified only', description: 'Visible only to verified members' },
    { value: 'premium', label: 'Premium only', description: 'Visible only to premium members' },
  ],
  user_status: [
    { value: 'pending', label: 'Pending', description: 'Awaiting verification' },
    { value: 'verified', label: 'Verified', description: 'Trust badge verified' },
    { value: 'premium', label: 'Premium', description: 'Active paid subscription' },
    { value: 'free', label: 'Free', description: 'Free tier member' },
    { value: 'deleted', label: 'Deleted', description: 'Soft-deleted account' },
    { value: 'block', label: 'Blocked', description: 'Blocked by admin' },
  ],
  trust_badge_status: [
    { value: 'Pending', label: 'Pending', description: 'Awaiting admin review' },
    { value: 'Verified', label: 'Verified', description: 'Approved by admin' },
    { value: 'Rejected', label: 'Rejected', description: 'Rejected by admin' },
  ],
  policy_type: [
    { value: 'privacy', label: 'Privacy Policy', description: 'Privacy policy page' },
    { value: 'terms', label: 'Terms & Conditions', description: 'Terms and conditions page' },
    { value: 'refund', label: 'Refund Policy', description: 'Refund policy page' },
  ],
  plan_validity_type: [
    { value: 'monthly', label: 'Monthly', description: 'Monthly subscription plans' },
    { value: 'unlimited', label: 'Unlimited', description: 'Unlimited duration plans' },
    { value: 'assisted', label: 'Assisted', description: 'Assisted matchmaking plans' },
  ],
  photo_field: [
    { value: 'profile_image', label: 'Main photo', description: 'Primary profile photo slot' },
    { value: 'profile_image1', label: 'Gallery 1', description: 'Gallery slot 1' },
    { value: 'profile_image2', label: 'Gallery 2', description: 'Gallery slot 2' },
    { value: 'profile_image3', label: 'Gallery 3', description: 'Gallery slot 3' },
    { value: 'profile_image4', label: 'Gallery 4', description: 'Gallery slot 4' },
  ],
} as const satisfies Record<string, FieldOption[]>;

export type FieldOptionKey = keyof typeof FIELD_OPTIONS;

export function allowedValues(key: FieldOptionKey): string[] {
  return FIELD_OPTIONS[key].map((o) => o.value);
}

export function validationMessage(key: FieldOptionKey, fieldName: string = key): string {
  return `${fieldName} must be one of: ${allowedValues(key).join(', ')}`;
}
