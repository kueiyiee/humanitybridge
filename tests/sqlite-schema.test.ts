import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { ensureSqliteSchema } from '../src/db/bootstrapSqlite';

test('SQLite bootstrap creates the core HumanityBridge schema and remains idempotent', () => {
  const sqlite = new DatabaseSync(':memory:');

  try {
    ensureSqliteSchema(sqlite);
    ensureSqliteSchema(sqlite);

    const tables = new Set(
      (sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>)
        .map((row) => row.name),
    );

    const requiredTables = [
      'users',
      'user_profiles',
      'user_sessions',
      'humanitarian_cases',
      'stories',
      'story_consents',
      'campaigns',
      'donations',
      'announcements',
      'articles',
      'cms_content',
      'audit_logs',
      'safeguarding_reports',
      'document_templates',
      'issued_documents',
      'document_verification_events',
    ];

    for (const table of requiredTables) {
      assert.ok(tables.has(table), \`Required SQLite table is missing: \${table}\`);
    }

    const cmsColumns = new Set(
      (sqlite.prepare('PRAGMA table_info(cms_content)').all() as Array<{ name: string }>)
        .map((column) => column.name),
    );
    for (const column of ['type', 'slug', 'title', 'body_json', 'status', 'published_at', 'deleted_at']) {
      assert.ok(cmsColumns.has(column), \`Required CMS column is missing: \${column}\`);
    }

    const integrity = sqlite.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
    assert.equal(integrity.integrity_check, 'ok');
    assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    sqlite.close();
  }
});
