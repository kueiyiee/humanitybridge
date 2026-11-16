export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'HumanityBridge REST API',
    version: '1.0.0',
    description:
      'Humanitarian storytelling, verified case management, campaign fundraising, and safeguarding API for HumanityBridge.',
  },
  servers: [{ url: '/api/v1' }],
  paths: {
    '/auth/login': {
      post: { summary: 'Authenticate user and issue HTTP-only session cookie', tags: ['Authentication'] },
    },
    '/auth/register': {
      post: { summary: 'Apply for a Community Coordinator account (requires Admin approval)', tags: ['Authentication'] },
    },
    '/auth/me': {
      get: { summary: 'Return authenticated user profile and permissions', tags: ['Authentication'] },
    },
    '/stories': {
      get: { summary: 'List publicly approved and published humanitarian stories', tags: ['Public Stories'] },
    },
    '/stories/{slug}': {
      get: { summary: 'Fetch single published humanitarian story by slug', tags: ['Public Stories'] },
    },
    '/cases': {
      get: { summary: 'List verified public humanitarian cases (confidential contact data excluded)', tags: ['Humanitarian Cases'] },
    },
    '/cases/{reference}': {
      get: { summary: 'Fetch verified public case details & QR verification summary', tags: ['Humanitarian Cases'] },
    },
    '/campaigns': {
      get: { summary: 'List active and completed fundraising campaigns', tags: ['Campaigns'] },
    },
    '/campaigns/{slug}': {
      get: { summary: 'Fetch campaign details and linked verified cases', tags: ['Campaigns'] },
    },
    '/donations': {
      post: { summary: 'Initiate a donation intent via configured PaymentAdapter', tags: ['Donations'] },
    },
    '/donations/webhook': {
      post: { summary: 'Idempotent HMAC-verified payment provider confirmation callback', tags: ['Donations'] },
    },
    '/donations/{reference}/status': {
      get: { summary: 'Check donation verification status and receipt', tags: ['Donations'] },
    },
    '/coordinator/dashboard': {
      get: { summary: 'Community Coordinator personal dashboard metrics', tags: ['Coordinator'] },
    },
    '/coordinator/cases': {
      get: { summary: 'List coordinator own submitted cases', tags: ['Coordinator'] },
      post: { summary: 'Submit or save draft humanitarian case', tags: ['Coordinator'] },
    },
    '/coordinator/stories': {
      post: { summary: 'Submit humanitarian story with explicit consent flags', tags: ['Coordinator'] },
    },
    '/coordinator/reports': {
      post: { summary: 'Submit field visit & assistance delivery report', tags: ['Coordinator'] },
    },
    '/admin/dashboard': {
      get: { summary: 'Executive Overview live relational statistics (PLATFORM_ADMIN only)', tags: ['Admin'] },
    },
    '/admin/users': {
      get: { summary: 'List and filter platform accounts (PLATFORM_ADMIN only)', tags: ['Admin'] },
    },
    '/admin/cases/{id}/verify': {
      patch: { summary: 'Verify, reject, or request info on a submitted case', tags: ['Admin'] },
    },
    '/admin/stories/{id}/review': {
      patch: { summary: 'Approve, publish, reject, or archive a story', tags: ['Admin'] },
    },
    '/admin/campaigns': {
      post: { summary: 'Create or update humanitarian campaign', tags: ['Admin'] },
    },
    '/admin/donations': {
      get: { summary: 'View and reconcile donations and refunds', tags: ['Admin'] },
    },
    '/admin/audit-logs': {
      get: { summary: 'Inspect immutable administrative and security audit trail', tags: ['Admin'] },
    },
  },
};
