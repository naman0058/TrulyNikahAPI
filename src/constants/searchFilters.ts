/** Filter metadata aligned with the mobile Filters screen */

export const SEARCH_AGE_BUCKETS = [
  { value: '18-20', label: '18 - 20', age_from: 18, age_to: 20 },
  { value: '21-26', label: '21 - 26', age_from: 21, age_to: 26 },
  { value: '27-31', label: '27 - 31', age_from: 27, age_to: 31 },
  { value: '32-36', label: '32 - 36', age_from: 32, age_to: 36 },
  { value: '33-40', label: '33 - 40', age_from: 33, age_to: 40 },
  { value: '41-45', label: '41 - 45', age_from: 41, age_to: 45 },
  { value: '46-50', label: '46 - 50', age_from: 46, age_to: 50 },
  { value: '51-60', label: '51 - 60', age_from: 51, age_to: 60 },
  { value: '60+', label: '60+', age_from: 60, age_to: 100 },
] as const;

export const SEARCH_MARITAL_STATUS = [
  { value: 'divorced', label: 'Divorced' },
  { value: 'separated', label: 'Separated' },
  { value: 'widowed', label: 'Widowed' },
  { value: 'Never Married', label: 'Never Married' },
] as const;

export const SEARCH_MOTHER_TONGUES = [
  'Hindi/Urdu',
  'English',
  'Bengali',
  'Telugu',
  'Marathi',
  'Tamil',
  'Gujarati',
  'Kannada',
  'Odia',
  'Malayalam',
  'Punjabi',
  'Assamese',
  'Maithili',
  'Santali',
  'Kashmiri',
  'Nepali',
  'Konkani',
  'Sindhi',
  'Dogri',
  'Manipuri',
  'Bodo',
  'Sanskrit',
] as const;

export const SEARCH_EDUCATION = [
  'Below 10th',
  '10th',
  '12th',
  'Diploma',
  'Graduate',
  'Post Graduate',
  'Doctorate / Ph.D',
  'IAS / IPS / IRS / IFS',
  'Engineering - B.Tech / B.E',
  'Engineering - M.Tech / M.E',
  'Medical - MBBS',
  'Medical - MD / MS / MDS',
  'Management - BBA / MBA',
  'Finance - CA / CS / ICWA',
  'Law - LLB / LLM',
  'Other',
] as const;

export const SEARCH_EMPLOYED_IN = [
  { value: 'government', label: 'Government/Public Sector' },
  { value: 'private', label: 'Private Sector' },
  { value: 'business', label: 'Business/Self Employed' },
  { value: 'defence', label: 'Defence' },
  { value: 'police', label: 'Police' },
  { value: 'civil_services', label: 'Civil Services' },
  { value: 'not_working', label: 'Not Working' },
  { value: 'student', label: 'Student' },
] as const;

export const SEARCH_INCOME_BRACKETS = [
  { value: 'Rs. 0 - 1 Lakh', label: 'Rs. 0 - 1 Lakh', min_lakh: 0, max_lakh: 1 },
  { value: 'Rs. 1 - 2 Lakh', label: 'Rs. 1 - 2 Lakh', min_lakh: 1, max_lakh: 2 },
  { value: 'Rs. 2 - 3 Lakh', label: 'Rs. 2 - 3 Lakh', min_lakh: 2, max_lakh: 3 },
  { value: 'Rs. 3 - 4 Lakh', label: 'Rs. 3 - 4 Lakh', min_lakh: 3, max_lakh: 4 },
  { value: 'Rs. 4 - 5 Lakh', label: 'Rs. 4 - 5 Lakh', min_lakh: 4, max_lakh: 5 },
  { value: 'Rs. 5 - 7 Lakh', label: 'Rs. 5 - 7 Lakh', min_lakh: 5, max_lakh: 7 },
  { value: 'Rs. 7 - 10 Lakh', label: 'Rs. 7 - 10 Lakh', min_lakh: 7, max_lakh: 10 },
  { value: 'Rs. 10 - 12 Lakh', label: 'Rs. 10 - 12 Lakh', min_lakh: 10, max_lakh: 12 },
  { value: 'Rs. 12 - 15 Lakh', label: 'Rs. 12 - 15 Lakh', min_lakh: 12, max_lakh: 15 },
  { value: 'Rs. 15 - 20 Lakh', label: 'Rs. 15 - 20 Lakh', min_lakh: 15, max_lakh: 20 },
  { value: 'Rs. 20 - 35 Lakh', label: 'Rs. 20 - 35 Lakh', min_lakh: 20, max_lakh: 35 },
  { value: 'Rs. 35 - 50 Lakh', label: 'Rs. 35 - 50 Lakh', min_lakh: 35, max_lakh: 50 },
  { value: 'Rs. 50 - 75 Lakh', label: 'Rs. 50 - 75 Lakh', min_lakh: 50, max_lakh: 75 },
  { value: 'Rs. 75 - 100 Lakh', label: 'Rs. 75 - 100 Lakh', min_lakh: 75, max_lakh: 100 },
  { value: 'Rs. 1 Crore & Above', label: 'Rs. 1 Crore & Above', min_lakh: 100, max_lakh: 9999 },
] as const;

export function getSearchFilterOptions() {
  return {
    age_buckets: SEARCH_AGE_BUCKETS,
    marital_status: SEARCH_MARITAL_STATUS,
    mother_tounge: SEARCH_MOTHER_TONGUES,
    highest_education: SEARCH_EDUCATION,
    employed_in: SEARCH_EMPLOYED_IN,
    annual_income: SEARCH_INCOME_BRACKETS,
    height: {
      description: 'Send height_from and height_to as strings like "5ft 0in" or inch numbers',
      example_from: '5ft 0in',
      example_to: '6ft 2in',
    },
    sect: { description: 'Use GET /castes or partner preference sect IDs stored on profile' },
    cast: { description: 'Use GET /castes — send caste ID(s) as string or array' },
    country: { description: 'Use GET /locations/countries — send country ID(s)' },
  };
}
