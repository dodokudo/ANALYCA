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
    
    // 実際のシート名に合わせて修正
    const ranges = [
      'Instagram insight!A:Z',      // Instagram raw → Instagram insight
      'stories rawdata!A:Z',        // Stories raw → stories rawdata
      'reel rawdata!A:Z',           // Reel rawdata → reel rawdata
      'reel!A:Z',                   // Reel sheet → reel
      'daily!A:Z',                  // Daily → daily
      'stories!A:Z'                 // 追加: stories シート
    ];
    
    console.log('取得範囲:', ranges);
    
    const batchResponse = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges: ranges,
    });
    
    console.log('API応答取得完了');
    
    const [instagramData, storiesRawData, reelRawData, reelSheetData, dailyData, storiesData] = 
      batchResponse.data.valueRanges?.map(range => range.values || []) || [];
    
    console.log('各シートのデータ行数:');
    console.log('- Instagram insight:', instagramData?.length || 0);
    console.log('- stories rawdata:', storiesRawData?.length || 0);
    console.log('- reel rawdata:', reelRawData?.length || 0);
    console.log('- reel:', reelSheetData?.length || 0);
    console.log('- daily:', dailyData?.length || 0);
    console.log('- stories:', storiesData?.length || 0);

    // データ内容のサンプルを確認
    console.log('=== データ内容サンプル ===');
    console.log('stories rawdata 最初の3行:', storiesRawData?.slice(0, 3));
    console.log('reel rawdata 最初の3行:', reelRawData?.slice(0, 3));
    console.log('reel sheet 最初の3行:', reelSheetData?.slice(0, 3));
    
    // データの構造化
    const completeData = {
      instagramRaw: instagramData || [],
      storiesRaw: storiesRawData || [],
      reelRawDataRaw: reelRawData || [],
      reelSheetRaw: reelSheetData || [],
      dailyRaw: dailyData || [],
      storiesProcessed: storiesData || [],
      dataInfo: {
        instagramRows: instagramData?.length || 0,
        storiesRows: storiesRawData?.length || 0,
        reelRawDataRows: reelRawData?.length || 0,
        reelSheetRows: reelSheetData?.length || 0,
        dailyRows: dailyData?.length || 0,
        storiesProcessedRows: storiesData?.length || 0
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
        details: error instanceof Error ? error.message : String(error),
        // デバッグ情報
        debug: {
          spreadsheetId: SPREADSHEET_ID,
          hasCredentials: !!GOOGLE_CREDENTIALS.private_key,
          errorType: error instanceof Error ? error.constructor.name : typeof error,
          errorCode: error instanceof Error && 'code' in error ? (error as { code?: string }).code : undefined
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