import { NextResponse } from 'next/server';

// A legacy scheduler invocation must never resume local business processing.
export async function GET() {
  return NextResponse.json({ skipped: 'migrated-to-guardian' });
}
