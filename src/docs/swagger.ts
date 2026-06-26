import swaggerJsdoc from 'swagger-jsdoc';
import { OpenAPIV3 } from 'openapi-types';
import config from '../config';
import { buildSwaggerPaths } from './swagger.paths';
import { swaggerSchemas } from './swagger.schemas';
import {
  collectTagsFromPaths,
  filterSwaggerPaths,
  filterSwaggerTagDefinitions,
} from './swagger.filter';

const ALL_TAGS: OpenAPIV3.TagObject[] = [
  { name: 'Auth', description: 'Registration, login, OTP, onboarding' },
  { name: 'Profile', description: 'User profile management' },
  { name: 'Gallery', description: 'Profile photo uploads' },
  { name: 'Discovery', description: 'Dashboard, search, profiles' },
  { name: 'Social', description: 'Interests, shortlist, block, gallery requests, ignore, report' },
  { name: 'Messaging', description: 'Chat between matched users' },
  { name: 'Payments', description: 'Razorpay subscriptions' },
  { name: 'Public', description: 'Locations, castes, CMS content, plans, field options, search filters' },
  { name: 'Admin', description: 'Admin panel operations' },
];

function buildFilterDescription(): string {
  const { includeTags, excludeTags } = config.swagger;
  const parts: string[] = [];

  if (includeTags.length) parts.push(`**Included tags:** ${includeTags.join(', ')}`);
  if (excludeTags.length) parts.push(`**Excluded tags:** ${excludeTags.join(', ')}`);
  if (!parts.length) return '';

  return '\n\n---\n\n**Swagger filter active** (via `.env`):\n' + parts.join('\n') + '\n';
}

const allPaths = buildSwaggerPaths();
const filteredPaths = filterSwaggerPaths(allPaths, {
  includeTags: config.swagger.includeTags,
  excludeTags: config.swagger.excludeTags,
});
const visibleTags = collectTagsFromPaths(filteredPaths);
const tagDefinitions = filterSwaggerTagDefinitions(ALL_TAGS, visibleTags);

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'TrulyNikah API',
      version: '1.0.0',
      description:
        'Complete REST API for TrulyNikah matrimonial platform.\n\n' +
        '**Authentication:** Click **Authorize** and paste your JWT.\n\n' +
        '**Enum / dropdown fields:** Call `GET /reference/field-options` to get all allowed values ' +
        '(e.g. `profile_visibility`: no-one, everyone, interested, verified, premium). ' +
        'Each POST/PATCH schema also lists allowed values in the **Schema** tab.' +
        buildFilterDescription(),
      contact: { name: 'TrulyNikah', url: config.websiteUrl },
    },
    servers:
      config.env === 'development'
        ? [
            {
              url: `http://localhost:${config.port}${config.apiPrefix}`,
              description: 'Local — select this when testing on your PC',
            },
            {
              url: `${config.appUrl}${config.apiPrefix}`,
              description: 'Production (KVM)',
            },
          ]
        : [{ url: `${config.appUrl}${config.apiPrefix}`, description: 'Production' }],
    components: {
      securitySchemes: {
        BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'User JWT from POST /auth/login' },
        AdminBearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Admin JWT from POST /admin/auth/login',
        },
        InternalSecret: { type: 'apiKey', in: 'header', name: 'X-Internal-Secret' },
      },
      schemas: swaggerSchemas,
    },
    tags: tagDefinitions,
    paths: filteredPaths,
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);

export const swaggerUiOptions = {
  customSiteTitle: 'TrulyNikah API Docs',
  customCss: '.swagger-ui .topbar { display: none }',
  swaggerOptions: {
    persistAuthorization: true,
    tryItOutEnabled: true,
    displayRequestDuration: true,
    docExpansion: 'list',
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2,
    filter: true,
    syntaxHighlight: { activate: true, theme: 'agate' },
  },
};
