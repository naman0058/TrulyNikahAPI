import { OpenAPIV3 } from 'openapi-types';
import { FIELD_OPTIONS, FieldOptionKey } from '../constants/fieldOptions';

/** Build OpenAPI enum schema from shared field-options (Swagger + API stay in sync) */
function schemaFromFieldOptions(key: FieldOptionKey, example?: string): OpenAPIV3.SchemaObject {
  const options = FIELD_OPTIONS[key];
  const values = options.map((o) => o.value);
  const description =
    `Allowed values — use exactly one of: ${values.map((v) => `\`${v}\``).join(', ')}\n\n` +
    options.map((o) => `- **${o.value}** (${o.label}): ${o.description}`).join('\n') +
    `\n\nRuntime lookup: \`GET /reference/field-options/${key}\``;

  return {
    type: 'string',
    enum: values,
    example: example ?? values[0],
    description,
  };
}

const gender = schemaFromFieldOptions('gender', 'male');
const profileVisibility = schemaFromFieldOptions('profile_visibility', 'everyone');
const photoField = schemaFromFieldOptions('photo_field', 'profile_image');
const trustBadgeStatus = schemaFromFieldOptions('trust_badge_status', 'Pending');
const policyType = schemaFromFieldOptions('policy_type', 'privacy');
const validityType = schemaFromFieldOptions('plan_validity_type', 'monthly');
const userStatus = schemaFromFieldOptions('user_status', 'pending');

