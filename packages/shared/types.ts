export const DASHBOARD_ROLES = {
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  COMMUNITY_COORDINATOR: 'COMMUNITY_COORDINATOR',
} as const;

export type DashboardRole = (typeof DASHBOARD_ROLES)[keyof typeof DASHBOARD_ROLES];

export const CASE_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'INFO_REQUESTED',
  'VERIFIED',
  'REJECTED',
  'CLOSED',
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const URGENCY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];

export const STORY_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'PUBLISHED',
  'REJECTED',
  'ARCHIVED',
] as const;
export type StoryStatus = (typeof STORY_STATUSES)[number];

export const CAMPAIGN_STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CLOSED'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const DONATION_STATUSES = [
  'INITIATED',
  'PENDING_VERIFICATION',
  'CONFIRMED',
  'FAILED',
  'REFUNDED',
  'DISPUTED',
] as const;
export type DonationStatus = (typeof DONATION_STATUSES)[number];

export const ASSISTANCE_REQUEST_STATUSES = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'DISBURSED',
  'REJECTED',
] as const;
export type AssistanceRequestStatus = (typeof ASSISTANCE_REQUEST_STATUSES)[number];

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    [key: string]: unknown;
  };
}

export interface AuthUser {
  id: number;
  email: string;
  role: DashboardRole;
  displayName: string;
  region?: string | null;
  status: string;
  emailVerified: boolean;
  mfaEnabled: boolean;
  avatarUrl?: string | null;
}

export const ROLE_PERMISSIONS: Record<DashboardRole, readonly string[]> = {
  PLATFORM_ADMIN: [
    'admin:dashboard:read',
    'admin:users:manage',
    'admin:coordinators:manage',
    'admin:cases:review',
    'admin:cases:verify',
    'admin:cases:confidential',
    'admin:stories:moderate',
    'admin:stories:publish',
    'admin:campaigns:manage',
    'admin:donations:reconcile',
    'admin:financials:export',
    'admin:volunteers:manage',
    'admin:partners:manage',
    'admin:news:manage',
    'admin:safeguarding:manage',
    'admin:analytics:read',
    'admin:settings:manage',
    'admin:audit:read',
  ],
  COMMUNITY_COORDINATOR: [
    'coordinator:dashboard:read',
    'coordinator:cases:create',
    'coordinator:cases:read_own',
    'coordinator:cases:update_own',
    'coordinator:stories:submit',
    'coordinator:stories:read_own',
    'coordinator:assistance:submit',
    'coordinator:reports:submit',
    'coordinator:notifications:read',
    'coordinator:profile:manage',
  ],
} as const;

export function hasPermission(role: DashboardRole, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
