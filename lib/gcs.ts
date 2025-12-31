import { Storage } from '@google-cloud/storage';

const BUCKET_NAME = 'analyca-media';

// Google認証情報を取得
function getCredentials() {
  const credentialsJson = process.env.GOOGLE_CREDENTIALS || '{}';
  try {
    return JSON.parse(credentialsJson);
  } catch {
    console.error('Failed to parse Google credentials');
    return {};
  }
}

// GCSクライアントを取得
function getStorage() {
  const credentials = getCredentials();
  return new Storage({
    credentials,
    projectId: credentials.project_id || 'mark-454114',
  });
}

/**
 * URLから画像をダウンロードしてGCSにアップロード
 * @param imageUrl - ダウンロードする画像のURL
 * @param fileName - 保存するファイル名（拡張子なし）
 * @param folder - 保存先フォルダ（オプション）
 * @returns アップロードされたファイルの公開URL
 */
export async function uploadImageToGCS(
  imageUrl: string,
  fileName: string,
  folder?: string
): Promise<string | null> {
  try {
    // 画像をダウンロード
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`Failed to download image: ${response.status}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // ファイル拡張子を決定
    let extension = 'jpg';
    if (contentType.includes('png')) extension = 'png';
    else if (contentType.includes('gif')) extension = 'gif';
    else if (contentType.includes('webp')) extension = 'webp';
    else if (contentType.includes('mp4') || contentType.includes('video')) extension = 'mp4';

    const fullFileName = folder
      ? `${folder}/${fileName}.${extension}`
      : `${fileName}.${extension}`;

    // GCSにアップロード
    const storage = getStorage();
    const bucket = storage.bucket(BUCKET_NAME);
    const file = bucket.file(fullFileName);

    await file.save(buffer, {
      contentType,
      metadata: {
        cacheControl: 'public, max-age=31536000',
      },
    });

    // 公開URLを返す
    return `https://storage.googleapis.com/${BUCKET_NAME}/${fullFileName}`;
  } catch (error) {
    console.error('Failed to upload image to GCS:', error);
    return null;
  }
}

/**
 * 複数の画像をGCSにアップロード
 * @param items - アップロードする画像情報の配列
 * @param folder - 保存先フォルダ（オプション）
 * @returns アップロード結果のマップ（元のID → GCS URL）
 */
export async function uploadMultipleImagesToGCS(
  items: Array<{ id: string; imageUrl: string; timestamp?: Date }>,
  folder?: string
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  for (const item of items) {
    if (!item.imageUrl) continue;

    // ファイル名をタイムスタンプから生成
    const timestamp = item.timestamp || new Date();
    const fileName = `${timestamp.toISOString().replace(/[:.]/g, '-')}_${item.id}`;

    const gcsUrl = await uploadImageToGCS(item.imageUrl, fileName, folder);

    if (gcsUrl) {
      results.set(item.id, gcsUrl);
    }

    // API制限対策
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return results;
}
