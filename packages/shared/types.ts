export const DASHBOARD_ROLES = {
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  COMMUNITY_COORDINATOR: 'COMMUNITY_COORDINATOR',
  OPERATIONS_ADMINISTRATOR: 'OPERATIONS_ADMINISTRATOR',
  REGIONAL_COORDINATOR: 'REGIONAL_COORDINATOR',
  CASE_VERIFICATION_OFFICER: 'CASE_VERIFICATION_OFFICER',
  STORY_MODERATOR: 'STORY_MODERATOR',
  EDITOR: 'EDITOR',
  REVIEWER: 'REVIEWER',
  SAFEGUARDING_OFFICER: 'SAFEGUARDING_OFFICER',
  PUBLISHER: 'PUBLISHER',
  CAMPAIGN_MANAGER: 'CAMPAIGN_MANAGER',
  OUTREACH_OFFICER: 'OUTREACH_OFFICER',
  READ_ONLY_AUDITOR: 'READ_ONLY_AUDITOR',
} as const;

export type DashboardRole = (typeof DASHBOARD_ROLES)[keyof typeof DASHBOARD_ROLES];
export const ALL_DASHBOARD_ROLES = Object.values(DASHBOARD_ROLES) as DashboardRole[];

export const ROLE_DISPLAY_NAMES: Record<DashboardRole, string> = {
  PLATFORM_ADMIN: 'Platform Administrator',
  COMMUNITY_COORDINATOR: 'Community Coordinator',
  OPERATIONS_ADMINISTRATOR: 'Operations Administrator',
  REGIONAL_COORDINATOR: 'Regional Coordinator',
  CASE_VERIFICATION_OFFICER: 'Case Verification Officer',
  STORY_MODERATOR: 'Story Moderator',
  EDITOR: 'Editorial Editor',
  REVIEWER: 'Editorial Reviewer',
  SAFEGUARDING_OFFICER: 'Safeguarding Officer',
  PUBLISHER: 'Publisher',
  CAMPAIGN_MANAGER: 'Campaign Manager',
  OUTREACH_OFFICER: 'Outreach Officer',
  READ_ONLY_AUDITOR: 'Read-Only Auditor',
};

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
  'REVISION_REQUESTED',
  'RESUBMITTED',
  'APPROVED',
  'SCHEDULED',
  'PUBLISHED',
  'UNPUBLISHED',
  'REJECTED',
  'ARCHIVED',
  'WITHDRAWN',
] as const;
export type StoryStatus = (typeof STORY_STATUSES)[number];

export const CAMPAIGN_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
  'ARCHIVED',
  'CLOSED',
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const ARTICLE_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REVISION_REQUESTED',
  'REJECTED',
  'PUBLISHED',
  'ARCHIVED',
] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

export const CMS_CONTENT_TYPES = [
  'ANNOUNCEMENT',
  'PROJECT',
  'EVENT',
  'IMPACT_REPORT',
  'GALLERY',
  'VOLUNTEER_OPPORTUNITY',
  'VACANCY',
  'INTERNSHIP',
  'PUBLICATION',
  'EMERGENCY_NOTICE',
  'COMMUNITY_UPDATE',
  'SUCCESS_STORY',
] as const;
export type CmsContentType = (typeof CMS_CONTENT_TYPES)[number];

export const CMS_CONTENT_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'SCHEDULED',
  'PUBLISHED',
  'ARCHIVED',
  'REJECTED',
] as const;
export type CmsContentStatus = (typeof CMS_CONTENT_STATUSES)[number];