export const swaggerSchemas: Record<string, OpenAPIV3.SchemaObject> = {
  ApiResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string', example: 'OK' },
      code: { type: 'string' },
      data: { type: 'object' },
      errors: { type: 'object', additionalProperties: { type: 'array', items: { type: 'string' } } },
      meta: { type: 'object' },
    },
  },
  RegisterRequest: {
    type: 'object',
    required: ['email', 'behalf', 'contact_number', 'password'],
    properties: {
      email: { type: 'string', format: 'email', example: 'user@example.com' },
      behalf: { type: 'string', example: 'self' },
      contact_number: { type: 'string', pattern: '^\\d{10}$', example: '9876543210' },
      password: { type: 'string', minLength: 8, example: 'password123' },
      fid: { type: 'string', description: 'Firebase UID (optional)' },
    },
  },
  LoginRequest: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email', example: 'user@example.com' },
      password: { type: 'string', example: 'password123' },
    },
    description: 'Email and password login',
  },
  MobileLoginOtpSendRequest: {
    type: 'object',
    required: ['contact_number'],
    properties: {
      contact_number: {
        type: 'string',
        pattern: '^\\d{10}$',
        example: '9876543210',
        description: '10-digit mobile number registered on the account',
      },
    },
    description: 'Step 1 of mobile OTP login — sends SMS OTP',
  },
  MobileLoginOtpVerifyRequest: {
    type: 'object',
    required: ['contact_number', 'otp'],
    properties: {
      contact_number: { type: 'string', pattern: '^\\d{10}$', example: '9876543210' },
      otp: { type: 'string', pattern: '^\\d{6}$', example: '123456', description: '6-digit OTP from SMS' },
    },
    description: 'Step 2 of mobile OTP login — returns JWT on success',
  },
  LoginResponse: {
    type: 'object',
    description: 'Returned by email login and mobile OTP login',
    properties: {
      token: { type: 'string', description: 'JWT Bearer token' },
      user: { type: 'object' },
      onboarding: {
        type: 'object',
        properties: {
          phoneVerified: { type: 'boolean' },
          profileComplete: { type: 'boolean' },
          status: userStatus,
          completion: { type: 'object' },
        },
      },
    },
  },
  CheckAvailabilityRequest: {
    type: 'object',
    required: ['email', 'contact_number'],
    properties: {
      email: { type: 'string', format: 'email', example: 'user@example.com' },
      contact_number: { type: 'string', example: '9876543210' },
    },
  },
  ChangePasswordRequest: {
    type: 'object',
    required: ['password', 'password_confirmation'],
    properties: {
      password: { type: 'string', minLength: 8, example: 'newpassword123' },
      password_confirmation: { type: 'string', example: 'newpassword123' },
    },
  },
  InternalTokenRequest: {
    type: 'object',
    required: ['user_id'],
    properties: { user_id: { type: 'integer', example: 1 } },
  },
  OtpVerifyRequest: {
    type: 'object',
    required: ['otp'],
    properties: { otp: { type: 'string', pattern: '^\\d{6}$', example: '123456' } },
    description: 'Verify OTP after registration (requires Bearer token from register)',
  },
  ProfileStep1Request: {
    type: 'object',
    required: ['name', 'dob', 'gender', 'height', 'country', 'states', 'city'],
    properties: {
      name: { type: 'string', example: 'Ahmed Khan' },
      dob: { type: 'string', example: '1995-06-15' },
      gender,
      height: { type: 'string', example: '5ft 10in' },
      country: { type: 'string', example: '101' },
      states: { type: 'string', example: '4023' },
      city: { type: 'string', example: '57606' },
      family_with_groom: { type: 'boolean', example: false },
      weight: { type: 'string', example: '70' },
      pcountry: { type: 'string' },
      pstate: { type: 'string' },
    },
  },
  ProfileStep2Request: {
    type: 'object',
    required: ['marital_status', 'mother_tounge', 'sect', 'cast', 'employed_in', 'occupation', 'any_disability'],
    properties: {
      marital_status: { type: 'string', example: 'Never Married' },
      have_children: { type: 'string', example: 'No' },
      mother_tounge: { type: 'string', example: 'Urdu' },
      sect: { type: 'string', example: '1', description: 'Caste ID from GET /castes' },
      cast: { type: 'string', example: '5', description: 'Sub-caste ID' },
      employed_in: { type: 'string', example: 'Private Sector' },
      occupation: { type: 'string', example: 'Software Engineer' },
      any_disability: { type: 'string', example: 'No' },
    },
  },
  ContactEnquiryRequest: {
    type: 'object',
    required: ['name', 'email', 'message'],
    properties: {
      name: { type: 'string', example: 'John Doe' },
      email: { type: 'string', format: 'email', example: 'john@example.com' },
      phone: { type: 'string', example: '9876543210' },
      message: { type: 'string', example: 'I have a question.' },
    },
  },
  SearchProfilesRequest: {
    type: 'object',
    properties: {
      age_from: { type: 'integer', example: 22 },
      age_to: { type: 'integer', example: 35 },
      country: { type: 'string', example: '101' },
      state: { type: 'string', example: '4023' },
      city: { type: 'string', example: '57606' },
      marital_status: { type: 'string', example: 'Never Married' },
      sect: { type: 'string', example: '1' },
      cast: { type: 'string', example: '5' },
      page: { type: 'integer', example: 1 },
      limit: { type: 'integer', example: 20 },
    },
  },
  UpdateBasicRequest: {
    type: 'object',
    required: ['name', 'gender'],
    properties: { name: { type: 'string', example: 'Ahmed Khan' }, gender },
  },
  UpdatePersonalRequest: {
    type: 'object',
    required: ['height', 'cast', 'mother_tounge', 'any_disability'],
    properties: {
      height: { type: 'string', example: '5ft 10in' },
      cast: { type: 'string', example: '5' },
      mother_tounge: { type: 'string', example: 'Urdu' },
      any_disability: { type: 'string', example: 'No' },
    },
  },
  UpdateAboutRequest: {
    type: 'object',
    required: ['about_us'],
    properties: { about_us: { type: 'string', example: 'Assalamualaikum...' } },
  },
  UpdateEducationRequest: {
    type: 'object',
    required: ['highest_education', 'college', 'occupation', 'employed_in', 'annual_income', 'occupation_details'],
    properties: {
      highest_education: { type: 'string', example: 'Bachelors' },
      college: { type: 'string', example: 'Delhi University' },
      occupation: { type: 'string', example: 'Software Engineer' },
      employed_in: { type: 'string', example: 'Private Sector' },
      annual_income: { type: 'string', example: '10-15 Lakhs' },
      occupation_details: { type: 'string', example: 'Full stack developer' },
    },
  },
  UpdateContactLocationRequest: {
    type: 'object',
    required: ['country', 'state', 'city'],
    properties: {
      country: { type: 'string', example: '101' },
      state: { type: 'string', example: '4023' },
      city: { type: 'string', example: '57606' },
    },
  },
  UpdatePrivacyRequest: {
    type: 'object',
    required: ['profile_visibility'],
    properties: {
      profile_visibility: { ...profileVisibility, description: profileVisibility.description },
    },
    description:
      'Controls who can see the member profile. Invalid values return 422 with allowed list in `errors.profile_visibility`.',
  },
  ProfileVisibilityEnum: profileVisibility,
  GenderEnum: gender,
  FieldOptionItem: {
    type: 'object',
    properties: {
      value: { type: 'string', example: 'everyone' },
      label: { type: 'string', example: 'Everyone' },
      description: { type: 'string', example: 'Visible to all members' },
    },
  },
  FieldOptionsResponse: {
    type: 'object',
    description: 'Response from GET /reference/field-options — use to build app dropdowns',
    additionalProperties: {
      type: 'object',
      properties: {
        values: { type: 'array', items: { type: 'string' }, example: ['no-one', 'everyone', 'interested', 'verified', 'premium'] },
        options: { type: 'array', items: { $ref: '#/components/schemas/FieldOptionItem' } },
      },
    },
  },
  PartnerPreferencesRequest: {
    type: 'object',
    required: ['marital_status', 'age_from', 'age_to', 'highest_education', 'mother_tounge', 'country', 'height_from', 'height_to'],
    properties: {
      marital_status: { type: 'string', example: 'Never Married' },
      age_from: { type: 'integer', example: 22 },
      age_to: { type: 'integer', example: 32 },
      highest_education: { type: 'string', example: 'Bachelors' },
      mother_tounge: { type: 'string', example: 'Urdu' },
      sect: { type: 'string', example: '1' },
      cast: { type: 'string', example: '5' },
      height_from: { type: 'string', example: '5ft 0in' },
      height_to: { type: 'string', example: '6ft 0in' },
      occupation: { type: 'string' },
      country: { type: 'string', example: '101' },
      state: { type: 'string' },
      city: { type: 'string' },
      annual_income: { type: 'string' },
    },
  },
  FamilyInformationRequest: {
    type: 'object',
    properties: {
      father_name: { type: 'string' },
      father_occupation: { type: 'string' },
      mother_name: { type: 'string' },
      mother_occupation: { type: 'string' },
      brothers: { type: 'string' },
      sisters: { type: 'string' },
      family_type: { type: 'string' },
      family_status: { type: 'string' },
      family_values: { type: 'string' },
    },
  },
  ReligiousInfoRequest: {
    type: 'object',
    properties: {
      namaz: { type: 'string' },
      quran: { type: 'string' },
      hijab: { type: 'string' },
      zakat: { type: 'string' },
      halal_food: { type: 'string' },
    },
  },
  TrustBadgeRequest: {
    type: 'object',
    required: ['verification_type'],
    properties: {
      verification_type: { type: 'string', example: 'Aadhar' },
      image: { type: 'string', example: 'profile_images/id-front.jpg' },
      image2: { type: 'string', example: 'profile_images/id-back.jpg' },
    },
  },
  CallbackRequest: {
    type: 'object',
    properties: {
      phone: { type: 'string', example: '9876543210' },
      alt_phone: { type: 'string', example: '9123456789' },
    },
  },
  ShortlistRequest: {
    type: 'object',
    required: ['shortlisted_user_id'],
    properties: { shortlisted_user_id: { type: 'integer', example: 42 } },
  },
  IgnoreRequest: {
    type: 'object',
    required: ['ignored_user_id'],
    properties: { ignored_user_id: { type: 'integer', example: 42 } },
  },
  ReportRequest: {
    type: 'object',
    required: ['report_user_id'],
    properties: { report_user_id: { type: 'integer', example: 42 } },
  },
  SendMessageRequest: {
    type: 'object',
    required: ['receiver_id', 'message'],
    properties: {
      receiver_id: { type: 'integer', example: 42 },
      message: { type: 'string', example: 'Assalamualaikum' },
    },
  },
  RazorpayOrderRequest: {
    type: 'object',
    required: ['amount'],
    properties: {
      amount: { type: 'number', example: 999, description: 'Amount in INR' },
      plan_id: { type: 'integer', example: 1 },
    },
  },
  RazorpayVerifyRequest: {
    type: 'object',
    required: ['razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature'],
    properties: {
      razorpay_order_id: { type: 'string', example: 'order_xxx' },
      razorpay_payment_id: { type: 'string', example: 'pay_xxx' },
      razorpay_signature: { type: 'string', example: 'signature_hash' },
      plan_id: { type: 'integer', example: 1 },
      vid: { type: 'integer', example: 2 },
      plan_duration: { type: 'integer', example: 3 },
      verified_contact: { type: 'integer', example: 10 },
      amount: { type: 'number', example: 999 },
    },
  },
  AdminLoginRequest: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email', example: 'admin@trulynikah.com' },
      password: { type: 'string', example: 'adminpassword' },
    },
  },
  UpdateMemberRequest: {
    type: 'object',
    properties: {
      name: { type: 'string', example: 'Ahmed Khan' },
      status: userStatus,
      phone_verified: { type: 'boolean', example: true },
      profile_visibility: profileVisibility,
    },
  },
  UpdateTrustBadgeRequest: {
    type: 'object',
    required: ['trust_badge_id', 'status'],
    properties: {
      trust_badge_id: { type: 'integer', example: 1 },
      status: trustBadgeStatus,
    },
  },
  AssignSubscriptionRequest: {
    type: 'object',
    required: ['user_id', 'plan_id', 'plan_variant_id'],
    properties: {
      user_id: { type: 'integer', example: 1 },
      plan_id: { type: 'integer', example: 1 },
      plan_variant_id: { type: 'integer', example: 2 },
    },
  },
  PlanVariantInput: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      duration: { type: 'integer', example: 3 },
      price: { type: 'number', example: 999 },
      verified_contact: { type: 'integer', example: 10 },
    },
  },
  CreatePlanRequest: {
    type: 'object',
    required: ['name', 'validity_type'],
    properties: {
      name: { type: 'string', example: 'Premium Plan' },
      validity_type: validityType,
      description: { type: 'string' },
      status: { type: 'boolean', default: true },
      variants: { type: 'array', items: { $ref: '#/components/schemas/PlanVariantInput' } },
    },
  },
  UpdatePlanRequest: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'integer', example: 1 },
      name: { type: 'string' },
      validity_type: validityType,
      status: { type: 'boolean' },
      variants: { type: 'array', items: { $ref: '#/components/schemas/PlanVariantInput' } },
    },
  },
  TogglePlanStatusRequest: {
    type: 'object',
    required: ['id', 'status'],
    properties: { id: { type: 'integer', example: 1 }, status: { type: 'boolean', example: true } },
  },
  CreateCountryRequest: {
    type: 'object',
    required: ['name'],
    properties: { name: { type: 'string', example: 'India' } },
  },
  UpdateCountryRequest: {
    type: 'object',
    required: ['id', 'name'],
    properties: { id: { type: 'integer', example: 1 }, name: { type: 'string', example: 'India' } },
  },
  CreateStateRequest: {
    type: 'object',
    required: ['name', 'country_id'],
    properties: { name: { type: 'string', example: 'Maharashtra' }, country_id: { type: 'integer', example: 101 } },
  },
  UpdateStateRequest: {
    type: 'object',
    required: ['id', 'name', 'country_id'],
    properties: {
      id: { type: 'integer', example: 1 },
      name: { type: 'string', example: 'Maharashtra' },
      country_id: { type: 'integer', example: 101 },
    },
  },
  CreateCityRequest: {
    type: 'object',
    required: ['name', 'state_id'],
    properties: { name: { type: 'string', example: 'Mumbai' }, state_id: { type: 'integer', example: 4023 } },
  },
  UpdateCityRequest: {
    type: 'object',
    required: ['id', 'name', 'state_id'],
    properties: {
      id: { type: 'integer', example: 1 },
      name: { type: 'string', example: 'Mumbai' },
      state_id: { type: 'integer', example: 4023 },
    },
  },
  CreateCasteRequest: {
    type: 'object',
    required: ['caste'],
    properties: { caste: { type: 'string', example: 'Sunni' } },
  },
  UpdateCasteRequest: {
    type: 'object',
    required: ['id', 'caste'],
    properties: { id: { type: 'integer', example: 1 }, caste: { type: 'string', example: 'Sunni' } },
  },
  CreateSubCasteRequest: {
    type: 'object',
    required: ['subcaste', 'caste_id'],
    properties: { subcaste: { type: 'string', example: 'Hanafi' }, caste_id: { type: 'integer', example: 1 } },
  },
  UpdateSubCasteRequest: {
    type: 'object',
    required: ['id', 'subcaste', 'caste_id'],
    properties: {
      id: { type: 'integer', example: 1 },
      subcaste: { type: 'string', example: 'Hanafi' },
      caste_id: { type: 'integer', example: 1 },
    },
  },
  CreateFaqRequest: {
    type: 'object',
    required: ['question', 'answer'],
    properties: {
      question: { type: 'string', example: 'How do I register?' },
      answer: { type: 'string', example: 'Click Register and fill the form.' },
    },
  },
  UpdateFaqRequest: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'integer', example: 1 }, question: { type: 'string' }, answer: { type: 'string' } },
  },
  CreateStoryRequest: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      client_name: { type: 'string' },
      review: { type: 'string' },
      rating: { type: 'integer', example: 5 },
      image: { type: 'string' },
    },
  },
  UpdateStoryRequest: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'integer', example: 1 },
      title: { type: 'string' },
      client_name: { type: 'string' },
      review: { type: 'string' },
      rating: { type: 'integer' },
      image: { type: 'string' },
    },
  },
  CreateBlogCategoryRequest: {
    type: 'object',
    required: ['category_name'],
    properties: { category_name: { type: 'string', example: 'Marriage Tips' }, image: { type: 'string' } },
  },
  UpdateBlogCategoryRequest: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'integer', example: 1 }, category_name: { type: 'string' }, image: { type: 'string' } },
  },
  CreateBlogRequest: {
    type: 'object',
    required: ['title', 'content', 'blog_category_id'],
    properties: {
      title: { type: 'string', example: 'How to choose a partner' },
      content: { type: 'string', example: '<p>Article content</p>' },
      blog_category_id: { type: 'integer', example: 1 },
      tags: { type: 'string' },
      image: { type: 'string' },
    },
  },
  UpdateBlogRequest: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'integer', example: 1 },
      title: { type: 'string' },
      content: { type: 'string' },
      blog_category_id: { type: 'integer' },
      tags: { type: 'string' },
      image: { type: 'string' },
    },
  },
  UpsertPolicyRequest: {
    type: 'object',
    required: ['type', 'title'],
    properties: {
      type: policyType,
      title: { type: 'string', example: 'Privacy Policy' },
      content: { type: 'string', example: '<p>Policy content</p>' },
    },
  },
  UpdateCountersRequest: {
    type: 'object',
    properties: {
      no_of_members: { type: 'string', example: '10000+' },
      stories: { type: 'string', example: '500+' },
      total_cities: { type: 'string', example: '100+' },
    },
  },
  SendAdminMessageRequest: {
    type: 'object',
    required: ['receiver_id', 'message'],
    properties: {
      receiver_id: { type: 'integer', example: 1 },
      message: { type: 'string', example: 'Your profile has been verified.' },
    },
  },
  UploadPhotoRequest: {
    type: 'object',
    properties: {
      photo: { type: 'string', format: 'binary' },
      field: photoField,
    },
  },
};

export const S = (name: keyof typeof swaggerSchemas) => `#/components/schemas/${name}` as const;
