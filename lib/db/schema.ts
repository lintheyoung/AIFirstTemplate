import {
  bigint,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

export const workspaceRoleValues = ['owner', 'admin', 'member'] as const;
export type WorkspaceRoleValue = (typeof workspaceRoleValues)[number];

export const apiKeyStatusValues = ['active', 'revoked'] as const;
export type ApiKeyStatusValue = (typeof apiKeyStatusValues)[number];

export const fileVisibilityValues = ['private', 'public'] as const;
export type FileVisibilityValue = (typeof fileVisibilityValues)[number];

export const fileStatusValues = [
  'pending_upload',
  'uploaded',
  'ready',
  'failed',
  'deleted',
] as const;
export type FileStatusValue = (typeof fileStatusValues)[number];

export const jobStatusValues = [
  'queued',
  'dispatching',
  'running',
  'succeeded',
  'failed',
  'cancelled',
  'timed_out',
] as const;
export type JobStatusValue = (typeof jobStatusValues)[number];

export const actorTypeValues = ['user', 'api_key', 'system'] as const;
export type ActorTypeValue = (typeof actorTypeValues)[number];

export const attemptStatusValues = ['running', 'succeeded', 'failed'] as const;
export type AttemptStatusValue = (typeof attemptStatusValues)[number];

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  externalAuthUserId: varchar('external_auth_user_id', { length: 255 }).unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 100 }),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const workspaces = pgTable('workspaces', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 120 }).notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    id: serial('id').primaryKey(),
    workspaceId: integer('workspace_id').notNull().references(() => workspaces.id),
    userId: integer('user_id').notNull().references(() => users.id),
    role: varchar('role', { length: 32 }).$type<WorkspaceRoleValue>().notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    workspaceUserIdx: uniqueIndex('workspace_members_workspace_user_idx').on(
      table.workspaceId,
      table.userId,
    ),
  }),
);

export const apiKeys = pgTable(
  'api_keys',
  {
    id: serial('id').primaryKey(),
    workspaceId: integer('workspace_id').notNull().references(() => workspaces.id),
    name: varchar('name', { length: 100 }).notNull(),
    keyPrefix: varchar('key_prefix', { length: 32 }).notNull(),
    keyHash: text('key_hash').notNull().unique(),
    scopes: text('scopes').array().notNull(),
    status: varchar('status', { length: 20 }).$type<ApiKeyStatusValue>().notNull().default('active'),
    createdByUserId: integer('created_by_user_id').notNull().references(() => users.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    revokedAt: timestamp('revoked_at'),
  },
  (table) => ({
    workspaceIdx: index('api_keys_workspace_idx').on(table.workspaceId),
    statusIdx: index('api_keys_status_idx').on(table.status),
  }),
);

export const files = pgTable(
  'files',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    workspaceId: integer('workspace_id').notNull().references(() => workspaces.id),
    filename: text('filename').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    storageProvider: varchar('storage_provider', { length: 32 }).notNull(),
    storageBucket: text('storage_bucket').notNull(),
    storageKey: text('storage_key').notNull(),
    visibility: varchar('visibility', { length: 16 })
      .$type<FileVisibilityValue>()
      .notNull()
      .default('private'),
    status: varchar('status', { length: 32 })
      .$type<FileStatusValue>()
      .notNull()
      .default('pending_upload'),
    metadataJson: text('metadata_json').notNull().default('{}'),
    uploadedByType: varchar('uploaded_by_type', { length: 20 }).$type<ActorTypeValue>().notNull(),
    uploadedById: text('uploaded_by_id').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    workspaceStatusIdx: index('files_workspace_status_idx').on(table.workspaceId, table.status),
  }),
);

export const jobs = pgTable(
  'jobs',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    workspaceId: integer('workspace_id').notNull().references(() => workspaces.id),
    capabilityName: varchar('capability_name', { length: 128 }).notNull(),
    providerName: varchar('provider_name', { length: 64 }).notNull(),
    status: varchar('status', { length: 32 }).$type<JobStatusValue>().notNull().default('queued'),
    sourceFileId: varchar('source_file_id', { length: 64 }).references(() => files.id),
    resultFileId: varchar('result_file_id', { length: 64 }).references(() => files.id),
    providerTaskId: varchar('provider_task_id', { length: 255 }),
    inputJson: text('input_json').notNull().default('{}'),
    resultJson: text('result_json'),
    errorCode: varchar('error_code', { length: 64 }),
    errorMessage: text('error_message'),
    idempotencyKey: varchar('idempotency_key', { length: 255 }),
    createdByType: varchar('created_by_type', { length: 20 }).$type<ActorTypeValue>().notNull(),
    createdById: text('created_by_id').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    startedAt: timestamp('started_at'),
    finishedAt: timestamp('finished_at'),
  },
  (table) => ({
    workspaceStatusIdx: index('jobs_workspace_status_idx').on(table.workspaceId, table.status),
    providerTaskIdx: index('jobs_provider_task_idx').on(
      table.providerName,
      table.providerTaskId,
    ),
    idempotencyIdx: uniqueIndex('jobs_workspace_idempotency_idx').on(
      table.workspaceId,
      table.idempotencyKey,
    ),
  }),
);

export const jobAttempts = pgTable('job_attempts', {
  id: serial('id').primaryKey(),
  jobId: varchar('job_id', { length: 64 }).notNull().references(() => jobs.id),
  providerName: varchar('provider_name', { length: 64 }).notNull(),
  attemptNo: integer('attempt_no').notNull(),
  status: varchar('status', { length: 32 }).$type<AttemptStatusValue>().notNull(),
  requestJson: text('request_json').notNull().default('{}'),
  responseJson: text('response_json'),
  errorCode: varchar('error_code', { length: 64 }),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  finishedAt: timestamp('finished_at'),
});

export const usageRecords = pgTable('usage_records', {
  id: serial('id').primaryKey(),
  workspaceId: integer('workspace_id').notNull().references(() => workspaces.id),
  jobId: varchar('job_id', { length: 64 }).references(() => jobs.id),
  metricName: varchar('metric_name', { length: 64 }).notNull(),
  quantity: bigint('quantity', { mode: 'number' }).notNull().default(0),
  unit: varchar('unit', { length: 32 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  workspaceId: integer('workspace_id').notNull().references(() => workspaces.id),
  actorType: varchar('actor_type', { length: 20 }).$type<ActorTypeValue>().notNull(),
  actorId: text('actor_id').notNull(),
  action: varchar('action', { length: 64 }).notNull(),
  targetType: varchar('target_type', { length: 32 }).notNull(),
  targetId: text('target_id').notNull(),
  detailsJson: text('details_json').notNull().default('{}'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
