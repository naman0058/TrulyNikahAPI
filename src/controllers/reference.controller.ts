import { asyncHandler, validate } from '../middleware';
import { FIELD_OPTIONS, FieldOptionKey } from '../constants/fieldOptions';
import { sendSuccess } from '../utils/response';
import { routeParam } from '../utils/helpers';
import { fieldOptionKeyParam } from '../utils/validation';

/** Public lookup — app developers call this to populate dropdowns and validate client-side */
export const getFieldOptions = asyncHandler(async (_req, res) => {
  const compact: Record<string, { values: string[]; options: (typeof FIELD_OPTIONS)[FieldOptionKey] }> = {};

  for (const [key, options] of Object.entries(FIELD_OPTIONS)) {
    compact[key] = {
      values: options.map((o) => o.value),
      options,
    };
  }

  return sendSuccess(res, 'Field options for forms and validation', compact);
});

export const getFieldOptionByKey = [
  validate([fieldOptionKeyParam()]),
  asyncHandler(async (req, res) => {
    const key = routeParam(req.params.key) as FieldOptionKey;
    const options = FIELD_OPTIONS[key];

    return sendSuccess(res, `${key} allowed values`, {
      key,
      values: options.map((o) => o.value),
      options,
    });
  }),
];
