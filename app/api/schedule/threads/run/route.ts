import { NextResponse } from 'next/server';
import { processScheduledPosts } from '@/lib/scheduledPostsWorker';

async function handleScheduleRun() {
  try {
    console.log('[schedule/threads/run] Started at', new Date().toISOString());

    const result = await processScheduledPosts();

    console.log('[schedule/threads/run] Completed:', {
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed,
        recovered: result.recovered,
        results: result.results,
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[schedule/threads/run] Failed:', error);
    return NextResponse.json(
      { error: 'Schedule run failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export async function GET() {
  return handleScheduleRun();
}

export async function POST() {
  return handleScheduleRun();
}