export const CMS_CONTENT_SECTIONS: Record<CmsContentType, { label: string; path: string }> = {
  ANNOUNCEMENT: { label: 'Announcements', path: 'announcements' },
  PROJECT: { label: 'Projects & Programmes', path: 'projects' },
  EVENT: { label: 'Events & Activities', path: 'events' },
  IMPACT_REPORT: { label: 'Impact Reports', path: 'impact-reports' },
  GALLERY: { label: 'Photo Galleries & Videos', path: 'galleries' },
  VOLUNTEER_OPPORTUNITY: { label: 'Volunteer Opportunities', path: 'volunteer-opportunities' },
  VACANCY: { label: 'Vacancies', path: 'vacancies' },
  INTERNSHIP: { label: 'Internships', path: 'internships' },
  PUBLICATION: { label: 'Publications & Downloads', path: 'publications' },
  EMERGENCY_NOTICE: { label: 'Emergency Notices', path: 'emergency-notices' },
  COMMUNITY_UPDATE: { label: 'Community Updates', path: 'community-updates' },
  SUCCESS_STORY: { label: 'Success Stories', path: 'success-stories' },
};

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
    'admin:users:roles',
    'admin:cases:review',
    'admin:cases:verify',
    'admin:cases:assign',
    'admin:cases:confidential',
    'admin:stories:moderate',
    'admin:stories:publish',
    'admin:campaigns:manage',
    'admin:campaigns:assign',
    'admin:campaigns:approve',
    'admin:campaigns:publish',
    'admin:outreach:manage',
    'admin:announcements:manage',
    'admin:assistance:manage',
    'admin:news:publish',
    'admin:donations:reconcile',
    'admin:financials:export',
    'admin:volunteers:manage',
    'admin:partners:manage',
    'admin:news:manage',
    'admin:safeguarding:manage',
    'admin:documents:manage',
    'admin:analytics:read',
    'admin:settings:manage',
    'admin:audit:read',
  ],
  OPERATIONS_ADMINISTRATOR: [
    'admin:dashboard:read',
    'admin:users:manage',
    'admin:coordinators:manage',
    'admin:cases:review',
    'admin:cases:assign',
    'admin:campaigns:manage',
    'admin:campaigns:assign',
    'admin:campaigns:approve',
    'admin:campaigns:publish',
    'admin:outreach:manage',
    'admin:announcements:manage',
    'admin:assistance:manage',
    'admin:news:manage',
    'admin:news:publish',
    'admin:analytics:read',
    'admin:audit:read',
  ],
  REGIONAL_COORDINATOR: [
    'admin:dashboard:read',
    'admin:cases:review',
    'admin:cases:assign',
    'admin:campaigns:manage',
    'admin:campaigns:assign',
    'admin:outreach:manage',
    'admin:analytics:read',
  ],
  CASE_VERIFICATION_OFFICER: [
    'admin:dashboard:read',
    'admin:cases:review',
    'admin:cases:verify',
    'admin:cases:confidential',
  ],
  STORY_MODERATOR: [
    'admin:dashboard:read',
    'admin:stories:moderate',
  ],
  EDITOR: [
    'admin:dashboard:read',
    'admin:stories:moderate',
    'admin:news:manage',
  ],
  REVIEWER: [
    'admin:dashboard:read',
    'admin:stories:moderate',
    'admin:news:manage',
  ],
  SAFEGUARDING_OFFICER: [
    'admin:dashboard:read',
    'admin:stories:moderate',
  ],
  PUBLISHER: [
    'admin:dashboard:read',
    'admin:stories:moderate',
    'admin:stories:publish',
    'admin:news:manage',
    'admin:news:publish',
  ],
  CAMPAIGN_MANAGER: [
    'admin:dashboard:read',
    'admin:campaigns:manage',
    'admin:campaigns:assign',
  ],
  OUTREACH_OFFICER: [
    'admin:dashboard:read',
    'admin:outreach:manage',
    'admin:news:manage',
    'admin:news:publish',
  ],
  READ_ONLY_AUDITOR: [
    'admin:dashboard:read',
    'admin:analytics:read',
    'admin:audit:read',
  ],
  COMMUNITY_COORDINATOR: [
    'coordinator:dashboard:read',
    'coordinator:cases:create',
    'coordinator:cases:read_own',
    'coordinator:cases:update_own',
    'coordinator:stories:submit',
    'coordinator:stories:read_own',
    'coordinator:content:submit',
    'coordinator:assistance:submit',
    'coordinator:reports:submit',
    'coordinator:notifications:read',
    'coordinator:profile:manage',
  ],
} as const;

export function hasPermission(role: DashboardRole, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
