import { db, schema, nowUtc } from '../../src/db/index';
import { hashPasswordArgon2id, generateTotpSecret } from '../../src/server/utils/crypto';
import { DASHBOARD_ROLES, ROLE_PERMISSIONS } from '../../packages/shared/types';
import { count } from 'drizzle-orm';

export async function seedIfEmpty() {
  const [{ value: userCount }] = await db.select({ value: count() }).from(schema.users);
  if (Number(userCount) > 0) {
    return { seeded: false, reason: 'Database already populated' };
  }

  const ts = nowUtc();

  // 1. Roles & Permissions
  await db.insert(schema.roles).values([
    {
      code: DASHBOARD_ROLES.PLATFORM_ADMIN,
      displayName: 'Platform Administrator',
      description: 'Full governance, verification, editorial, financial, and safeguarding authority.',
      createdAt: ts,
    },
    {
      code: DASHBOARD_ROLES.COMMUNITY_COORDINATOR,
      displayName: 'Community Coordinator',
      description: 'Field intake, case submission, story authoring, and community outreach reporting.',
      createdAt: ts,
    },
  ]);

  const permissionRows = Object.entries(ROLE_PERMISSIONS).flatMap(([roleCode, perms]) =>
    perms.map((permissionKey) => ({
      roleCode,
      permissionKey,
      description: `${roleCode} capability: ${permissionKey}`,
    })),
  );
  await db.insert(schema.permissions).values(permissionRows);

  // 2. Bootstrap Admin & Sample Community Coordinators (dev/initial seed)
  const adminEmail = process.env.ADMIN_BOOTSTRAP_EMAIL || 'admin@humanitybridge.org';
  const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD || 'BridgeAdmin#2026';

  await db.insert(schema.users).values([
    {
      email: adminEmail,
      passwordHash: hashPasswordArgon2id(adminPassword),
      role: DASHBOARD_ROLES.PLATFORM_ADMIN,
      status: 'ACTIVE',
      emailVerified: true,
      mfaEnabled: false,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      email: 'nyamal.gatluak@humanitybridge.org',
      passwordHash: hashPasswordArgon2id('Coordinator#2026'),
      role: DASHBOARD_ROLES.COMMUNITY_COORDINATOR,
      status: 'ACTIVE',
      emailVerified: true,
      mfaEnabled: false,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      email: 'daniel.otieno@humanitybridge.org',
      passwordHash: hashPasswordArgon2id('Coordinator#2026'),
      role: DASHBOARD_ROLES.COMMUNITY_COORDINATOR,
      status: 'ACTIVE',
      emailVerified: true,
      mfaEnabled: false,
      createdAt: ts,
      updatedAt: ts,
    },
  ]);

  const allUsers = await db.select().from(schema.users);
  const adminUser = allUsers.find((u) => u.role === DASHBOARD_ROLES.PLATFORM_ADMIN)!;
  const coord1 = allUsers.find((u) => u.email === 'nyamal.gatluak@humanitybridge.org')!;
  const coord2 = allUsers.find((u) => u.email === 'daniel.otieno@humanitybridge.org')!;

  await db.insert(schema.userProfiles).values([
    {
      userId: adminUser.id,
      displayName: 'Dr. Amara Mensah',
      region: 'Global Operations Hub',
      organization: 'HumanityBridge Secretariat',
      bio: 'Director of Humanitarian Governance and Safeguarding.',
      preferredLanguage: 'en',
      createdAt: ts,
      updatedAt: ts,
    },
    {
      userId: coord1.id,
      displayName: 'Nyamal Gatluak',
      region: 'Upper Nile Corridor',
      organization: 'Community Water & Maternal Outreach',
      bio: 'Field coordinator supporting displaced households and community health posts.',
      preferredLanguage: 'en',
      createdAt: ts,
      updatedAt: ts,
    },
    {
      userId: coord2.id,
      displayName: 'Daniel Otieno',
      region: 'Turkana Basin',
      organization: 'Dryland Resilience Cooperative',
      bio: 'Community liaison coordinating agricultural irrigation and youth learning centers.',
      preferredLanguage: 'en',
      createdAt: ts,
      updatedAt: ts,
    },
  ]);

  await db.insert(schema.mfaSettings).values({
    userId: adminUser.id,
    totpSecret: generateTotpSecret(),
    enabled: false,
    updatedAt: ts,
  });

  // 3. Categories & Community Locations
  await db.insert(schema.caseCategories).values([
    { slug: 'clean-water', name: 'Clean Water & Sanitation', description: 'Solar water hubs, filtration, and community boreholes.' },
    { slug: 'healthcare', name: 'Community Healthcare', description: 'Maternal kits, rural clinics, and essential medical equipment.' },
    { slug: 'education', name: 'Education & Youth', description: 'Learning centers, solar study rooms, and school supplies.' },
    { slug: 'livelihoods', name: 'Food Security & Livelihoods', description: 'Drip irrigation, seeds, and cooperative tools.' },
    { slug: 'shelter', name: 'Dignified Shelter', description: 'Weather-resilient housing repair and emergency relief.' },
  ].map((c) => ({ ...c, createdAt: ts })));

  await db.insert(schema.storyCategories).values([
    { slug: 'community-resilience', name: 'Community Resilience', description: 'Stories of local leadership and shared recovery.' },
    { slug: 'health-dignity', name: 'Health & Dignity', description: 'Frontline maternal and primary healthcare initiatives.' },
    { slug: 'education-futures', name: 'Education & Futures', description: 'Youth scholars and neighborhood learning spaces.' },
    { slug: 'sustainable-water', name: 'Sustainable Water', description: 'Solar water engineering led by local communities.' },
  ]);

  await db.insert(schema.articleCategories).values([
    { slug: 'field-dispatches', name: 'Field Dispatches' },
    { slug: 'transparency-reports', name: 'Transparency & Audits' },
    { slug: 'partnerships', name: 'Partnerships' },
  ]);

  await db.insert(schema.communityLocations).values([
    { regionName: 'Upper Nile Corridor', country: 'South Sudan', approximateLat: 9.53, approximateLng: 31.66, isActive: true, createdAt: ts },
    { regionName: 'Turkana Basin', country: 'Kenya', approximateLat: 3.12, approximateLng: 35.60, isActive: true, createdAt: ts },
    { regionName: 'Gambella Lowlands', country: 'Ethiopia', approximateLat: 8.25, approximateLng: 34.58, isActive: true, createdAt: ts },
    { regionName: 'Kassala Community Zone', country: 'Sudan', approximateLat: 15.45, approximateLng: 36.40, isActive: true, createdAt: ts },
  ]);

  const categories = await db.select().from(schema.caseCategories);
  const locations = await db.select().from(schema.communityLocations);
  const storyCats = await db.select().from(schema.storyCategories);
  const articleCats = await db.select().from(schema.articleCategories);

  // 4. Verified & Submitted Humanitarian Cases (never exposing private contact details publicly)
  await db.insert(schema.humanitarianCases).values([
    {
      referenceCode: 'HB-CASE-2026-101',
      title: 'Solar Clean Water Filtration Hub for Northern Health Cluster',
      categoryId: categories[0].id,
      locationId: locations[0].id,
      coordinatorId: coord1.id,
      publicSummary: 'Provides clean, pressurized drinking water for 420 households and an adjacent maternal health post, reducing waterborne illness and daily collection walks.',
      assistanceNeeded: 'Submersible solar pump, stainless distribution manifold, and 10,000L elevated storage tank.',
      affectedCount: 1680,
      urgencyLevel: 'HIGH',
      estimatedCostUsd: 18500,
      status: 'VERIFIED',
      isPublic: true,
      isChildRelated: false,
      guardianConsentObtained: false,
      beneficiaryConsentObtained: true,
      privateContactName: 'Confidential Local Water Committee Chair',
      privateContactPhone: '+000-RESTRICTED-01',
      privateLocationNotes: 'Restricted GPS verification dossier stored in private vault.',
      internalAdminNotes: 'Site engineering survey and community maintenance committee charter verified.',
      verifiedBy: adminUser.id,
      verifiedAt: ts,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      referenceCode: 'HB-CASE-2026-102',
      title: 'Maternal Care & Cold-Chain Solar Backup for Rural Clinic',
      categoryId: categories[1].id,
      locationId: locations[2].id,
      coordinatorId: coord1.id,
      publicSummary: 'Equips a community-run clinic serving expectant mothers with reliable nighttime solar lighting, sterile delivery kits, and vaccine refrigeration.',
      assistanceNeeded: '3kW solar battery bank, 250 sterile maternal care kits, and medical refrigeration unit.',
      affectedCount: 940,
      urgencyLevel: 'CRITICAL',
      estimatedCostUsd: 14200,
      status: 'VERIFIED',
      isPublic: true,
      isChildRelated: false,
      guardianConsentObtained: false,
      beneficiaryConsentObtained: true,
      privateContactName: 'Confidential Clinic Matron',
      privateContactPhone: '+000-RESTRICTED-02',
      privateLocationNotes: 'Health post registration certificate verified by regional coordinator.',
      internalAdminNotes: 'Cold-chain specifications reviewed by medical advisory desk.',
      verifiedBy: adminUser.id,
      verifiedAt: ts,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      referenceCode: 'HB-CASE-2026-103',
      title: 'Community Learning Library & Evening Study Solar Lamps',
      categoryId: categories[2].id,
      locationId: locations[1].id,
      coordinatorId: coord2.id,
      publicSummary: 'Supports secondary school scholars with shared textbooks, timber reading desks, and rechargeable study lamps for safe evening study.',
      assistanceNeeded: '600 curriculum textbooks, 12 reading tables, and 180 solar reading lamps.',
      affectedCount: 520,
      urgencyLevel: 'MEDIUM',
      estimatedCostUsd: 9600,
      status: 'VERIFIED',
      isPublic: true,
      isChildRelated: true,
      guardianConsentObtained: true,
      beneficiaryConsentObtained: true,
      privateContactName: 'Confidential Parent-Teacher Liaison',
      privateContactPhone: '+000-RESTRICTED-03',
      privateLocationNotes: 'Guardian consent forms filed under child safeguarding protocol.',
      internalAdminNotes: 'Child safeguarding review passed: zero identifying minor details in public profile.',
      verifiedBy: adminUser.id,
      verifiedAt: ts,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      referenceCode: 'HB-CASE-2026-104',
      title: 'Cooperative Drip Irrigation Expansion for 45 Smallholder Families',
      categoryId: categories[3].id,
      locationId: locations[1].id,
      coordinatorId: coord2.id,
      publicSummary: 'Expands drought-resilient vegetable cultivation through precision drip lines and community seed banks managed by women-led cooperatives.',
      assistanceNeeded: 'Drip irrigation tubing kits, drought-tolerant vegetable seeds, and solar water storage.',
      affectedCount: 270,
      urgencyLevel: 'HIGH',
      estimatedCostUsd: 12400,
      status: 'UNDER_REVIEW',
      isPublic: false,
      isChildRelated: false,
      guardianConsentObtained: false,
      beneficiaryConsentObtained: true,
      privateContactName: 'Confidential Cooperative Treasurer',
      privateContactPhone: '+000-RESTRICTED-04',
      privateLocationNotes: 'Awaiting final hydrological yield test upload.',
      internalAdminNotes: 'Pending final engineering attachment before verification.',
      createdAt: ts,
      updatedAt: ts,
    },
  ]);

  const seededCases = await db.select().from(schema.humanitarianCases);

  await db.insert(schema.caseVerifications).values([
    {
      caseId: seededCases[0].id,
      reviewerId: adminUser.id,
      decision: 'VERIFIED',
      notes: 'Hydrological assessment and community governance agreement confirmed.',
      publishPublicly: true,
      decidedAt: ts,
    },
    {
      caseId: seededCases[1].id,
      reviewerId: adminUser.id,
      decision: 'VERIFIED',
      notes: 'Clinic staffing and cold-chain inventory verified.',
      publishPublicly: true,
      decidedAt: ts,
    },
    {
      caseId: seededCases[2].id,
      reviewerId: adminUser.id,
      decision: 'VERIFIED',
      notes: 'Guardian consent records and safeguarding redaction checklist approved.',
      publishPublicly: true,
      decidedAt: ts,
    },
  ]);

  await db.insert(schema.caseStatusHistory).values(
    seededCases.map((c) => ({
      caseId: c.id,
      previousStatus: 'SUBMITTED',
      newStatus: c.status,
      changedBy: c.status === 'VERIFIED' ? adminUser.id : coord2.id,
      reason: c.status === 'VERIFIED' ? 'Verified and approved for public accountability ledger' : 'Submitted for verification review',
      changedAt: ts,
    })),
  );

  // 5. Published Humanitarian Stories (editorial quality with explicit consent records)
  await db.insert(schema.stories).values([
    {
      slug: 'solar-water-dignity-upper-nile',
      title: 'When Solar Water Reaches the Clinic Courtyard',
      categoryId: storyCats[3].id,
      authorId: coord1.id,
      regionName: 'Upper Nile Corridor',
      excerpt: 'How a locally trained maintenance committee and solar-powered water hub transformed daily life for 420 families and cut clinic wait times.',
      body: `Before the solar manifold was commissioned, mothers arriving at the neighborhood health post waited hours while water was hauled by hand from seasonal riverbeds.\n\nToday, six stainless taps fed by an elevated solar-pumped reservoir run quietly from dawn until dusk. What makes this project enduring is not the photovoltaic array overhead, but the seven-person community water committee that inspects pressure valves, keeps transparent maintenance ledgers, and trains young technicians.\n\nEvery decision—from tap placement to clinic priority lines—was shaped through open community assemblies before a single pipe was laid. Dignity begins when communities own both the infrastructure and the narrative of their progress.`,
      coverImageUrl: '/src/assets/images/hero_community_water_1794840710503.jpg',
      anonymousPublication: false,
      isMinorSubject: false,
      status: 'PUBLISHED',
      languageCode: 'en',
      publishedAt: ts,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      slug: 'maternal-care-kits-rural-clinic',
      title: 'Prepared Hands: Inside the Solar Maternal Care Unit',
      categoryId: storyCats[1].id,
      authorId: coord1.id,
      regionName: 'Gambella Lowlands',
      excerpt: 'Inside a sunlit community clinic where reliable solar lighting and organized maternal care kits help nurses welcome newborns safely.',
      body: `At 6:30 a.m., Nurse Grace arranges sterile maternal care kits along the timber bench beneath open clinic windows. Three years ago, night deliveries relied on handheld torches and intermittent generators.\n\nThrough verified case support and transparent community procurement, the clinic received a dedicated solar battery bank and 250 pre-packed delivery kits containing clean linens, cord clamps, and postnatal care supplies.\n\nCommunity coordinators documented every delivery batch with the health post matron, ensuring full inventory transparency while safeguarding patient privacy. Nothing about patient medical files ever enters public view—only the measurable readiness of the clinic serving them.`,
      coverImageUrl: '/src/assets/images/story_mobile_clinic_1794840712133.jpg',
      anonymousPublication: false,
      isMinorSubject: false,
      status: 'PUBLISHED',
      languageCode: 'en',
      publishedAt: ts,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      slug: 'sunlit-study-tables-turkana',
      title: 'A Quiet Room of Books and Evening Light',
      categoryId: storyCats[2].id,
      authorId: coord2.id,
      regionName: 'Turkana Basin',
      excerpt: 'Community educators and parents built a shared study hall where scholars prepare for national exams with reliable books and solar lamps.',
      body: `Every afternoon after classes end, the community learning hall opens its tall casement windows to catch the breeze across the courtyard. Around long timber tables, students share science textbooks and compare notes in calm focus.\n\nBecause guardian consent and child safeguarding come before publicity, no student surnames or residential details are ever collected or published. Instead, coordinators worked with the parent-teacher association to verify textbook shortages and equip 180 households with rechargeable reading lamps.\n\nExam pass rates rose steadily over two terms, driven not by outside intervention alone, but by parents, teachers, and supporters investing in quiet, reliable infrastructure.`,
      coverImageUrl: '/src/assets/images/story_youth_education_1794840712011.jpg',
      anonymousPublication: true,
      isMinorSubject: true,
      status: 'PUBLISHED',
      languageCode: 'en',
      publishedAt: ts,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      slug: 'drip-irrigation-cooperative-draft',
      title: 'Early Harvests Along the Cooperative Drip Lines',
      categoryId: storyCats[0].id,
      authorId: coord2.id,
      regionName: 'Turkana Basin',
      excerpt: 'Forty-five smallholder families test low-pressure drip irrigation ahead of the dry season.',
      body: `Draft dispatch awaiting final editorial review and media consent confirmation from cooperative elders before publication.`,
      coverImageUrl: '/src/assets/images/campaign_agricultural_resilience_1794840712744.jpg',
      anonymousPublication: false,
      isMinorSubject: false,
      status: 'SUBMITTED',
      languageCode: 'en',
      createdAt: ts,
      updatedAt: ts,
    },
  ]);

  const seededStories = await db.select().from(schema.stories);
  await db.insert(schema.storyConsents).values(
    seededStories.map((s) => ({
      storyId: s.id,
      consentStory: true,
      consentMedia: true,
      consentIdentity: !s.anonymousPublication,
      guardianConsentRecorded: s.isMinorSubject,
      recordedAt: ts,
    })),
  );

  // 6. Active Humanitarian Campaigns
  const nextQuarter = new Date(Date.now() + 90 * 86400000).toISOString();
  await db.insert(schema.campaigns).values([
    {
      slug: 'solar-power-for-community-clinics',
      title: 'Solar Power for Rural Community Clinics',
      summary: 'Installing clean photovoltaic microgrids and cold-chain vaccine storage across four verified community clinics.',
      description: `Reliable electricity is the quiet foundation of safe childbirth, vaccine preservation, and emergency triage. This verified campaign funds commercial-grade rooftop solar arrays, lithium-iron-phosphate battery banks, and local technician training across four rural clinics.\n\nEvery dollar confirmed through the HumanityBridge ledger is reconciled against supplier invoices and documented by field coordinators with dated inspection photographs.`,
      targetAmount: 45000,
      raisedAmount: 28400,
      currency: 'USD',
      coverImageUrl: '/src/assets/images/campaign_clean_energy_1794840711620.jpg',
      status: 'ACTIVE',
      startDate: ts,
      endDate: nextQuarter,
      createdBy: adminUser.id,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      slug: 'climate-resilient-drip-irrigation',
      title: 'Drought-Resilient Cooperative Agriculture',
      summary: 'Equipping 120 smallholder farming families with water-saving drip irrigation and seed reserves.',
      description: `Erratic rainfall places severe strain on dryland farming cooperatives. By pairing gravity-fed drip irrigation kits with solar-pumped storage tanks, partner cooperatives cut water loss by up to 60% while growing nutritious leafy greens year-round.\n\nFunds support verified equipment procurement, agronomic workshops, and local cooperative governance.`,
      targetAmount: 32000,
      raisedAmount: 19750,
      currency: 'USD',
      coverImageUrl: '/src/assets/images/campaign_agricultural_resilience_1794840712744.jpg',
      status: 'ACTIVE',
      startDate: ts,
      endDate: nextQuarter,
      createdBy: adminUser.id,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      slug: 'clean-water-solar-hubs-2026',
      title: 'Community Solar Water Hubs Initiative',
      summary: 'Expanding safe, pressurized clean water points managed by local water user associations.',
      description: `Safe water near home frees hours each day for schooling and livelihoods while preventing waterborne illness. This campaign directly supports verified case HB-CASE-2026-101 and neighboring rural clusters.`,
      targetAmount: 25000,
      raisedAmount: 25000,
      currency: 'USD',
      coverImageUrl: '/src/assets/images/hero_community_water_1794840710503.jpg',
      status: 'COMPLETED',
      startDate: ts,
      endDate: ts,
      createdBy: adminUser.id,
      createdAt: ts,
      updatedAt: ts,
    },
  ]);

  const seededCampaigns = await db.select().from(schema.campaigns);
  await db.insert(schema.campaignCases).values([
    { campaignId: seededCampaigns[0].id, caseId: seededCases[1].id },
    { campaignId: seededCampaigns[2].id, caseId: seededCases[0].id },
  ]);

  // 7. Confirmed Donations & Reconciled Financial Ledger (actual DB records!)
  await db.insert(schema.donations).values([
    {
      donationReference: 'HB-DON-2026-9001',
      campaignId: seededCampaigns[0].id,
      caseId: seededCases[1].id,
      amount: 12500,
      currency: 'USD',
      donorName: 'Nordic Civic Health Foundation',
      donorEmail: 'grants@example.org',
      isAnonymous: false,
      dedicationNote: 'For maternal cold-chain reliability',
      status: 'CONFIRMED',
      paymentChannel: 'SANDBOX_BANK_TRANSFER',
      confirmedAt: ts,
      createdAt: ts,
    },
    {
      donationReference: 'HB-DON-2026-9002',
      campaignId: seededCampaigns[0].id,
      amount: 15900,
      currency: 'USD',
      donorName: 'Anonymous Supporter',
      donorEmail: 'supporter@example.org',
      isAnonymous: true,
      status: 'CONFIRMED',
      paymentChannel: 'SANDBOX_CARD',
      confirmedAt: ts,
      createdAt: ts,
    },
    {
      donationReference: 'HB-DON-2026-9003',
      campaignId: seededCampaigns[1].id,
      amount: 19750,
      currency: 'USD',
      donorName: 'Green Horizon Solidarity Fund',
      donorEmail: 'impact@example.org',
      isAnonymous: false,
      status: 'CONFIRMED',
      paymentChannel: 'SANDBOX_BANK_TRANSFER',
      confirmedAt: ts,
      createdAt: ts,
    },
    {
      donationReference: 'HB-DON-2026-9004',
      campaignId: seededCampaigns[2].id,
      caseId: seededCases[0].id,
      amount: 25000,
      currency: 'USD',
      donorName: 'Global Clean Water Circle',
      donorEmail: 'water@example.org',
      isAnonymous: false,
      status: 'CONFIRMED',
      paymentChannel: 'SANDBOX_BANK_TRANSFER',
      confirmedAt: ts,
      createdAt: ts,
    },
  ]);

  const seededDonations = await db.select().from(schema.donations);
  await db.insert(schema.paymentTransactions).values(
    seededDonations.map((d, idx) => ({
      donationId: d.id,
      provider: 'SANDBOX_GATEWAY',
      providerReference: `SBX-TX-2026-00${idx + 1}`,
      amount: d.amount,
      currency: d.currency,
      status: 'SETTLED',
      verifiedByWebhook: true,
      createdAt: ts,
    })),
  );

  await db.insert(schema.assistanceDistributions).values([
    {
      caseId: seededCases[0].id,
      amountUsd: 18500,
      currency: 'USD',
      approvedBy: adminUser.id,
      distributionNotes: 'Commissioned solar water filtration manifold and handed over maintenance kit.',
      distributedAt: ts,
    },
    {
      caseId: seededCases[1].id,
      amountUsd: 14200,
      currency: 'USD',
      approvedBy: adminUser.id,
      distributionNotes: 'Disbursed Phase 1 solar battery bank & 250 sterile maternal care kits.',
      distributedAt: ts,
    },
  ]);

  await db.insert(schema.financialRecords).values([
    {
      entryType: 'CONFIRMED_INFLOW',
      referenceCode: 'HB-DON-2026-9001',
      amount: 12500,
      currency: 'USD',
      campaignId: seededCampaigns[0].id,
      caseId: seededCases[1].id,
      description: 'Confirmed institutional grant for clinic solar power.',
      recordedAt: ts,
    },
    {
      entryType: 'DISBURSEMENT',
      referenceCode: 'HB-DISB-2026-001',
      amount: 18500,
      currency: 'USD',
      campaignId: seededCampaigns[2].id,
      caseId: seededCases[0].id,
      description: 'Verified supplier settlement for solar water hub manifold.',
      recordedAt: ts,
    },
  ]);

  // 8. Field Reports, Assistance Requests, News Articles & System Settings
  await db.insert(schema.assistanceRequests).values({
    caseId: seededCases[2].id,
    coordinatorId: coord2.id,
    supportType: 'Curriculum Textbooks & Solar Reading Lamps',
    requestedAmountUsd: 4800,
    justification: 'Second-term enrollment rose by 65 scholars; requesting remaining lamp allocation.',
    status: 'SUBMITTED',
    createdAt: ts,
    updatedAt: ts,
  });

  await db.insert(schema.fieldReports).values({
    coordinatorId: coord1.id,
    caseId: seededCases[0].id,
    locationId: locations[0].id,
    visitDate: ts,
    summary: 'Conducted 30-day post-commissioning water quality check and reviewed maintenance logs with local technicians.',
    assistanceDelivered: 'Delivered spare gasket kit and digital flow meter.',
    peopleReached: 1680,
    createdAt: ts,
  });

  await db.insert(schema.articles).values([
    {
      slug: 'q3-safeguarding-and-financial-accountability-brief',
      title: 'Quarterly Safeguarding & Financial Reconciliation Brief',
      categoryId: articleCats[1].id,
      authorId: adminUser.id,
      summary: 'How HumanityBridge separates private beneficiary records from public verification ledgers while auditing every contribution.',
      body: `Transparency without safeguarding puts vulnerable people at risk; safeguarding without transparency erodes donor trust. At HumanityBridge, both operate together by design.\n\nEvery humanitarian case undergoes a two-stage verification protocol before receiving a public verification reference or QR verification badge. Private telephone numbers, residential notes, and identity documents remain strictly inside access-controlled administrative vaults, while public viewers inspect verified needs, disbursement milestones, and reconciled campaign totals.`,
      coverImageUrl: '/src/assets/images/campaign_clean_energy_1794840711620.jpg',
      status: 'PUBLISHED',
      publishedAt: ts,
    },
    {
      slug: 'community-coordinators-ethical-storytelling-charter',
      title: 'Adopting the Ethical Community Storytelling Charter',
      categoryId: articleCats[0].id,
      authorId: adminUser.id,
      summary: 'New consent-first standards give storytellers explicit control over photography, identity disclosure, and withdrawal rights.',
      body: `Humanitarian storytelling should never trade human dignity for urgency. Under our updated Ethical Storytelling Charter, Community Coordinators record separate, time-stamped consents for narrative publication, photography, and identity attribution—with mandatory guardian safeguards and anonymous publication defaults whenever minors are involved.`,
      coverImageUrl: '/src/assets/images/story_youth_education_1794840712011.jpg',
      status: 'PUBLISHED',
      publishedAt: ts,
    },
  ]);

  await db.insert(schema.notifications).values([
    {
      userId: coord1.id,
      eventType: 'CASE_VERIFIED',
      title: 'Case HB-CASE-2026-101 Verified',
      message: 'Solar Clean Water Filtration Hub passed engineering verification and is now live in the Impact Ledger.',
      isRead: false,
      createdAt: ts,
    },
    {
      userId: coord2.id,
      eventType: 'STORY_PUBLISHED',
      title: 'Story Published with Anonymous Safeguards',
      message: 'Your story "A Quiet Room of Books and Evening Light" has been approved and published.',
      isRead: false,
      createdAt: ts,
    },
  ]);

  await db.insert(schema.systemSettings).values([
    { settingKey: 'org_name', settingValue: 'HumanityBridge', isPublic: true, updatedBy: adminUser.id, updatedAt: ts },
    { settingKey: 'org_tagline', settingValue: 'Together for a Dignified and Hopeful Tomorrow.', isPublic: true, updatedBy: adminUser.id, updatedAt: ts },
    { settingKey: 'contact_email', settingValue: 'contact@humanitybridge.example', isPublic: true, updatedBy: adminUser.id, updatedAt: ts },
    { settingKey: 'safeguarding_email', settingValue: 'safeguarding@humanitybridge.example', isPublic: true, updatedBy: adminUser.id, updatedAt: ts },
    { settingKey: 'office_region', settingValue: 'Configurable Regional Coordination Desk', isPublic: true, updatedBy: adminUser.id, updatedAt: ts },
    { settingKey: 'registration_notice', settingValue: 'Configurable Legal Registration & Sandbox Notice', isPublic: true, updatedBy: adminUser.id, updatedAt: ts },
    { settingKey: 'fundraising_mode', settingValue: 'SANDBOX_VERIFICATION', isPublic: true, updatedBy: adminUser.id, updatedAt: ts },
  ]);

  await db.insert(schema.auditLogs).values({
    actorUserId: adminUser.id,
    actorRole: DASHBOARD_ROLES.PLATFORM_ADMIN,
    action: 'SYSTEM_INITIAL_SEED',
    resourceType: 'system',
    resourceId: 'bootstrap',
    detailsJson: JSON.stringify({ note: 'Initial HumanityBridge relational dataset initialized' }),
    ipAddress: '127.0.0.1',
    createdAt: ts,
  });

  await db.insert(schema.backupRecords).values({
    backupType: 'AUTOMATED_SNAPSHOT',
    status: 'HEALTHY',
    locationLabel: 'local-encrypted-ledger',
    recordedAt: ts,
  });

  return { seeded: true };
}

// Allow direct execution via `npm run db:seed`
const isDirectRun = process.argv[1]?.endsWith('seed.ts');
if (isDirectRun) {
  seedIfEmpty()
    .then((res) => {
      console.log('Seed result:', res);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed error:', err);
      process.exit(1);
    });
}
