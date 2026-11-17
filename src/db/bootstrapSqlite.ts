import type { DatabaseSync } from 'node:sqlite';

export function ensureSqliteSchema(sqlite: DatabaseSync) {
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_code TEXT NOT NULL,
      permission_key TEXT NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      email_verified INTEGER NOT NULL DEFAULT 0,
      mfa_enabled INTEGER NOT NULL DEFAULT 0,
      last_login_at TEXT,
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS ix_users_role ON users(role);

    CREATE TABLE IF NOT EXISTS user_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      display_name TEXT NOT NULL,
      region TEXT,
      organization TEXT,
      bio TEXT,
      avatar_url TEXT,
      preferred_language TEXT NOT NULL DEFAULT 'en',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_token_hash TEXT NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ip_address TEXT,
      user_agent TEXT,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ux_sessions_token ON user_sessions(session_token_hash);
    CREATE INDEX IF NOT EXISTS ix_sessions_user ON user_sessions(user_id);

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      verified_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mfa_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      totp_secret TEXT NOT NULL,
      backup_codes_hash TEXT,
      enabled INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      ip_address TEXT,
      success INTEGER NOT NULL,
      reason TEXT,
      attempted_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_login_attempts_email ON login_attempts(email);

    CREATE TABLE IF NOT EXISTS case_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS community_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      region_name TEXT NOT NULL,
      country TEXT NOT NULL,
      approximate_lat REAL,
      approximate_lng REAL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS humanitarian_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference_code TEXT NOT NULL,
      title TEXT NOT NULL,
      category_id INTEGER NOT NULL REFERENCES case_categories(id),
      location_id INTEGER NOT NULL REFERENCES community_locations(id),
      coordinator_id INTEGER NOT NULL REFERENCES users(id),
      public_summary TEXT NOT NULL,
      assistance_needed TEXT NOT NULL,
      affected_count INTEGER NOT NULL DEFAULT 1,
      urgency_level TEXT NOT NULL DEFAULT 'MEDIUM',
      estimated_cost_usd REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'SUBMITTED',
      is_public INTEGER NOT NULL DEFAULT 0,
      is_child_related INTEGER NOT NULL DEFAULT 0,
      guardian_consent_obtained INTEGER NOT NULL DEFAULT 0,
      beneficiary_consent_obtained INTEGER NOT NULL DEFAULT 0,
      private_contact_name TEXT NOT NULL,
      private_contact_phone TEXT NOT NULL,
      beneficiary_full_name TEXT NOT NULL DEFAULT '',
      beneficiary_age_band TEXT NOT NULL DEFAULT 'UNKNOWN',
      beneficiary_gender TEXT NOT NULL DEFAULT 'UNKNOWN',
      household_size INTEGER NOT NULL DEFAULT 1,
      beneficiary_preferred_language TEXT,
      beneficiary_needs_notes TEXT,
      private_location_notes TEXT NOT NULL,
      internal_admin_notes TEXT,
      verified_by INTEGER REFERENCES users(id),
      verified_at TEXT,
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ux_cases_reference ON humanitarian_cases(reference_code);
    CREATE INDEX IF NOT EXISTS ix_cases_status ON humanitarian_cases(status);
    CREATE INDEX IF NOT EXISTS ix_cases_coordinator ON humanitarian_cases(coordinator_id);

    CREATE TABLE IF NOT EXISTS case_requirements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES humanitarian_cases(id) ON DELETE CASCADE,
      item_label TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      estimated_unit_cost_usd REAL DEFAULT 0,
      fulfilled INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS case_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES humanitarian_cases(id) ON DELETE CASCADE,
      uploaded_by INTEGER NOT NULL REFERENCES users(id),
      document_type TEXT NOT NULL,
      storage_key TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      is_confidential INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS case_verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES humanitarian_cases(id) ON DELETE CASCADE,
      reviewer_id INTEGER NOT NULL REFERENCES users(id),
      decision TEXT NOT NULL,
      notes TEXT NOT NULL,
      publish_publicly INTEGER NOT NULL DEFAULT 0,
      decided_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS case_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES humanitarian_cases(id) ON DELETE CASCADE,
      previous_status TEXT,
      new_status TEXT NOT NULL,
      changed_by INTEGER NOT NULL REFERENCES users(id),
      reason TEXT,
      changed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assistance_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES humanitarian_cases(id) ON DELETE CASCADE,
      coordinator_id INTEGER NOT NULL REFERENCES users(id),
      support_type TEXT NOT NULL,
      requested_amount_usd REAL NOT NULL DEFAULT 0,
      justification TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'SUBMITTED',
      admin_feedback TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assistance_distributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES humanitarian_cases(id),
      request_id INTEGER REFERENCES assistance_requests(id),
      amount_usd REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      approved_by INTEGER NOT NULL REFERENCES users(id),
      distribution_notes TEXT NOT NULL,
      distributed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS story_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS stories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      category_id INTEGER NOT NULL REFERENCES story_categories(id),
      author_id INTEGER NOT NULL REFERENCES users(id),
      region_name TEXT NOT NULL,
      excerpt TEXT NOT NULL,
      body TEXT NOT NULL,
      cover_image_url TEXT,
      anonymous_publication INTEGER NOT NULL DEFAULT 0,
      is_minor_subject INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'SUBMITTED',
      language_code TEXT NOT NULL DEFAULT 'en',
      translated_content_json TEXT,
      published_at TEXT,
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ux_stories_slug ON stories(slug);
    CREATE INDEX IF NOT EXISTS ix_stories_status ON stories(status);

    CREATE TABLE IF NOT EXISTS story_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
      media_type TEXT NOT NULL,
      url TEXT NOT NULL,
      alt_text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS story_consents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
      consent_story INTEGER NOT NULL DEFAULT 0,
      consent_media INTEGER NOT NULL DEFAULT 0,
      consent_identity INTEGER NOT NULL DEFAULT 0,
      guardian_consent_recorded INTEGER NOT NULL DEFAULT 0,
      withdrawn_at TEXT,
      recorded_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS story_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
      reviewer_id INTEGER NOT NULL REFERENCES users(id),
      decision TEXT NOT NULL,
      editorial_notes TEXT,
      reviewed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS story_publications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
      published_by INTEGER NOT NULL REFERENCES users(id),
      scheduled_for TEXT,
      published_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      description TEXT NOT NULL,
      target_amount REAL NOT NULL,
      raised_amount REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      cover_image_url TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      created_by INTEGER NOT NULL REFERENCES users(id),
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ux_campaigns_slug ON campaigns(slug);
    CREATE INDEX IF NOT EXISTS ix_campaigns_status ON campaigns(status);

    CREATE TABLE IF NOT EXISTS campaign_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      case_id INTEGER NOT NULL REFERENCES humanitarian_cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS donations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donation_reference TEXT NOT NULL,
      campaign_id INTEGER REFERENCES campaigns(id),
      case_id INTEGER REFERENCES humanitarian_cases(id),
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      donor_name TEXT NOT NULL,
      donor_email TEXT NOT NULL,
      is_anonymous INTEGER NOT NULL DEFAULT 0,
      dedication_note TEXT,
      status TEXT NOT NULL DEFAULT 'INITIATED',
      payment_channel TEXT NOT NULL,
      confirmed_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ux_donations_reference ON donations(donation_reference);
    CREATE INDEX IF NOT EXISTS ix_donations_status ON donations(status);

    CREATE TABLE IF NOT EXISTS payment_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donation_id INTEGER NOT NULL REFERENCES donations(id),
      provider TEXT NOT NULL,
      provider_reference TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL,
      verified_by_webhook INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_provider_ref ON payment_transactions(provider_reference);

    CREATE TABLE IF NOT EXISTS payment_webhook_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      signature_valid INTEGER NOT NULL,
      payload_hash TEXT NOT NULL,
      processed_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ux_webhook_event_id ON payment_webhook_events(event_id);

    CREATE TABLE IF NOT EXISTS refunds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donation_id INTEGER NOT NULL REFERENCES donations(id),
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      reason TEXT NOT NULL,
      approved_by INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'COMPLETED',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS financial_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_type TEXT NOT NULL,
      reference_code TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      campaign_id INTEGER REFERENCES campaigns(id),
      case_id INTEGER REFERENCES humanitarian_cases(id),
      description TEXT NOT NULL,
      recorded_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS financial_reconciliations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donation_id INTEGER NOT NULL REFERENCES donations(id),
      reconciled_by INTEGER NOT NULL REFERENCES users(id),
      reconciliation_note TEXT NOT NULL,
      external_ledger_ref TEXT NOT NULL,
      reconciled_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS field_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coordinator_id INTEGER NOT NULL REFERENCES users(id),
      case_id INTEGER REFERENCES humanitarian_cases(id),
      location_id INTEGER NOT NULL REFERENCES community_locations(id),
      visit_date TEXT NOT NULL,
      summary TEXT NOT NULL,
      assistance_delivered TEXT,
      people_reached INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS field_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL REFERENCES field_reports(id) ON DELETE CASCADE,
      activity_title TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS volunteer_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      region TEXT NOT NULL,
      skills TEXT NOT NULL,
      availability TEXT NOT NULL,
      motivation TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      reviewed_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS volunteers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER REFERENCES volunteer_applications(id),
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      region TEXT NOT NULL,
      specialty TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      joined_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS partnership_enquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_name TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      email TEXT NOT NULL,
      organization_type TEXT NOT NULL,
      region TEXT NOT NULL,
      proposal_summary TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS partnerships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      enquiry_id INTEGER REFERENCES partnership_enquiries(id),
      organization_name TEXT NOT NULL,
      organization_type TEXT NOT NULL,
      region TEXT NOT NULL,
      focus_area TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_notifications_user ON notifications(user_id);

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      target_role TEXT NOT NULL DEFAULT 'ALL',
      created_by INTEGER NOT NULL REFERENCES users(id),
      published_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS article_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      category_id INTEGER NOT NULL REFERENCES article_categories(id),
      author_id INTEGER NOT NULL REFERENCES users(id),
      summary TEXT NOT NULL,
      body TEXT NOT NULL,
      cover_image_url TEXT,
      status TEXT NOT NULL DEFAULT 'PUBLISHED',
      published_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ux_articles_slug ON articles(slug);

    CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'NEW',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER REFERENCES users(id),
      actor_role TEXT,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      details_json TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_audit_actor ON audit_logs(actor_user_id);
    CREATE INDEX IF NOT EXISTS ix_audit_action ON audit_logs(action);

    CREATE TABLE IF NOT EXISTS consent_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_type TEXT NOT NULL,
      subject_id INTEGER NOT NULL,
      consent_scope TEXT NOT NULL,
      granted INTEGER NOT NULL,
      recorded_by INTEGER NOT NULL REFERENCES users(id),
      withdrawn_at TEXT,
      recorded_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS safeguarding_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_type TEXT NOT NULL,
      reference_code TEXT,
      severity TEXT NOT NULL,
      description TEXT NOT NULL,
      reporter_email TEXT,
      status TEXT NOT NULL DEFAULT 'OPEN',
      assigned_admin_id INTEGER REFERENCES users(id),
      resolution_notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS privacy_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requester_email TEXT NOT NULL,
      request_type TEXT NOT NULL,
      reference_code TEXT,
      details TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN',
      handled_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS moderation_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_type TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      action_type TEXT NOT NULL,
      reason TEXT NOT NULL,
      moderator_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL,
      is_public INTEGER NOT NULL DEFAULT 0,
      updated_by INTEGER REFERENCES users(id),
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS media_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      storage_scope TEXT NOT NULL,
      safe_filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      uploaded_by INTEGER NOT NULL REFERENCES users(id),
      alt_text TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bank_transfer_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT, case_id INTEGER NOT NULL REFERENCES humanitarian_cases(id),
      beneficiary_name TEXT NOT NULL, bank_name TEXT NOT NULL, bank_reference TEXT NOT NULL,
      amount REAL NOT NULL, currency TEXT NOT NULL, transfer_date TEXT NOT NULL,
      recipient_account_last4 TEXT, purpose TEXT NOT NULL, notes TEXT NOT NULL,
      evidence_media_id INTEGER NOT NULL REFERENCES media_files(id),
      status TEXT NOT NULL DEFAULT 'PENDING_REVIEW', recorded_by INTEGER NOT NULL REFERENCES users(id),
      verified_by INTEGER REFERENCES users(id), verification_notes TEXT, receipt_number TEXT UNIQUE,
      verified_at TEXT, receipt_issued_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(bank_name, bank_reference)
    );
    CREATE INDEX IF NOT EXISTS ix_bank_transfer_status ON bank_transfer_records(status);
    CREATE INDEX IF NOT EXISTS ix_bank_transfer_case ON bank_transfer_records(case_id);
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      summary TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS backup_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      backup_type TEXT NOT NULL,
      status TEXT NOT NULL,
      location_label TEXT NOT NULL,
      recorded_at TEXT NOT NULL
    );
  `);

  const caseColumnRows = sqlite.prepare('PRAGMA table_info(humanitarian_cases)').all() as Array<{ name: string }>;
  const existingCaseColumns = new Set(caseColumnRows.map((column: { name: string }) => column.name));
  const additiveColumns: Array<[string, string]> = [
    ['beneficiary_full_name', "TEXT NOT NULL DEFAULT ''"], ['beneficiary_age_band', "TEXT NOT NULL DEFAULT 'UNKNOWN'"],
    ['beneficiary_gender', "TEXT NOT NULL DEFAULT 'UNKNOWN'"], ['household_size', 'INTEGER NOT NULL DEFAULT 1'],
    ['beneficiary_preferred_language', 'TEXT'], ['beneficiary_needs_notes', 'TEXT'],
  ];
  for (const [column, definition] of additiveColumns) if (!existingCaseColumns.has(column)) sqlite.exec(`ALTER TABLE humanitarian_cases ADD COLUMN ${column} ${definition}`);
}
