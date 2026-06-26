import {
  SEARCH_AGE_BUCKETS,
  SEARCH_EDUCATION,
  SEARCH_INCOME_BRACKETS,
  SEARCH_MARITAL_STATUS,
  SEARCH_MOTHER_TONGUES,
} from './searchFilters';

export const PARTNER_OCCUPATION_OPTIONS = [
  'Government Employee',
  'Private Job',
  'Business',
  'Self Employed',
  'Doctor',
  'Engineer',
  'Teacher / Professor',
  'Lawyer / Legal Professional',
  'Accountant / Finance Professional',
  'Administrative Professional',
  'Civil Services (IAS/IPS/IFS)',
  'Defense Personnel',
  'Police / Law Enforcement',
  'IT Professional',
  'Research Scholar / Scientist',
  'Actor / Artist / Media',
  'Architect',
  'Pilot / Aviation',
  'Farmer / Agriculturist',
  'Not Working',
  'Retired',
  'Other',
] as const;

/** All partner preference fields — every field is optional on POST */
export const PARTNER_PREFERENCE_FIELD_META = [
  { key: 'marital_status', label: 'Marital status', type: 'select' },
  { key: 'age_from', label: 'Age from', type: 'integer', min: 18, max: 100 },
  { key: 'age_to', label: 'Age to', type: 'integer', min: 18, max: 100 },
  { key: 'highest_education', label: 'Highest education', type: 'select' },
  { key: 'mother_tounge', label: 'Mother tongue', type: 'select' },
  { key: 'sect', label: 'Sect', type: 'id', lookup: 'GET /castes' },
  { key: 'cast', label: 'Caste', type: 'id', lookup: 'GET /castes/{casteId}/sub-castes' },
  { key: 'height_from', label: 'Height from', type: 'height', example: '5ft 0in' },
  { key: 'height_to', label: 'Height to', type: 'height', example: '6ft 0in' },
  { key: 'occupation', label: 'Occupation', type: 'select' },
  { key: 'country', label: 'Country', type: 'id', lookup: 'GET /locations/countries' },
  { key: 'state', label: 'State', type: 'id', lookup: 'GET /locations/countries/{countryId}/states' },
  { key: 'city', label: 'City', type: 'id', lookup: 'GET /locations/states/{stateId}/cities' },
  { key: 'annual_income', label: 'Annual income', type: 'select' },
] as const;

export function getPartnerPreferenceFieldOptions() {
  return {
    fields: PARTNER_PREFERENCE_FIELD_META,
    marital_status: SEARCH_MARITAL_STATUS,
    age_buckets: SEARCH_AGE_BUCKETS,
    age_range: { min: 18, max: 100, description: 'Send age_from and age_to as integers' },
    highest_education: SEARCH_EDUCATION,
    mother_tounge: SEARCH_MOTHER_TONGUES,
    occupation: PARTNER_OCCUPATION_OPTIONS,
    annual_income: SEARCH_INCOME_BRACKETS,
    height: {
      description: 'Send height_from and height_to as strings like "5ft 4in" or inch numbers',
      example_from: '5ft 0in',
      example_to: '6ft 2in',
    },
    sect: { description: 'Load options from GET /castes — send sect ID' },
    cast: { description: 'Load options from GET /castes/{id}/sub-castes — send cast ID' },
    country: { description: 'Load options from GET /locations/countries' },
    state: { description: 'Load options from GET /locations/countries/{countryId}/states' },
    city: { description: 'Load options from GET /locations/states/{stateId}/cities' },
  };
}
