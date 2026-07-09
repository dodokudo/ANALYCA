import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getGrandprixRankingData } from '@/app/threads-grandprix/ranking/data';

export const runtime = 'nodejs';

const MEDALS = ['🥇', '🥈', '🥉'];

// 日本語フォントを同梱していないため、描画は英数字と絵文字のみで構成する
export async function GET(request: NextRequest) {
  let top3: Array<{ username: string; delta: number }> = [];
  let daysRemaining = 0;
  let dateLabel = '';

  try {
    const data = await getGrandprixRankingData(undefined, request.nextUrl.searchParams.get('event') || undefined);
    const scope = data.scopes.find((s) => s.key === 'monthly') || data.scopes[0];
    top3 = scope.followerRanking.slice(0, 3).map((row) => ({ username: row.threadsUsername, delta: row.followerDelta }));
    daysRemaining = data.event.daysRemaining;
    dateLabel = `${data.event.startDate.replaceAll('-', '.')} - ${data.event.endDate.replaceAll('-', '.')}`;
  } catch (error) {
    console.error('Grandprix OG image error:', error);
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px 64px',
          background: 'linear-gradient(120deg, #071c38 0%, #0b2d55 55%, #0877d9 130%)',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 26, fontWeight: 700, letterSpacing: 6, color: '#7fd4ff' }}>ANALYCA PRESENTS</div>
            <div style={{ display: 'flex', fontSize: 68, fontWeight: 900, lineHeight: 1.1 }}>THREADS</div>
            <div
              style={{ display: 'flex',
                fontSize: 68,
                fontWeight: 900,
                lineHeight: 1.1,
                background: 'linear-gradient(90deg, #ffe58a, #f6b900)',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              GRANDPRIX
            </div>
            <div style={{ display: 'flex', marginTop: 10, fontSize: 24, fontWeight: 700, color: '#9db8d8' }}>{dateLabel}</div>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 24,
              padding: '20px 32px',
            }}
          >
            <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: '#9db8d8', letterSpacing: 3 }}>DAYS LEFT</div>
            <div style={{ display: 'flex', fontSize: 72, fontWeight: 900, color: '#ffe58a', lineHeight: 1 }}>{daysRemaining}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {top3.map((row, index) => (
            <div
              key={row.username}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: index === 0 ? 'rgba(246,185,0,0.22)' : 'rgba(255,255,255,0.1)',
                borderRadius: 20,
                padding: '16px 28px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <div style={{ display: 'flex', fontSize: 40 }}>{MEDALS[index]}</div>
                <div style={{ display: 'flex', fontSize: 36, fontWeight: 900 }}>{`@${row.username}`}</div>
              </div>
              <div style={{ display: 'flex', fontSize: 36, fontWeight: 900, color: '#7ef0c2' }}>
                {row.delta > 0 ? `+${row.delta.toLocaleString('en-US')}` : row.delta.toLocaleString('en-US')}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: 26, fontWeight: 700, letterSpacing: 4, color: '#7fd4ff' }}>LIVE RANKING</div>
          <div style={{ display: 'flex', fontSize: 26, fontWeight: 700, color: '#9db8d8' }}>analyca.jp/threads-grandprix/ranking</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
