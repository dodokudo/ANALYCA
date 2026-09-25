import { ImageResponse } from 'next/og';

export const alt = 'ANALYCA Media';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: '#ffffff', color: '#10223d' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22, fontSize: 38, fontWeight: 800 }}>
        <div style={{ width: 18, height: 54, background: '#176bff', borderRadius: 5, transform: 'skewX(-12deg)' }} />
        ANALYCA Media
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 76, lineHeight: 1.05, fontWeight: 900, letterSpacing: '-0.05em' }}>
        <div>運用の答えを、</div>
        <div>実行できる形に。</div>
      </div>
      <div style={{ height: 8, width: '100%', background: '#176bff' }} />
    </div>,
    size,
  );
}
