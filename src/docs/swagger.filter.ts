import { OpenAPIV3 } from 'openapi-types';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'] as const;

export type SwaggerFilterOptions = {
  /** If set, only operations with at least one of these tags are included */
  includeTags?: string[];
  /** Operations with any of these tags are excluded */
  excludeTags?: string[];
};

function isOperationObject(value: unknown): value is OpenAPIV3.OperationObject {
  return typeof value === 'object' && value !== null && 'responses' in value;
}

function operationVisible(tags: string[], include: string[] | undefined, exclude: string[] | undefined): boolean {
  if (include?.length && !tags.some((t) => include.includes(t))) return false;
  if (exclude?.length && tags.some((t) => exclude.includes(t))) return false;
  return true;
}

/** Filter OpenAPI paths by operation tags (SWAGGER_TAGS / SWAGGER_EXCLUDE_TAGS). */
export function filterSwaggerPaths(
  paths: OpenAPIV3.PathsObject,
  opts: SwaggerFilterOptions
): OpenAPIV3.PathsObject {
  const include = opts.includeTags?.map((t) => t.trim()).filter(Boolean);
  const exclude = opts.excludeTags?.map((t) => t.trim()).filter(Boolean);

  if (!include?.length && !exclude?.length) return paths;

  const filtered: OpenAPIV3.PathsObject = {};

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem) continue;
    const kept: OpenAPIV3.PathItemObject = {};

    for (const method of HTTP_METHODS) {
      const op = pathItem[method];
      if (!isOperationObject(op)) continue;
      const tags = op.tags ?? [];
      if (!operationVisible(tags, include, exclude)) continue;
      kept[method] = op;
    }

    if (Object.keys(kept).length > 0) filtered[path] = kept;
  }

  return filtered;
}

/** Collect tag names still present after path filtering. */
export function collectTagsFromPaths(paths: OpenAPIV3.PathsObject): Set<string> {
  const tagNames = new Set<string>();

  for (const pathItem of Object.values(paths)) {
    if (!pathItem) continue;
    for (const method of HTTP_METHODS) {
      const op = pathItem[method];
      if (!isOperationObject(op)) continue;
      op.tags?.forEach((t) => tagNames.add(t));
    }
  }

  return tagNames;
}

export function filterSwaggerTagDefinitions(
  tags: OpenAPIV3.TagObject[],
  allowedTagNames: Set<string>
): OpenAPIV3.TagObject[] {
  return tags.filter((t) => allowedTagNames.has(t.name));
}
