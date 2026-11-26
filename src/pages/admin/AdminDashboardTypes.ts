export interface AdminDashboardData {
  metrics: {
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    administratorUsers: number;
    failedLoginAttempts24h: number;
    activeCoordinators: number;
    verifiedCases: number;
    pendingCases: number;
    storiesAwaitingModeration: number;
    pendingBankTransfers: number;
    activeCampaigns: number;
    completedCampaigns: number;
    confirmedDonationsCount: number;
    confirmedDonationsUsd: number;
    totalFundsDistributedUsd: number;
    outstandingAssistanceRequests: number;
    openSafeguardingAlerts: number;
  };
  systemHealth: {
    api: string;
    database: string;
    status: string;
    databaseStatus: string;
    privateStorageStatus: string;
    publicMediaStatus: string;
    checkedAt: string;
  } | null;
  campaignPerformance: Array<{ title: string; targetAmount: number; raisedAmount: number }>;
  caseStatusBreakdown: Array<{ status: string; count: number }>;
  recentAudit: Array<{
    id: number;
    action: string;
    resourceType: string;
    resourceId: string | null;
    actorRole: string | null;
    createdAt: string;
  }>;
}
