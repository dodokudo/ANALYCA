#!/usr/bin/env node

const crypto = require('node:crypto');
const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.PROJECT_ID || 'mark-454114';
const DATASET = 'analyca';
const APPROVALS_TABLE = 'threads_schedule_approvals';
const BINDINGS_TABLE = 'threads_line_message_bindings';
const bigquery = new BigQuery({ projectId: PROJECT_ID });

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const values = { command, scheduleIds: [] };
  for (let index = 0; index < rest.length; index += 1) {
    const name = rest[index];
    const value = rest[index + 1];
    if (name === '--schedule-id') {
      values.scheduleIds.push(value);
      index += 1;
    } else if (name === '--group-id') {
      values.groupId = value;
      index += 1;
    } else if (name === '--user-id') {
      values.userId = value;
      index += 1;
    } else if (name === '--message-id') {
      values.messageId = value;
      index += 1;
    }
  }
  return values;
}

function required(value, label) {
  if (!value) throw new Error(`${label} is required`);
  return value;
}

async function prepare(args) {
  const groupId = required(args.groupId, '--group-id');
  const userId = required(args.userId, '--user-id');
  if (args.scheduleIds.length === 0) throw new Error('at least one --schedule-id is required');

  const [rows] = await bigquery.query({
    query: `
      SELECT schedule_id, user_id, status
      FROM \`${PROJECT_ID}.${DATASET}.scheduled_posts\`
      WHERE schedule_id IN UNNEST(@scheduleIds)
    `,
    params: { scheduleIds: args.scheduleIds },
    types: { scheduleIds: ['STRING'] },
  });
  const byId = new Map(rows.map((row) => [String(row.schedule_id), row]));
  for (const scheduleId of args.scheduleIds) {
    const row = byId.get(scheduleId);
    if (!row || String(row.user_id) !== userId || String(row.status) !== 'draft') {
      throw new Error(`${scheduleId} must be a draft owned by ${userId}`);
    }
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const result = [];
  for (let index = 0; index < args.scheduleIds.length; index += 1) {
    const scheduleId = args.scheduleIds[index];
    const token = crypto.randomBytes(24).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await bigquery.query({
      query: `
        INSERT INTO \`${PROJECT_ID}.${DATASET}.${APPROVALS_TABLE}\`
          (token_hash, schedule_id, user_id, group_id, status, expires_at, created_at, used_at)
        VALUES
          (@tokenHash, @scheduleId, @userId, @groupId, 'pending', @expiresAt, CURRENT_TIMESTAMP(), NULL)
      `,
      params: { tokenHash, scheduleId, userId, groupId, expiresAt },
      types: { expiresAt: 'TIMESTAMP' },
    });
    result.push({
      postNumber: index + 1,
      scheduleId,
      token,
      datePickerData: `action=threads_schedule&mode=schedule&token=${token}`,
    });
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

async function bind(args) {
  const groupId = required(args.groupId, '--group-id');
  const userId = required(args.userId, '--user-id');
  const messageId = required(args.messageId, '--message-id');
  if (args.scheduleIds.length === 0) throw new Error('at least one --schedule-id is required');

  for (let index = 0; index < args.scheduleIds.length; index += 1) {
    await bigquery.query({
      query: `
        MERGE \`${PROJECT_ID}.${DATASET}.${BINDINGS_TABLE}\` target
        USING (
          SELECT @messageId AS line_message_id, @scheduleId AS schedule_id
        ) source
        ON target.line_message_id = source.line_message_id
          AND target.schedule_id = source.schedule_id
        WHEN NOT MATCHED THEN
          INSERT (line_message_id, group_id, schedule_id, analyca_user_id, card_index, card_count, created_at)
          VALUES (@messageId, @groupId, @scheduleId, @userId, @cardIndex, @cardCount, CURRENT_TIMESTAMP())
      `,
      params: {
        messageId,
        groupId,
        scheduleId: args.scheduleIds[index],
        userId,
        cardIndex: index + 1,
        cardCount: args.scheduleIds.length,
      },
      types: { cardIndex: 'INT64', cardCount: 'INT64' },
    });
  }
  process.stdout.write(`${JSON.stringify({ messageId, bound: args.scheduleIds.length })}\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === 'prepare') return prepare(args);
  if (args.command === 'bind') return bind(args);
  throw new Error('usage: threads-line-actions.js <prepare|bind> [options]');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
