import { OpenAPIV3 } from 'openapi-types';
import { S } from './swagger.schemas';

const jsonOk = (description: string): OpenAPIV3.ResponseObject => ({
  description,
  content: { 'application/json': { schema: { $ref: S('ApiResponse') } } },
});

const jsonOkSchema = (description: string, schemaRef: string): OpenAPIV3.ResponseObject => ({
  description,
  content: { 'application/json': { schema: { $ref: schemaRef } } },
});

const jsonErr = (): Record<string, OpenAPIV3.ResponseObject> => ({
  '400': { description: 'Validation or bad request' },
  '401': { description: 'Authentication required' },
  '403': { description: 'Forbidden' },
  '404': { description: 'Not found' },
  '429': { description: 'Rate limited' },
  '500': { description: 'Server error' },
});

const bearer: OpenAPIV3.SecurityRequirementObject[] = [{ BearerAuth: [] }];
const adminBearer: OpenAPIV3.SecurityRequirementObject[] = [{ AdminBearerAuth: [] }];

type OpOpts = {
  security?: OpenAPIV3.SecurityRequirementObject[];
  desc?: string;
  detail?: string;
  /** Full response schema ref (overrides generic ApiResponse) */
  responseSchema?: string;
  params?: OpenAPIV3.ParameterObject[];
  query?: OpenAPIV3.ParameterObject[];
  body?: string;
  bodyRequired?: boolean;
  multipart?: string;
  noBody?: boolean;
};

function pathParam(name: string, description: string, example: string | number): OpenAPIV3.ParameterObject {
  const isInt = typeof example === 'number';
  return {
    name,
    in: 'path',
    required: true,
    description,
    schema: { type: isInt ? 'integer' : 'string', example },
  };
}

function queryParam(
  name: string,
  description: string,
  opts?: { type?: 'string' | 'integer' | 'boolean'; example?: unknown; required?: boolean }
): OpenAPIV3.ParameterObject {
  return {
    name,
    in: 'query',
    required: opts?.required ?? false,
    description,
    schema: { type: opts?.type ?? 'string', example: opts?.example },
  };
}

function jsonBody(schemaRef: string, required = true): OpenAPIV3.RequestBodyObject {
  return {
    required,
    content: { 'application/json': { schema: { $ref: schemaRef } } },
  };
}

function buildParams(opts?: OpOpts): OpenAPIV3.ParameterObject[] | undefined {
  const all = [...(opts?.params ?? []), ...(opts?.query ?? [])];
  return all.length ? all : undefined;
}

function opGet(tag: string, summary: string, opts?: OpOpts): OpenAPIV3.OperationObject {
  const okResponse = opts?.responseSchema
    ? jsonOkSchema(opts.desc ?? summary, opts.responseSchema)
    : jsonOk(opts?.desc ?? summary);

  return {
    tags: [tag],
    summary,
    description: opts?.detail,
    security: opts?.security,
    parameters: buildParams(opts),
    responses: { '200': okResponse, ...jsonErr() },
  };
}

function opPost(tag: string, summary: string, opts?: OpOpts): OpenAPIV3.OperationObject {
  const okResponse = opts?.responseSchema
    ? jsonOkSchema(opts.desc ?? summary, opts.responseSchema)
    : jsonOk(opts?.desc ?? summary);

  const operation: OpenAPIV3.OperationObject = {
    tags: [tag],
    summary,
    description: opts?.detail,
    security: opts?.security,
    parameters: buildParams(opts),
    responses: { '200': okResponse, '201': okResponse, ...jsonErr() },
  };
  if (opts?.multipart) {
    operation.requestBody = {
      required: true,
      content: { 'multipart/form-data': { schema: { $ref: opts.multipart } } },
    };
  } else if (opts?.body) {
    operation.requestBody = jsonBody(opts.body, opts.bodyRequired ?? true);
  } else if (!opts?.noBody) {
    operation.requestBody = jsonBody(S('ApiResponse'), false);
  }
  return operation;
}

function opPatch(tag: string, summary: string, opts?: OpOpts): OpenAPIV3.OperationObject {
  return {
    tags: [tag],
    summary,
    description: opts?.detail,
    security: opts?.security,
    parameters: buildParams(opts),
    requestBody: opts?.body ? jsonBody(opts.body) : undefined,
    responses: { '200': jsonOk(summary), ...jsonErr() },
  };
}

