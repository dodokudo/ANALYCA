import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // 環境変数の確認
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    const credentials = process.env.GOOGLE_CREDENTIALS;
    
    console.log('Environment variables check:');
    console.log('GOOGLE_SPREADSHEET_ID:', spreadsheetId ? 'Present' : 'Missing');
    console.log('GOOGLE_CREDENTIALS:', credentials ? 'Present' : 'Missing');
    
    if (!spreadsheetId || !credentials) {
      return NextResponse.json({
        error: 'Environment variables missing',
        missing: {
          spreadsheetId: !spreadsheetId,
          credentials: !credentials
        }
      }, { status: 500 });
    }

    // 認証情報の解析
    let parsedCredentials;
    try {
      parsedCredentials = JSON.parse(credentials);
    } catch (e) {
      return NextResponse.json({
        error: 'Invalid credentials JSON',
        details: e.message
      }, { status: 500 });
    }

    // Google Sheets API テスト
    const { google } = await import('googleapis');
    
    const auth = new google.auth.GoogleAuth({
      credentials: parsedCredentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    // スプレッドシートの基本情報を取得
    const spreadsheetInfo = await sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId,
    });

    return NextResponse.json({
      success: true,
      spreadsheet: {
        title: spreadsheetInfo.data.properties?.title,
        sheetCount: spreadsheetInfo.data.sheets?.length,
        sheets: spreadsheetInfo.data.sheets?.map(sheet => ({
          title: sheet.properties?.title,
          sheetId: sheet.properties?.sheetId
        }))
      }
    });

  } catch (error) {
    console.error('Test error:', error);
    return NextResponse.json({
      error: 'Google Sheets API Error',
      details: error instanceof Error ? error.message : String(error),
      code: error instanceof Error && 'code' in error ? (error as { code?: string }).code : undefined
    }, { status: 500 });
  }
}