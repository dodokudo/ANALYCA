# ANALYCA デザインガイドライン

このドキュメントはANALYCAプロジェクトのデザインシステムを定義します。
新規コンポーネント作成時は必ずこのガイドラインに従ってください。

---

## 1. ブランドカラー

### 1.1 メインブランドグラデーション

ANALYCAのアイコン、主要ボタン、アクセントに使用する**最も重要な色**です。

```css
/* メイングラデーション */
background: linear-gradient(to right, #a855f7, #34d399);
/* Tailwind */
bg-gradient-to-r from-purple-500 to-emerald-400
```

**使用箇所:**
- ANALYCAロゴアイコン背景
- プライマリボタン
- ローディングスピナー
- 強調したいアクセント要素

### 1.2 ページ背景

#### メインダッシュボード背景
```css
bg-gradient-to-r from-pink-50/70 via-blue-50/50 to-teal-50/30
```
ピンク → 青 → ティールの柔らかいグラデーション

#### チェックアウト・プライシング背景
```css
bg-gradient-to-br from-purple-50 via-white to-emerald-50
```

#### ローディング画面背景
```css
bg-gradient-to-br from-purple-50 to-emerald-50
```

### 1.3 テキストカラー

| 用途 | カラーコード | Tailwindクラス |
|------|------------|---------------|
| プライマリ（見出し、本文） | `#161819` | `text-gray-900` |
| セカンダリ（サブテキスト） | `#4a4d51` | `text-gray-600` |
| ミュート（キャプション） | `#6c6f73` | `text-gray-500` |

### 1.4 ステータスカラー

| 状態 | カラー | Tailwindクラス |
|------|--------|---------------|
| 成功/増加 | `#19c37d` | `text-green-500` |
| 警告 | `#ffb020` | `text-amber-500` |
| エラー/減少 | `#ff4d4f` | `text-red-500` |
| アクセント（リンク） | `#0a7aff` | `text-blue-500` |

### 1.5 プラットフォーム固有カラー

| プラットフォーム | カラー | グラデーション |
|----------------|--------|---------------|
| Instagram | `#E1306C` | `from-pink-500 to-purple-500` |
| Threads | `#000000` | `from-purple-500 to-emerald-400` |
| LINE | `#06C755` | - |

---

## 2. ロゴ

ANALYCAロゴは**iOSアプリアイコン風**の角丸四角形を使用します。

### 2.1 ロゴコンポーネント使用方法

```tsx
import AnalycaLogo from '@/components/AnalycaLogo';

// サイズバリエーション
<AnalycaLogo size="sm" />   // 32x32px
<AnalycaLogo size="md" />   // 40x40px（デフォルト）
<AnalycaLogo size="lg" />   // 48x48px
<AnalycaLogo size="xl" />   // 56x56px

// テキスト付き
<AnalycaLogo size="md" showText />
<AnalycaLogo size="md" showText subtitle="Demo Account" />
```

### 2.2 ロゴの角丸

| サイズ | 角丸 |
|--------|-----|
| sm | 8px |
| md | 10px |
| lg | 12px |
| xl | 14px |

---

## 3. 角丸（Border Radius）

| 用途 | サイズ | Tailwindクラス |
|------|--------|---------------|
| 小さい要素（タグ、バッジ） | 8px | `rounded-lg` |
| カード内要素、入力フィールド | 12px | `rounded-xl` |
| カード、モーダル | 16px | `rounded-2xl` |
| 大きなカード | 20px | `rounded-3xl` |
| 円形（アバター、ピル） | 9999px | `rounded-full` |

---

## 4. シャドウ

| 用途 | 値 | CSS変数 |
|------|-----|---------|
| 軽いシャドウ | `0 6px 18px rgba(12, 16, 20, 0.06)` | `--shadow-soft` |
| 浮き上がり | `0 12px 30px rgba(12, 16, 20, 0.08)` | `--shadow-elevated` |
| ui-card | `0 18px 36px rgba(14, 20, 34, 0.12)` | - |

---

## 5. タイポグラフィ

### 5.1 フォントファミリー

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

### 5.2 フォントサイズの使い分け

| 用途 | サイズ | Tailwindクラス |
|------|--------|---------------|
| キャプション、ラベル | 12px | `text-xs` |
| 本文小、サブテキスト | 14px | `text-sm` |
| 本文 | 16px | `text-base` |
| 小見出し | 18px | `text-lg` |
| 中見出し | 20px | `text-xl` |
| 大見出し | 24px | `text-2xl` |
| ページタイトル | 30px | `text-3xl` |
| ヒーロータイトル | 36px | `text-4xl` |

---

## 6. コンポーネントスタイル

### 6.1 ボタン

#### プライマリボタン（メインアクション）
```tsx
<button className="bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-600 hover:to-emerald-500 text-white font-semibold py-3 px-6 rounded-xl transition-all disabled:opacity-50">
  ボタンテキスト
</button>
```

