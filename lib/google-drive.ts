import { google } from 'googleapis';

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

// Google Drive APIクライアントを作成
function getDriveClient() {
  const credentials = getCredentials();

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  return google.drive({ version: 'v3', auth });
}

/**
 * URLから画像をダウンロードしてGoogle Driveにアップロード
 * @param imageUrl - ダウンロードする画像のURL
 * @param fileName - 保存するファイル名
 * @param folderId - 保存先のGoogle DriveフォルダID（オプション）
 * @returns アップロードされたファイルの共有可能URL
 */
export async function uploadImageToDrive(
  imageUrl: string,
  fileName: string,
  folderId?: string
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

    const fullFileName = `${fileName}.${extension}`;

    // Google Driveにアップロード
    const drive = getDriveClient();
    const targetFolderId = folderId || process.env.GOOGLE_DRIVE_FOLDER_ID;

    const fileMetadata: { name: string; parents?: string[] } = {
      name: fullFileName,
    };

    if (targetFolderId) {
      fileMetadata.parents = [targetFolderId];
    }

    // Readable streamを作成
    const { Readable } = await import('stream');
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const uploadResponse = await drive.files.create({
      requestBody: fileMetadata,
      media: {
        mimeType: contentType,
        body: stream,
      },
      fields: 'id, webViewLink, webContentLink',
    });

    const fileId = uploadResponse.data.id;

    if (!fileId) {
      console.error('Failed to get file ID after upload');
      return null;
    }

    // ファイルを誰でも閲覧可能に設定
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    // 直接表示可能なURLを返す
    // Google Driveの直接アクセスURL形式
    return `https://drive.google.com/uc?id=${fileId}`;
  } catch (error) {
    console.error('Failed to upload image to Drive:', error);
    return null;
  }
}

/**
 * 複数の画像をGoogle Driveにアップロード
 * @param items - アップロードする画像情報の配列
 * @param folderId - 保存先のGoogle DriveフォルダID（オプション）
 * @returns アップロード結果のマップ（元のID → Drive URL）
 */
export async function uploadMultipleImagesToDrive(
  items: Array<{ id: string; imageUrl: string; timestamp?: Date }>,
  folderId?: string
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  for (const item of items) {
    if (!item.imageUrl) continue;

    // ファイル名をタイムスタンプから生成
    const timestamp = item.timestamp || new Date();
    const fileName = `${timestamp.toISOString().replace(/[:.]/g, '-')}_${item.id}`;

    const driveUrl = await uploadImageToDrive(item.imageUrl, fileName, folderId);

    if (driveUrl) {
      results.set(item.id, driveUrl);
    }

    // API制限対策（1秒間に10リクエスト制限があるため）
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return results;
}
