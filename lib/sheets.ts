// Google Sheets API操作用ライブラリ（GEM QUEEN専用）
import { google, sheets_v4 } from 'googleapis';

export interface SheetsConfig {
  spreadsheetId: string;
  range: string;
}

export class GoogleSheetsAPI {
  private sheets: sheets_v4.Sheets;
  private spreadsheetId: string;

  constructor(spreadsheetId: string) {
    // 既存のGEM QUEEN環境変数を使用
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}');

    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });

    this.sheets = google.sheets({ version: 'v4', auth });
    this.spreadsheetId = spreadsheetId;
  }

  // Instagram生データ取得
  async getInstagramRawData(): Promise<string[][]> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Instagram insight!A:Z',
      });
      return response.data.values || [];
    } catch (error) {
      console.error('Error fetching Instagram raw data:', error);
      return [];
    }
  }

  // ストーリーズ生データ取得
  async getStoriesRawData(): Promise<string[][]> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'stories rawdata!A:Z',
      });
      return response.data.values || [];
    } catch (error) {
      console.error('Error fetching stories raw data:', error);
      return [];
    }
  }

  // ストーリーズ処理済みデータ取得
  async getStoriesProcessedData(): Promise<string[][]> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'stories!A:Z',
      });
      return response.data.values || [];
    } catch (error) {
      console.error('Error fetching stories processed data:', error);
      return [];
    }
  }

  // リール生データ取得
  async getReelRawData(): Promise<string[][]> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'reel rawdata!A:Z',
      });
      return response.data.values || [];
    } catch (error) {
      console.error('Error fetching reel raw data:', error);
      return [];
    }
  }

  // リールシート取得
  async getReelSheetData(): Promise<string[][]> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'reel!A:Z',
      });
      return response.data.values || [];
    } catch (error) {
      console.error('Error fetching reel sheet data:', error);
      return [];
    }
  }

  // デイリーデータ取得
  async getDailyData(): Promise<string[][]> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'daily!A:Z',
      });
      return response.data.values || [];
    } catch (error) {
      console.error('Error fetching daily data:', error);
      return [];
    }
  }

  // 全データ取得（既存APIと互換性を保つ）
  async getAllData() {
    const [
      instagramRaw,
      storiesRaw,
      storiesProcessed,
      reelRawDataRaw,
      reelSheetRaw,
      dailyRaw
    ] = await Promise.all([
      this.getInstagramRawData(),
      this.getStoriesRawData(),
      this.getStoriesProcessedData(),
      this.getReelRawData(),
      this.getReelSheetData(),
      this.getDailyData()
    ]);

    return {
      instagramRaw,
      storiesRaw,
      storiesProcessed,
      reelRawDataRaw,
      reelSheetRaw,
      dailyRaw,
      dataInfo: {
        instagramRows: instagramRaw.length,
        storiesRows: storiesRaw.length,
        storiesProcessedRows: storiesProcessed.length,
        reelRawDataRows: reelRawDataRaw.length,
        reelSheetRows: reelSheetRaw.length,
        dailyRows: dailyRaw.length,
      }
    };
  }
}