function opDelete(tag: string, summary: string, opts?: OpOpts): OpenAPIV3.OperationObject {
  return {
    tags: [tag],
    summary,
    security: opts?.security,
    parameters: buildParams(opts),
    responses: { '200': jsonOk(summary), ...jsonErr() },
  };
}

export function buildSwaggerPaths(): OpenAPIV3.PathsObject {
  return {
    '/auth/register': { post: opPost('Auth', 'Register new member', { body: S('RegisterRequest'), desc: 'Registered; OTP sent' }) },
    '/auth/login': {
      post: opPost('Auth', 'Login with email and password', {
        body: S('LoginRequest'),
        detail: 'Returns JWT and user profile. Alternative: mobile OTP login via `/auth/login/otp/send` and `/auth/login/otp/verify`.',
        desc: 'JWT token returned',
      }),
    },
    '/auth/login/otp/send': {
      post: opPost('Auth', 'Send OTP for mobile login', {
        body: S('MobileLoginOtpSendRequest'),
        detail:
          'Passwordless login step 1. Mobile must already be registered. Respects OTP cooldown (see OTP_RESEND_COOLDOWN_SECONDS).',
        desc: 'OTP sent to mobile',
      }),
    },
    '/auth/login/otp/verify': {
      post: opPost('Auth', 'Verify OTP and login with mobile (existing users only)', {
        body: S('MobileLoginOtpVerifyRequest'),
        detail: 'Legacy login OTP. Prefer `POST /auth/mobile/verify-otp` which supports new + existing users.',
        desc: 'Login successful — JWT returned',
      }),
    },
    '/auth/mobile/send-otp': {
      post: opPost('Auth', 'Mobile app — send OTP (new or existing user)', {
        body: S('MobileLoginOtpSendRequest'),
        detail:
          '**Recommended for mobile apps.** Same response whether the number is registered or not (no account leak). ' +
          'After OTP is entered, call `/auth/mobile/verify-otp`.',
        desc: 'OTP sent',
      }),
    },
    '/auth/mobile/verify-otp': {
      post: opPost('Auth', 'Mobile app — verify OTP and get account status', {
        body: S('MobileLoginOtpVerifyRequest'),
        detail:
          '**Recommended for mobile apps.** Returns `accountExists` and `nextStep`:\n' +
          '- `accountExists: false` → `nextStep: register` (new user)\n' +
          '- `accountExists: true` → `token`, `user`, `nextStep: dashboard` or `complete_profile`',
        desc: 'OTP verified — see accountExists in response',
      }),
    },
    '/auth/logout': { post: opPost('Auth', 'Logout', { security: bearer, noBody: true }) },
    '/auth/me': { get: opGet('Auth', 'Get current user', { security: bearer }) },
    '/auth/check-availability': { post: opPost('Auth', 'Check email and phone availability', { body: S('CheckAvailabilityRequest') }) },
    '/auth/change-password': { post: opPost('Auth', 'Change password', { security: bearer, body: S('ChangePasswordRequest') }) },
    '/auth/account': { delete: opDelete('Auth', 'Delete account (soft)', { security: bearer }) },
    '/auth/internal/token': {
      post: opPost('Auth', 'Issue JWT for Laravel session bridge', {
        body: S('InternalTokenRequest'),
        params: [
          {
            name: 'X-Internal-Secret',
            in: 'header',
            required: true,
            schema: { type: 'string' },
            description: 'Must match INTERNAL_API_SECRET env var',
          },
        ],
      }),
    },
    '/auth/otp/verify': { post: opPost('Auth', 'Verify SMS OTP', { security: bearer, body: S('OtpVerifyRequest') }) },
    '/auth/otp/resend': { post: opPost('Auth', 'Resend OTP', { security: bearer, noBody: true }) },
    '/auth/onboarding/status': { get: opGet('Auth', 'Profile onboarding status', { security: bearer }) },
    '/auth/onboarding/profile/step-1': { post: opPost('Auth', 'Profile wizard step 1', { security: bearer, body: S('ProfileStep1Request') }) },
    '/auth/onboarding/profile/step-2': { post: opPost('Auth', 'Profile wizard step 2', { security: bearer, body: S('ProfileStep2Request') }) },

    '/locations/countries': { get: opGet('Public', 'List countries') },
    '/locations/countries/{countryId}/states': {
      get: opGet('Public', 'List states by country', {
        params: [pathParam('countryId', 'Country ID', 101)],
      }),
    },
    '/locations/states/{stateId}/cities': {
      get: opGet('Public', 'List cities by state', {
        params: [pathParam('stateId', 'State ID', 4023)],
      }),
    },
    '/country/data': { get: opGet('Public', 'Countries (Laravel legacy — raw JSON array)') },
    '/state/{countryId}': {
      get: opGet('Public', 'States (Laravel legacy — raw JSON array)', {
        params: [pathParam('countryId', 'Country ID', 101)],
      }),
    },
    '/city/{stateId}': {
      get: opGet('Public', 'Cities (Laravel legacy — raw JSON array)', {
        params: [pathParam('stateId', 'State ID', 4023)],
      }),
    },
    '/castes': { get: opGet('Public', 'List all castes (sects)') },
    '/castes/{casteId}': {
      get: opGet('Public', 'Get caste by ID with sub-castes', {
        params: [pathParam('casteId', 'Caste ID', 1)],
      }),
    },
    '/castes/{casteId}/sub-castes': {
      get: opGet('Public', 'List sub-castes by caste ID', {
        params: [pathParam('casteId', 'Caste ID', 1)],
      }),
    },
    '/subcaste/{casteId}': {
      get: opGet('Public', 'Sub-castes (Laravel legacy — raw JSON array)', {
        params: [pathParam('casteId', 'Caste ID', 1)],
      }),
    },
    '/plans': { get: opGet('Public', 'List active membership plans') },
    '/faqs': { get: opGet('Public', 'List FAQs') },
    '/blogs': { get: opGet('Public', 'List blog posts') },
    '/blogs/{slug}': {
      get: opGet('Public', 'Get blog post by slug', {
        params: [pathParam('slug', 'Blog slug', 'how-to-choose-partner')],
      }),
    },
    '/stories': { get: opGet('Public', 'List success stories') },
    '/policies/{type}': {
      get: opGet('Public', 'Get policy page', {
        params: [pathParam('type', 'Policy type: privacy | terms | refund', 'privacy')],
      }),
    },
    '/counters': { get: opGet('Public', 'Get homepage counters') },
    '/contact-enquiries': { post: opPost('Public', 'Submit contact enquiry', { body: S('ContactEnquiryRequest') }) },

    '/reference/field-options': {
      get: opGet('Public', 'All enum/field options for app forms (gender, profile_visibility, etc.)', {
        desc: 'Returns every allowed value with label and description — use for dropdowns',
      }),
    },
    '/reference/field-options/{key}': {
      get: opGet('Public', 'Allowed values for one field', {
        params: [
          pathParam(
            'key',
            'Field name e.g. profile_visibility, gender, user_status, policy_type, photo_field',
            'profile_visibility'
          ),
        ],
        desc: 'Example keys: profile_visibility, gender, user_status, trust_badge_status, policy_type, plan_validity_type, photo_field',
      }),
    },
    '/reference/search-filters': {
      get: opGet('Public', 'Get search filter options (no request body)', {
        detail:
          '**No parameters required.** Call this once to load the Filters screen dropdowns/chips.\n\n' +
          'After the user picks filters, send their choices in **`POST /search`** (Discovery tag).\n\n' +
          'Related lookups:\n' +
          '- Sect/caste IDs → `GET /castes`\n' +
          '- Country IDs → `GET /locations/countries`',
        responseSchema: S('SearchFiltersResponse'),
        desc: 'Returns age buckets, marital status, mother tongue, education, employed-in, income brackets, and height format hints',
      }),
    },

    '/dashboard': { get: opGet('Discovery', 'Dashboard feed', { security: bearer }) },
    '/profiles/best-matches': {
      get: opGet('Discovery', 'Best matches', {
        security: bearer,
        query: [queryParam('limit', 'Max results (default 12, max 50)', { type: 'integer', example: 12 })],
      }),
    },
    '/profiles/new': {
      get: opGet('Discovery', 'New member profiles', {
        security: bearer,
        query: [queryParam('limit', 'Max results (default 12, max 50)', { type: 'integer', example: 12 })],
      }),
    },
    '/profiles/{memberId}': {
      get: opGet('Discovery', 'View member profile', {
        security: bearer,
        params: [pathParam('memberId', 'Member ID e.g. NM-12345678', 'NM-12345678')],
      }),
    },
    '/search': {
      post: opPost('Discovery', 'Search profiles with selected filters', {
        security: bearer,
        body: S('SearchProfilesRequest'),
        responseSchema: S('SearchProfilesResponse'),
        detail:
          '**This is the search API.** Send the filter values the user selected on the Filters screen.\n\n' +
          'All body fields are optional — combine any filters. Multi-select fields accept a string or string array.\n\n' +
          'Load allowed values first via `GET /reference/search-filters`, `GET /castes`, and `GET /locations/countries`.',
        desc: 'Matching profiles (opposite gender, excludes blocked users)',
      }),
    },

    '/me/profile': { get: opGet('Profile', 'Get full profile', { security: bearer }) },
    '/me/profile/completion': { get: opGet('Profile', 'Profile completion percentage', { security: bearer }) },
    '/me/basic': { patch: opPatch('Profile', 'Update basic details (name, gender)', { security: bearer, body: S('UpdateBasicRequest') }) },
    '/me/personal': { patch: opPatch('Profile', 'Update personal details', { security: bearer, body: S('UpdatePersonalRequest') }) },
    '/me/about': { patch: opPatch('Profile', 'Update about section', { security: bearer, body: S('UpdateAboutRequest') }) },
    '/me/education': { patch: opPatch('Profile', 'Update education and career', { security: bearer, body: S('UpdateEducationRequest') }) },
    '/me/contact-location': { patch: opPatch('Profile', 'Update country/state/city', { security: bearer, body: S('UpdateContactLocationRequest') }) },
    '/me/privacy': {
      patch: opPatch('Profile', 'Update profile visibility', {
        security: bearer,
        body: S('UpdatePrivacyRequest'),
        detail:
          'Allowed `profile_visibility` values: **no-one** | **everyone** | **interested** | **verified** | **premium**. ' +
          'Click the **Schema** tab on the request body to see descriptions. ' +
          'Or call `GET /reference/field-options/profile_visibility`.',
      }),
    },
    '/me/partner-preferences': {
      get: opGet('Profile', 'Get partner preferences and all field options', {
        security: bearer,
        responseSchema: S('PartnerPreferencesGetResponse'),
        detail:
          'Returns saved preferences (may be partial/null) plus `field_options` for every dropdown. ' +
          'All POST fields are optional — send only what the user fills in each step.',
      }),
      post: opPost('Profile', 'Save partner preferences (partial update)', {
        security: bearer,
        body: S('PartnerPreferencesRequest'),
        bodyRequired: false,
        detail:
          '**All fields optional.** Send only fields the user filled. Omitted fields are left unchanged. ' +
          'Send `null` or empty string to clear a field. ID fields accept string or number.',
      }),
    },
    '/me/family': { post: opPost('Profile', 'Save family information', { security: bearer, body: S('FamilyInformationRequest') }) },
    '/me/religious': { post: opPost('Profile', 'Save religious and lifestyle info', { security: bearer, body: S('ReligiousInfoRequest') }) },
    '/me/trust-badge': {
      get: opGet('Profile', 'Get my trust badge status', { security: bearer }),
      post: opPost('Profile', 'Submit trust badge for verification', { security: bearer, body: S('TrustBadgeRequest') }),
    },
    '/me/subscriptions': { get: opGet('Profile', 'List my subscriptions', { security: bearer }) },
    '/notifications': { get: opGet('Profile', 'Admin notifications for user', { security: bearer }) },
    '/callback-requests': { post: opPost('Profile', 'Request a callback', { security: bearer, body: S('CallbackRequest'), bodyRequired: false }) },
    '/contacts/reveal/{userId}': {
      post: opPost('Profile', 'Reveal contact (premium)', {
        security: bearer,
        noBody: true,
        params: [pathParam('userId', 'Target user ID', 42)],
      }),
    },
    '/contacts/views': { get: opGet('Profile', 'Contacts I have revealed', { security: bearer }) },
    '/contacts/viewed-me': { get: opGet('Profile', 'Who viewed my contact', { security: bearer }) },

    '/me/gallery': { get: opGet('Gallery', 'Get my photo gallery', { security: bearer }) },
    '/me/photos': { post: opPost('Gallery', 'Upload profile photo', { security: bearer, multipart: S('UploadPhotoRequest') }) },
    '/me/photos/{field}': {
      delete: opDelete('Gallery', 'Remove profile photo', {
        security: bearer,
        params: [pathParam('field', 'Photo slot name', 'profile_image')],
      }),
    },

    '/interests/{userId}': {
      post: opPost('Social', 'Send interest', {
        security: bearer,
        noBody: true,
        params: [pathParam('userId', 'Target user ID', 42)],
      }),
    },
    '/interests/{userId}/accept': {
      post: opPost('Social', 'Accept interest', {
        security: bearer,
        noBody: true,
        params: [pathParam('userId', 'User ID who sent interest', 42)],
      }),
    },
    '/interests/{interestId}': {
      delete: opDelete('Social', 'Remove interest', {
        security: bearer,
        params: [pathParam('interestId', 'Interest record ID', 1)],
      }),
    },
    '/interests/received': { get: opGet('Social', 'Interests received', { security: bearer }) },
    '/interests/sent': { get: opGet('Social', 'Interests sent', { security: bearer }) },
    '/shortlists': {
      get: opGet('Social', 'Get shortlist', { security: bearer }),
      post: opPost('Social', 'Add to shortlist', { security: bearer, body: S('ShortlistRequest') }),
    },
    '/shortlists/{userId}': {
      delete: opDelete('Social', 'Remove from shortlist', {
        security: bearer,
        params: [pathParam('userId', 'Shortlisted user ID', 42)],
      }),
    },
    '/ignores': {
      get: opGet('Social', 'Get ignored profiles', { security: bearer }),
      post: opPost('Social', 'Ignore profile', { security: bearer, body: S('IgnoreRequest') }),
    },
    '/ignores/{userId}': {
      delete: opDelete('Social', 'Unignore profile (same as unblock)', {
        security: bearer,
        params: [pathParam('userId', 'Ignored user ID', 42)],
      }),
    },
    '/blocks': {
      get: opGet('Social', 'List blocked users', { security: bearer }),
    },
    '/blocks/{userId}': {
      post: opPost('Social', 'Block user', {
        security: bearer,
        noBody: true,
        params: [pathParam('userId', 'User ID to block', 42)],
      }),
      delete: opDelete('Social', 'Unblock user', {
        security: bearer,
        params: [pathParam('userId', 'Blocked user ID', 42)],
      }),
    },
    '/gallery-requests/sent': { get: opGet('Social', 'Gallery requests I sent', { security: bearer }) },
    '/gallery-requests/received': { get: opGet('Social', 'Gallery requests I received', { security: bearer }) },
    '/gallery-requests/accepted': {
      get: opGet('Social', 'Gallery access granted to me — users whose gallery I can view', { security: bearer }),
    },
    '/gallery-requests/granted': {
      get: opGet('Social', 'Gallery requests I accepted — users who can view my gallery', { security: bearer }),
    },
    '/gallery-requests/{userId}': {
      post: opPost('Social', 'Send gallery access request to another user', {
        security: bearer,
        noBody: true,
        params: [pathParam('userId', 'Target user ID', 42)],
      }),
    },
    '/gallery-requests/{userId}/accept': {
      post: opPost('Social', 'Accept gallery request (owner only)', {
        security: bearer,
        noBody: true,
        params: [pathParam('userId', 'Requester user ID', 42)],
      }),
    },
    '/gallery-requests/{userId}/reject': {
      post: opPost('Social', 'Reject gallery request (owner only)', {
        security: bearer,
        noBody: true,
        params: [pathParam('userId', 'Requester user ID', 42)],
      }),
    },
    '/gallery-requests/{userId}/gallery': {
      get: opGet('Social', 'View user gallery after request accepted', {
        security: bearer,
        params: [pathParam('userId', 'User whose gallery to view', 42)],
      }),
    },
    '/reports': { post: opPost('Social', 'Report profile', { security: bearer, body: S('ReportRequest') }) },
    '/profiles/views/by-me': { get: opGet('Social', 'Profiles viewed by me', { security: bearer }) },
    '/profiles/views/of-me': { get: opGet('Social', 'Who viewed my profile', { security: bearer }) },

    '/conversations': { get: opGet('Messaging', 'List conversations', { security: bearer }) },
    '/conversations/{userId}/messages': {
      get: opGet('Messaging', 'Get message thread', {
        security: bearer,
        params: [pathParam('userId', 'Other user ID', 42)],
      }),
    },
    '/conversations/messages': { post: opPost('Messaging', 'Send message', { security: bearer, body: S('SendMessageRequest') }) },
    '/conversations/{userId}/read': {
      post: opPost('Messaging', 'Mark messages as read', {
        security: bearer,
        noBody: true,
        params: [pathParam('userId', 'Sender user ID', 42)],
      }),
    },

    '/payments/razorpay/order': { post: opPost('Payments', 'Create Razorpay order', { security: bearer, body: S('RazorpayOrderRequest') }) },
    '/payments/razorpay/verify': { post: opPost('Payments', 'Verify Razorpay payment', { security: bearer, body: S('RazorpayVerifyRequest') }) },
    '/payments/history': { get: opGet('Payments', 'Payment history', { security: bearer }) },
    '/payments/subscription/active': { get: opGet('Payments', 'Get active subscription', { security: bearer }) },
    '/payments/invoices/{invoiceNumber}': {
      get: opGet('Payments', 'Get invoice by number', {
        security: bearer,
        params: [pathParam('invoiceNumber', 'Invoice number e.g. INV-000001', 'INV-000001')],
      }),
    },

    '/admin/auth/login': { post: opPost('Admin', 'Admin login', { body: S('AdminLoginRequest') }) },
    '/admin/auth/logout': { post: opPost('Admin', 'Admin logout', { security: adminBearer, noBody: true }) },
    '/admin/dashboard': { get: opGet('Admin', 'Admin dashboard stats', { security: adminBearer }) },
    '/admin/sales': { get: opGet('Admin', 'Sales statistics', { security: adminBearer }) },

    '/admin/members': {
      get: opGet('Admin', 'List members (paginated)', {
        security: adminBearer,
        query: [
          queryParam('page', 'Page number', { type: 'integer', example: 1 }),
          queryParam('limit', 'Items per page (max 100)', { type: 'integer', example: 20 }),
          queryParam('status', 'Filter by status: pending|verified|premium|deleted|block'),
          queryParam('keyword', 'Search name, email, member_id, phone'),
        ],
      }),
    },
    '/admin/members/{memberId}': {
      get: opGet('Admin', 'Get member details', {
        security: adminBearer,
        params: [pathParam('memberId', 'Member ID e.g. NM-12345678', 'NM-12345678')],
      }),
    },
    '/admin/members/{userId}': {
      patch: opPatch('Admin', 'Update member', {
        security: adminBearer,
        body: S('UpdateMemberRequest'),
        params: [pathParam('userId', 'User database ID', 1)],
      }),
      delete: opDelete('Admin', 'Soft delete member', {
        security: adminBearer,
        params: [pathParam('userId', 'User database ID', 1)],
      }),
    },
    '/admin/members/{userId}/restore': {
      post: opPost('Admin', 'Restore deleted member', {
        security: adminBearer,
        noBody: true,
        params: [pathParam('userId', 'User database ID', 1)],
      }),
    },

    '/admin/trust-badges/pending': { get: opGet('Admin', 'List pending trust badges', { security: adminBearer }) },
    '/admin/trust-badges': { patch: opPatch('Admin', 'Update trust badge status', { security: adminBearer, body: S('UpdateTrustBadgeRequest') }) },

    '/admin/subscriptions': { get: opGet('Admin', 'List subscriptions', { security: adminBearer }) },
    '/admin/subscriptions/assign': { post: opPost('Admin', 'Assign subscription', { security: adminBearer, body: S('AssignSubscriptionRequest') }) },
    '/admin/subscriptions/{subscriptionId}/cancel': {
      post: opPost('Admin', 'Cancel subscription', {
        security: adminBearer,
        noBody: true,
        params: [pathParam('subscriptionId', 'Subscription ID', 1)],
      }),
    },

    '/admin/plans': {
      get: opGet('Admin', 'List plans', {
        security: adminBearer,
        query: [queryParam('validity_type', 'Filter: monthly|unlimited|assisted')],
      }),
      post: opPost('Admin', 'Create plan', { security: adminBearer, body: S('CreatePlanRequest') }),
      patch: opPatch('Admin', 'Update plan', { security: adminBearer, body: S('UpdatePlanRequest') }),
    },
    '/admin/plans/{slug}': {
      get: opGet('Admin', 'Get plan by slug', {
        security: adminBearer,
        params: [pathParam('slug', 'Plan slug', 'premium-plan')],
      }),
    },
    '/admin/plans/{planId}': {
      delete: opDelete('Admin', 'Delete plan', {
        security: adminBearer,
        params: [pathParam('planId', 'Plan ID', 1)],
      }),
    },
    '/admin/plans/toggle-status': { patch: opPatch('Admin', 'Toggle plan status', { security: adminBearer, body: S('TogglePlanStatusRequest') }) },

    '/admin/locations/countries': {
      get: opGet('Admin', 'List countries', { security: adminBearer }),
      post: opPost('Admin', 'Create country', { security: adminBearer, body: S('CreateCountryRequest') }),
      patch: opPatch('Admin', 'Update country', { security: adminBearer, body: S('UpdateCountryRequest') }),
    },
    '/admin/locations/countries/{id}': {
      delete: opDelete('Admin', 'Delete country', {
        security: adminBearer,
        params: [pathParam('id', 'Country ID', 1)],
      }),
    },
    '/admin/locations/states': {
      get: opGet('Admin', 'List states', {
        security: adminBearer,
        query: [queryParam('country_id', 'Filter by country ID', { type: 'integer', example: 101 })],
      }),
      post: opPost('Admin', 'Create state', { security: adminBearer, body: S('CreateStateRequest') }),
      patch: opPatch('Admin', 'Update state', { security: adminBearer, body: S('UpdateStateRequest') }),
    },
    '/admin/locations/states/{id}': {
      delete: opDelete('Admin', 'Delete state', {
        security: adminBearer,
        params: [pathParam('id', 'State ID', 1)],
      }),
    },
    '/admin/locations/cities': {
      get: opGet('Admin', 'List cities', {
        security: adminBearer,
        query: [queryParam('state_id', 'Filter by state ID', { type: 'integer', example: 4023 })],
      }),
      post: opPost('Admin', 'Create city', { security: adminBearer, body: S('CreateCityRequest') }),
      patch: opPatch('Admin', 'Update city', { security: adminBearer, body: S('UpdateCityRequest') }),
    },
    '/admin/locations/cities/{id}': {
      delete: opDelete('Admin', 'Delete city', {
        security: adminBearer,
        params: [pathParam('id', 'City ID', 1)],
      }),
    },

    '/admin/castes': {
      get: opGet('Admin', 'List castes', { security: adminBearer }),
      post: opPost('Admin', 'Create caste', { security: adminBearer, body: S('CreateCasteRequest') }),
      patch: opPatch('Admin', 'Update caste', { security: adminBearer, body: S('UpdateCasteRequest') }),
    },
    '/admin/castes/{id}': {
      get: opGet('Admin', 'Get caste with sub-castes', {
        security: adminBearer,
        params: [pathParam('id', 'Caste ID', 1)],
      }),
      delete: opDelete('Admin', 'Delete caste', {
        security: adminBearer,
        params: [pathParam('id', 'Caste ID', 1)],
      }),
    },
    '/admin/sub-castes': {
      get: opGet('Admin', 'List sub-castes', {
        security: adminBearer,
        query: [queryParam('caste_id', 'Filter by caste ID', { type: 'integer', example: 1 })],
      }),
      post: opPost('Admin', 'Create sub-caste', { security: adminBearer, body: S('CreateSubCasteRequest') }),
      patch: opPatch('Admin', 'Update sub-caste', { security: adminBearer, body: S('UpdateSubCasteRequest') }),
    },
    '/admin/sub-castes/{id}': {
      get: opGet('Admin', 'Get sub-caste', {
        security: adminBearer,
        params: [pathParam('id', 'Sub-caste ID', 1)],
      }),
      delete: opDelete('Admin', 'Delete sub-caste', {
        security: adminBearer,
        params: [pathParam('id', 'Sub-caste ID', 1)],
      }),
    },

    '/admin/cms/faqs': {
      get: opGet('Admin', 'List FAQs', { security: adminBearer }),
      post: opPost('Admin', 'Create FAQ', { security: adminBearer, body: S('CreateFaqRequest') }),
      patch: opPatch('Admin', 'Update FAQ', { security: adminBearer, body: S('UpdateFaqRequest') }),
    },
    '/admin/cms/faqs/{id}': {
      delete: opDelete('Admin', 'Delete FAQ', {
        security: adminBearer,
        params: [pathParam('id', 'FAQ ID', 1)],
      }),
    },
    '/admin/cms/stories': {
      get: opGet('Admin', 'List success stories', { security: adminBearer }),
      post: opPost('Admin', 'Create story', { security: adminBearer, body: S('CreateStoryRequest') }),
      patch: opPatch('Admin', 'Update story', { security: adminBearer, body: S('UpdateStoryRequest') }),
    },
    '/admin/cms/stories/{id}': {
      delete: opDelete('Admin', 'Delete story', {
        security: adminBearer,
        params: [pathParam('id', 'Story ID', 1)],
      }),
    },
    '/admin/cms/blog-categories': {
      get: opGet('Admin', 'List blog categories', { security: adminBearer }),
      post: opPost('Admin', 'Create blog category', { security: adminBearer, body: S('CreateBlogCategoryRequest') }),
      patch: opPatch('Admin', 'Update blog category', { security: adminBearer, body: S('UpdateBlogCategoryRequest') }),
    },
    '/admin/cms/blog-categories/{id}': {
      delete: opDelete('Admin', 'Delete blog category', {
        security: adminBearer,
        params: [pathParam('id', 'Category ID', 1)],
      }),
    },
    '/admin/cms/blogs': {
      get: opGet('Admin', 'List blogs', { security: adminBearer }),
      post: opPost('Admin', 'Create blog', { security: adminBearer, body: S('CreateBlogRequest') }),
      patch: opPatch('Admin', 'Update blog', { security: adminBearer, body: S('UpdateBlogRequest') }),
    },
    '/admin/cms/blogs/{id}': {
      delete: opDelete('Admin', 'Delete blog', {
        security: adminBearer,
        params: [pathParam('id', 'Blog ID', 1)],
      }),
    },
    '/admin/cms/policies/{type}': {
      get: opGet('Admin', 'Get policy', {
        security: adminBearer,
        params: [pathParam('type', 'privacy | terms | refund', 'privacy')],
      }),
    },
    '/admin/cms/policies': { post: opPost('Admin', 'Create or update policy', { security: adminBearer, body: S('UpsertPolicyRequest') }) },
    '/admin/cms/counters': {
      get: opGet('Admin', 'Get homepage counters', { security: adminBearer }),
      patch: opPatch('Admin', 'Update counters', { security: adminBearer, body: S('UpdateCountersRequest') }),
    },

    '/admin/reports': { get: opGet('Admin', 'List reported profiles', { security: adminBearer }) },
    '/admin/contact-enquiries': { get: opGet('Admin', 'List contact enquiries', { security: adminBearer }) },
    '/admin/contact-enquiries/{id}/resolve': {
      patch: opPatch('Admin', 'Resolve contact enquiry', {
        security: adminBearer,
        params: [pathParam('id', 'Enquiry ID', 1)],
      }),
    },
    '/admin/contact-enquiries/{id}': {
      delete: opDelete('Admin', 'Delete contact enquiry', {
        security: adminBearer,
        params: [pathParam('id', 'Enquiry ID', 1)],
      }),
    },
    '/admin/callback-requests': { get: opGet('Admin', 'List callback requests', { security: adminBearer }) },
    '/admin/callback-requests/{id}/resolve': {
      patch: opPatch('Admin', 'Resolve callback request', {
        security: adminBearer,
        params: [pathParam('id', 'Callback request ID', 1)],
      }),
    },
    '/admin/callback-requests/{id}': {
      delete: opDelete('Admin', 'Delete callback request', {
        security: adminBearer,
        params: [pathParam('id', 'Callback request ID', 1)],
      }),
    },
    '/admin/messages': {
      get: opGet('Admin', 'List admin messages', { security: adminBearer }),
      post: opPost('Admin', 'Send admin message to user', { security: adminBearer, body: S('SendAdminMessageRequest') }),
    },
    '/admin/messages/{id}': {
      delete: opDelete('Admin', 'Delete admin message', {
        security: adminBearer,
        params: [pathParam('id', 'Message ID', 1)],
      }),
    },
    '/admin/chats': { get: opGet('Admin', 'List user chat threads', { security: adminBearer }) },
    '/admin/chats/{userId}/{receiverId}': {
      get: opGet('Admin', 'Get chat thread for audit', {
        security: adminBearer,
        params: [
          pathParam('userId', 'First user ID', 1),
          pathParam('receiverId', 'Second user ID', 2),
        ],
      }),
    },
  };
}
