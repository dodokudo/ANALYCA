import { NextResponse } from 'next/server';
import { google } from 'googleapis';

// APIルートとして動的に実行
export const dynamic = 'force-dynamic';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const GOOGLE_CREDENTIALS = JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}');

// Google Sheets API認証
async function getGoogleSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: GOOGLE_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  
  return google.sheets({ version: 'v4', auth });
}

export async function GET() {
  try {
    console.log('Google Sheets APIからデータを取得開始...');
    console.log('スプレッドシートID:', SPREADSHEET_ID);
    
    const sheets = await getGoogleSheetsClient();
    
    // 各シートからデータを取得
    const ranges = [
      'Instagram raw!A:Z',
      'Stories raw!A:Z', 
      'Reel rawdata!A:Z',
      'Reel sheet!A:Z',
      'Daily!A:Z'
    ];
    
    console.log('取得範囲:', ranges);
    
    const batchResponse = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges: ranges,
    });
    
    console.log('API応答取得完了');
    
    const [instagramData, storiesData, reelRawData, reelSheetData, dailyData] = 
      batchResponse.data.valueRanges?.map(range => range.values || []) || [];
    
    console.log('各シートのデータ行数:');
    console.log('- Instagram raw:', instagramData?.length || 0);
    console.log('- Stories raw:', storiesData?.length || 0);
    console.log('- Reel rawdata:', reelRawData?.length || 0);
    console.log('- Reel sheet:', reelSheetData?.length || 0);
    console.log('- Daily:', dailyData?.length || 0);
    
    // データの構造化
    const completeData = {
      instagramRaw: instagramData || [],
      storiesRaw: storiesData || [],
      reelRawDataRaw: reelRawData || [],
      reelSheetRaw: reelSheetData || [],
      dailyRaw: dailyData || [],
      dataInfo: {
        instagramRows: instagramData?.length || 0,
        storiesRows: storiesData?.length || 0,
        reelRawDataRows: reelRawData?.length || 0,
        reelSheetRows: reelSheetData?.length || 0,
        dailyRows: dailyData?.length || 0
      }
    };
    
    console.log('データ取得完了');
    
    return NextResponse.json(completeData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
  } catch (error) {
    console.error('Google Sheets API エラー詳細:', error);
    
    return NextResponse.json(
      { 
        error: 'スプレッドシートからのデータ取得に失敗しました',
        details: error.message,
        // デバッグ情報
        debug: {
          spreadsheetId: SPREADSHEET_ID,
          hasCredentials: !!GOOGLE_CREDENTIALS.private_key,
          errorType: error.constructor.name,
          errorCode: error.code
        }
      },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}