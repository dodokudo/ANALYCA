import { NextRequest, NextResponse } from 'next/server';
import { updateIdentityVerification } from '@/lib/bigquery';
import { Storage } from '@google-cloud/storage';

const BUCKET_NAME = 'analyca-media';

function getStorage() {
  const credentialsJson = process.env.GOOGLE_CREDENTIALS || '{}';
  let credentials: Record<string, unknown> = {};
  try {
    credentials = JSON.parse(credentialsJson);
  } catch {
    console.error('Failed to parse Google credentials');
  }
  return new Storage({
    credentials,
    projectId: (credentials.project_id as string) || 'mark-454114',
  });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const userId = formData.get('userId') as string;
    const file = formData.get('file') as File | null;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ success: false, error: 'file is required' }, { status: 400 });
    }

    // ファイルサイズ制限 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'File too large (max 10MB)' }, { status: 400 });
    }

    // 許可するMIMEタイプ
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'Allowed file types: JPEG, PNG, WebP, PDF' }, { status: 400 });
    }

    // ファイル拡張子を決定
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'application/pdf': 'pdf',
    };
    const ext = extMap[file.type] || 'bin';
    const fileName = `identity/${userId}_${Date.now()}.${ext}`;

    // GCSにアップロード
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const storage = getStorage();
    const bucket = storage.bucket(BUCKET_NAME);
    const gcsFile = bucket.file(fileName);

    await gcsFile.save(buffer, {
      contentType: file.type,
      metadata: {
        cacheControl: 'private, max-age=0',
      },
    });

    const docUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${fileName}`;

    // BigQueryにURL保存
    await updateIdentityVerification(userId, docUrl);

    return NextResponse.json({ success: true, doc_url: docUrl });
  } catch (error) {
    console.error('Identity upload error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload identity document',
    }, { status: 500 });
  }
}
