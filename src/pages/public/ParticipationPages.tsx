import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2 } from 'lucide-react';
import type { z } from 'zod';
import {
  contactMessageSchema,
  partnershipEnquirySchema,
  volunteerApplicationSchema,
} from '../../../packages/shared/validation';
import { apiRequest } from '../../services/api';

type VolunteerForm = z.infer<typeof volunteerApplicationSchema>;
type PartnerForm = z.infer<typeof partnershipEnquirySchema>;
type ContactForm = z.infer<typeof contactMessageSchema>;

export function VolunteerPage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VolunteerForm>({ resolver: zodResolver(volunteerApplicationSchema) });

  const onSubmit = async (values: VolunteerForm) => {
    setError(null);
    try {
      await apiRequest('/public/volunteers', { method: 'POST', body: JSON.stringify(values) });
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="font-editorial text-4xl font-semibold text-[#0B1F3A] dark:text-white">
        Volunteer Registration
      </h1>
      <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
        Offer your professional skills in healthcare, translation, water engineering, education, or community outreach.
      </p>

      <div className="mt-8 bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8">
        {submitted ? (
          <div className="flex items-start gap-3 text-[#16865D] dark:text-[#1FA977]">
            <CheckCircle2 className="w-6 h-6 shrink-0" />
            <div>
              <h2 className="font-semibold text-base">Application Received</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Thank you. Our volunteer coordination team will review your skills and region availability.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Full Name</label>
                <input {...register('fullName')} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
                {errors.fullName && <p className="text-xs text-rose-600 mt-1">{errors.fullName.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email Address</label>
                <input type="email" {...register('email')} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
                {errors.email && <p className="text-xs text-rose-600 mt-1">{errors.email.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Phone Number</label>
                <input {...register('phone')} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
                {errors.phone && <p className="text-xs text-rose-600 mt-1">{errors.phone.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Region / Location</label>
                <input {...register('region')} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
                {errors.region && <p className="text-xs text-rose-600 mt-1">{errors.region.message}</p>}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Core Skills & Languages</label>
              <input {...register('skills')} placeholder="e.g. Solar Engineering, Nursing, Arabic/Nuer Translation" className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
              {errors.skills && <p className="text-xs text-rose-600 mt-1">{errors.skills.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Availability</label>
              <input {...register('availability')} placeholder="e.g. 10 hours/week remote or regional deployment" className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
              {errors.availability && <p className="text-xs text-rose-600 mt-1">{errors.availability.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Motivation & Background</label>
              <textarea rows={4} {...register('motivation')} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
              {errors.motivation && <p className="text-xs text-rose-600 mt-1">{errors.motivation.message}</p>}
            </div>
            <button type="submit" disabled={isSubmitting} className="px-6 py-3 rounded-lg bg-[#0B1F3A] dark:bg-[#00BCEB] text-white dark:text-[#071324] text-sm font-semibold">
              {isSubmitting ? 'Submitting...' : 'Submit Volunteer Application'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export function PartnershipPage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PartnerForm>({
    resolver: zodResolver(partnershipEnquirySchema),
    defaultValues: { organizationType: 'NGO' },
  });

  const onSubmit = async (values: PartnerForm) => {
    setError(null);
    try {
      await apiRequest('/public/partnerships', { method: 'POST', body: JSON.stringify(values) });
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="font-editorial text-4xl font-semibold text-[#0B1F3A] dark:text-white">
        Partnership Enquiries
      </h1>
      <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
        Partner with HumanityBridge on community health, clean water, education, or transparent humanitarian logistics.
      </p>

      <div className="mt-8 bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8">
        {submitted ? (
          <div className="flex items-start gap-3 text-[#16865D] dark:text-[#1FA977]">
            <CheckCircle2 className="w-6 h-6 shrink-0" />
            <div>
              <h2 className="font-semibold text-base">Partnership Enquiry Logged</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Our governance desk has recorded your proposal for review.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Organisation Name</label>
                <input {...register('organizationName')} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
                {errors.organizationName && <p className="text-xs text-rose-600 mt-1">{errors.organizationName.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Organisation Type</label>
                <select {...register('organizationType')} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm">
                  <option value="NGO">NGO / Humanitarian Agency</option>
                  <option value="FOUNDATION">Philanthropic Foundation</option>
                  <option value="CORPORATE">Corporate Social Responsibility</option>
                  <option value="INSTITUTION">Academic / Medical Institution</option>
                  <option value="COMMUNITY_GROUP">Community Cooperative</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Contact Name</label>
                <input {...register('contactName')} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
                {errors.contactName && <p className="text-xs text-rose-600 mt-1">{errors.contactName.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Official Email</label>
                <input type="email" {...register('email')} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
                {errors.email && <p className="text-xs text-rose-600 mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Focus Region</label>
                <input {...register('region')} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
                {errors.region && <p className="text-xs text-rose-600 mt-1">{errors.region.message}</p>}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Collaboration Proposal Summary</label>
              <textarea rows={4} {...register('proposalSummary')} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
              {errors.proposalSummary && <p className="text-xs text-rose-600 mt-1">{errors.proposalSummary.message}</p>}
            </div>
            <button type="submit" disabled={isSubmitting} className="px-6 py-3 rounded-lg bg-[#0B1F3A] dark:bg-[#00BCEB] text-white dark:text-[#071324] text-sm font-semibold">
              {isSubmitting ? 'Submitting...' : 'Submit Partnership Enquiry'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactForm>({ resolver: zodResolver(contactMessageSchema) });

  const onSubmit = async (values: ContactForm) => {
    setError(null);
    try {
      await apiRequest('/public/contact', { method: 'POST', body: JSON.stringify(values) });
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to send message');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="font-editorial text-4xl font-semibold text-[#0B1F3A] dark:text-white">
        Contact HumanityBridge
      </h1>
      <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
        Reach our coordination desk for programme enquiries, media requests, or accessibility support.
      </p>

      <div className="mt-8 bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8">
        {submitted ? (
          <div className="flex items-start gap-3 text-[#16865D] dark:text-[#1FA977]">
            <CheckCircle2 className="w-6 h-6 shrink-0" />
            <div>
              <h2 className="font-semibold text-base">Message Received</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Your enquiry has been logged in our coordination queue.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Your Name</label>
                <input {...register('name')} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
                {errors.name && <p className="text-xs text-rose-600 mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email Address</label>
                <input type="email" {...register('email')} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
                {errors.email && <p className="text-xs text-rose-600 mt-1">{errors.email.message}</p>}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Subject</label>
              <input {...register('subject')} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
              {errors.subject && <p className="text-xs text-rose-600 mt-1">{errors.subject.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Message</label>
              <textarea rows={4} {...register('message')} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
              {errors.message && <p className="text-xs text-rose-600 mt-1">{errors.message.message}</p>}
            </div>
            <button type="submit" disabled={isSubmitting} className="px-6 py-3 rounded-lg bg-[#0B1F3A] dark:bg-[#00BCEB] text-white dark:text-[#071324] text-sm font-semibold">
              {isSubmitting ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