#### セカンダリボタン（サブアクション）
```tsx
<button className="border border-gray-300 bg-white text-gray-800 hover:bg-gray-100 font-medium rounded-xl py-3 px-6 transition-colors">
  ボタンテキスト
</button>
```

#### タブボタン
```tsx
// アクティブ
<button className="h-9 rounded-lg px-3 text-sm font-medium bg-gray-900 text-white">
  タブ名
</button>
// 非アクティブ
<button className="h-9 rounded-lg px-3 text-sm font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50">
  タブ名
</button>
```

### 6.2 カード

#### メインカード（ui-card）
```tsx
<div className="ui-card p-4 md:p-6">
  {/* コンテンツ */}
</div>
```

#### KPI/メトリクスカード
```tsx
<div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">ラベル</dt>
  <dd className="mt-2 text-2xl font-semibold text-gray-900">値</dd>
</div>
```

#### トップコンテンツカード（ハイライト）
```tsx
<div className="rounded-xl border border-amber-300 bg-amber-50/30 p-3">
  {/* ランキング上位のコンテンツ */}
</div>
```

### 6.3 入力フィールド

```tsx
<input
  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all text-gray-900 placeholder-gray-400"
  placeholder="プレースホルダー"
/>
```

### 6.4 セレクトボックス

```tsx
<select className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-600">
  <option value="option1">オプション1</option>
  <option value="option2">オプション2</option>
</select>
```

---

## 7. レイアウト

### 7.1 ページ構造

```
┌─────────────────────────────────────────┐
│ [サイドバー]  │    [メインコンテンツ]    │
│   w-56       │     flex-1              │
│              │                          │
│   ・ロゴ      │   ・ヘッダー（タブ、日付）│
│   ・ナビ      │   ・カードグリッド       │
│              │   ・テーブル            │
│              │   ・グラフ              │
└─────────────────────────────────────────┘
```

### 7.2 レスポンシブ

| ブレークポイント | サイドバー | ボトムナビ |
|----------------|----------|----------|
| モバイル（< 1024px） | 非表示 | 表示 |
| デスクトップ（≥ 1024px） | 表示 | 非表示 |

### 7.3 グリッドレイアウト

#### 2カラム（アカウント + KPI）
```tsx
<div className="grid lg:grid-cols-12 gap-4">
  <div className="lg:col-span-3">{/* アカウント情報 */}</div>
  <div className="lg:col-span-9">{/* KPI */}</div>
</div>
```

#### KPIグリッド
```tsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  {/* KPIカード x 4 */}
</div>
```

#### コンテンツカードグリッド
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
  {/* 投稿カード */}
</div>
```

---

## 8. グラフ・チャート

### 8.1 カラーパレット

| 用途 | カラー |
|------|--------|
| 棒グラフ（閲覧数など） | `#6366f1`（インディゴ） |
| 線グラフ（フォロワーなど） | `#8b5cf6`（紫） |
| グリッド線 | `#e2e8f0` |
| 軸ラベル | `#475569` |

### 8.2 複合グラフ（棒 + 線）

```tsx
<ComposedChart>
  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#475569' }} />
  <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#475569' }} />
  <YAxis yAxisId="right" orientation="right" />
  <Bar yAxisId="left" dataKey="views" fill="#6366f1" opacity={0.7} />
  <Line yAxisId="right" dataKey="followers" stroke="#8b5cf6" strokeWidth={2} />
</ComposedChart>
```

---

## 9. アニメーション

### 9.1 トランジション

```css
/* デフォルト */
transition: all 0.2s ease;

/* カラー変更のみ */
transition: colors 0.2s ease;
```

### 9.2 ローディング

```tsx
// パルス
<div className="animate-pulse">...</div>

// スピナー
<div className="animate-spin">...</div>
```

---

## 10. CSS変数一覧

```css
:root {
  /* サーフェス */
  --color-surface: #ffffff;
  --color-surface-muted: #fafafa;
  --color-border: #e1e3e6;

  /* テキスト */
  --color-text-primary: #161819;
  --color-text-secondary: #4a4d51;
  --color-text-muted: #6c6f73;

  /* アクセント */
  --color-accent: #0a7aff;
  --color-success: #19c37d;
  --color-warning: #ffb020;
  --color-error: #ff4d4f;

  /* シャドウ */
  --shadow-elevated: 0 12px 30px rgba(12, 16, 20, 0.08);
  --shadow-soft: 0 6px 18px rgba(12, 16, 20, 0.06);

  /* 角丸 */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
}
```

---

## 11. 使用例：新規ページ作成

```tsx
'use client';

import AnalycaLogo from '@/components/AnalycaLogo';

export default function NewPage() {
  return (
    <div className="min-h-screen bg-gradient-to-r from-pink-50/70 via-blue-50/50 to-teal-50/30">
      {/* ヘッダー */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <AnalycaLogo size="md" showText />
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="ui-card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">見出し</h2>
          <p className="text-gray-600">本文テキスト</p>
        </div>
      </main>
    </div>
  );
}
```

---

## 更新履歴

- 2024-12-18: 初版作成
