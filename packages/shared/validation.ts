import { z } from 'zod';
import { URGENCY_LEVELS } from './types';

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  mfaCode: z.string().trim().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(16, 'Invalid reset token'),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters'),
  confirmPassword: z.string().trim(),
}).refine((values) => values.password === values.confirmPassword, {
  message: 'Password confirmation does not match',
  path: ['confirmPassword'],
});

export const createCaseSchema = z.object({
  title: z.string().trim().min(6, 'Case title must be at least 6 characters').max(180),
  categoryId: z.coerce.number().int().positive('Select a valid assistance category'),
  locationId: z.coerce.number().int().positive('Select a community region'),
  publicSummary: z.string().trim().min(25, 'Provide a dignified summary without private contact details').max(2000),
  affectedCount: z.coerce.number().int().min(1).max(10000),
  urgencyLevel: z.enum(URGENCY_LEVELS),
  assistanceNeeded: z.string().trim().min(10, 'Describe the specific assistance required').max(1500),
  estimatedCostUsd: z.coerce.number().min(0).max(1000000).optional(),
  isChildRelated: z.boolean().default(false),
  guardianConsentObtained: z.boolean().default(false),
  beneficiaryConsentObtained: z.boolean().default(false),
  beneficiaryFullName: z.string().trim().min(2, 'Beneficiary full name is required').max(120),
  beneficiaryAgeBand: z.enum(['UNDER_18', '18_24', '25_59', '60_PLUS', 'UNKNOWN']).default('UNKNOWN'),
  beneficiaryGender: z.enum(['FEMALE', 'MALE', 'OTHER', 'PREFER_NOT_TO_SAY', 'UNKNOWN']).default('UNKNOWN'),
  householdSize: z.coerce.number().int().min(1).max(1000),
  beneficiaryPreferredLanguage: z.string().trim().max(60).optional(),
  beneficiaryNeedsNotes: z.string().trim().max(1000).optional(),
  privateContactName: z.string().trim().min(2, 'Private contact name required for internal verification').max(120),
  privateContactPhone: z.string().trim().min(5, 'Private contact phone/channel required').max(60),
  privateLocationNotes: z.string().trim().min(5, 'General internal verification notes required').max(500),
  evidenceMediaId: z.coerce.number().int().positive().optional(),
  saveAsDraft: z.boolean().default(false),
});

export const createStorySchema = z.object({
  title: z.string().trim().min(6, 'Story title must be at least 6 characters').max(200),
  categoryId: z.coerce.number().int().positive('Select a story category'),
  regionName: z.string().trim().min(2, 'Specify general community or region').max(120),
  excerpt: z.string().trim().min(20, 'Short introduction must be at least 20 characters').max(400),
  body: z.string().trim().min(80, 'Story narrative must be at least 80 characters').max(12000),
  coverImageUrl: z.string().trim().optional(),
  anonymousPublication: z.boolean().default(false),
  consentStory: z.boolean().refine((v) => v === true, {
    message: 'Story publication consent must be recorded',
  }),
  consentMedia: z.boolean().default(false),
  consentIdentity: z.boolean().default(false),
  isMinorSubject: z.boolean().default(false),
  guardianConsentRecorded: z.boolean().default(false),
  saveAsDraft: z.boolean().default(false),
});

export const createAssistanceRequestSchema = z.object({
  caseId: z.coerce.number().int().positive('Select an existing humanitarian case'),
  supportType: z.string().trim().min(3, 'Specify support type').max(120),
  requestedAmountUsd: z.coerce.number().min(0).max(500000),
  justification: z.string().trim().min(20, 'Provide clear justification for assistance').max(2000),
});

export const createFieldReportSchema = z.object({
  caseId: z.coerce.number().int().positive().optional(),
  locationId: z.coerce.number().int().positive('Select community region'),
  visitDate: z.string().trim().min(8, 'Visit date is required'),
  summary: z.string().trim().min(20, 'Provide detailed visit summary').max(3000),
  assistanceDelivered: z.string().trim().max(1500).optional(),
  peopleReached: z.coerce.number().int().min(0).max(50000),
});

export const createCampaignSchema = z.object({
  title: z.string().trim().min(6, 'Campaign title is required').max(180),
  summary: z.string().trim().min(20, 'Campaign summary is required').max(500),
  description: z.string().trim().min(50, 'Detailed campaign description is required').max(10000),
  targetAmount: z.coerce.number().positive('Funding target must be greater than zero'),
  currency: z.string().trim().length(3).default('USD'),
  coverImageUrl: z.string().trim().optional(),
  startDate: z.string().trim().min(8),
  endDate: z.string().trim().min(8),
  linkedCaseIds: z.array(z.coerce.number().int().positive()).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CLOSED']).default('ACTIVE'),
});

export const createDonationSchema = z.object({
  campaignId: z.coerce.number().int().positive().optional(),
  caseReference: z.string().trim().optional(),
  amount: z.coerce.number().min(2, 'Minimum contribution is $2').max(250000),
  currency: z.string().trim().length(3).default('USD'),
  donorName: z.string().trim().min(2, 'Donor name or alias is required').max(120),
  donorEmail: z.string().trim().email('Valid email required for receipt'),
  isAnonymous: z.boolean().default(false),
  dedicationNote: z.string().trim().max(300).optional(),
  paymentChannel: z.enum(['SANDBOX_CARD', 'SANDBOX_MOBILE_MONEY', 'SANDBOX_BANK_TRANSFER']).default('SANDBOX_CARD'),
});

export const volunteerApplicationSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phone: z.string().trim().min(5).max(40),
  region: z.string().trim().min(2).max(120),
  skills: z.string().trim().min(5).max(500),
  availability: z.string().trim().min(3).max(200),
  motivation: z.string().trim().min(20).max(2000),
});

export const partnershipEnquirySchema = z.object({
  organizationName: z.string().trim().min(2).max(160),
  contactName: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  organizationType: z.enum(['NGO', 'FOUNDATION', 'CORPORATE', 'INSTITUTION', 'COMMUNITY_GROUP']),
  region: z.string().trim().min(2).max(120),
  proposalSummary: z.string().trim().min(20).max(2500),
});

export const contactMessageSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  subject: z.string().trim().min(4).max(180),
  message: z.string().trim().min(15).max(3000),
});

export const safeguardingReportSchema = z.object({
  subjectType: z.enum(['CASE', 'STORY', 'USER', 'PRIVACY_CONCERN', 'CHILD_SAFEGUARDING']),
  referenceCode: z.string().trim().max(80).optional(),
  severity: z.enum(['MEDIUM', 'HIGH', 'CRITICAL']),
  description: z.string().trim().min(20).max(3000),
  reporterEmail: z.string().trim().email().optional().or(z.literal('')),
});
