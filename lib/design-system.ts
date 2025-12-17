/**
 * ANALYCA デザインシステム
 * ========================================
 * このファイルはANALYCAの全デザイン定義を管理します。
 * 新しいコンポーネント作成時は必ずこの定義を参照してください。
 */

// ============================================
// 1. ブランドカラー
// ============================================

export const colors = {
  // プライマリグラデーション（ロゴ、ボタン、アクセント）
  brand: {
    gradient: 'from-purple-500 to-emerald-400',
    gradientHover: 'from-purple-600 to-emerald-500',
    purple: '#a855f7', // purple-500
    emerald: '#34d399', // emerald-400
  },

  // ページ背景
  background: {
    // メインダッシュボード背景（ピンク→青→ティール）
    main: 'from-pink-50/70 via-blue-50/50 to-teal-50/30',
    // チェックアウト・プライシング背景
    checkout: 'from-purple-50 via-white to-emerald-50',
    // ローディング画面背景
    loading: 'from-purple-50 to-emerald-50',
  },

  // サーフェス（カード、ヘッダーなど）
  surface: {
    primary: '#ffffff',
    muted: '#fafafa',
    dark: '#1e1e1e', // ダークモード用
  },

  // ボーダー
  border: {
    default: '#e1e3e6',
    light: 'rgba(14, 20, 34, 0.05)',
    dark: 'rgba(255, 255, 255, 0.1)', // ダークモード用
  },

  // テキスト
  text: {
    primary: '#161819',
    secondary: '#4a4d51',
    muted: '#6c6f73',
    // ダークモード
    darkPrimary: '#f5f5f5',
    darkSecondary: '#a1a1a1',
    darkMuted: '#9CA3AF',
  },

  // アクセント（アクションカラー）
  accent: {
    primary: '#0a7aff', // リンク、アクティブ状態
    hover: '#005ae0',
    success: '#19c37d', // 成功、増加
    warning: '#ffb020', // 警告
    error: '#ff4d4f', // エラー、減少
  },

  // プラットフォーム固有カラー
  platform: {
    instagram: {
      gradient: 'from-pink-500 to-purple-500',
      solid: '#E1306C',
    },
    threads: {
      gradient: 'from-purple-500 to-emerald-400',
      solid: '#000000',
    },
    line: {
      solid: '#06C755',
    },
  },

  // グラフ・チャート用
  chart: {
    background: '#ffffff',
    grid: '#e2e8f0',
    axis: '#475569',
    tooltipBg: '#ffffff',
    tooltipBorder: '#e5e7eb',
    // データシリーズ用
    series: {
      primary: '#6366f1', // インディゴ - 棒グラフ
      secondary: '#8b5cf6', // 紫 - 線グラフ
      tertiary: '#34d399', // エメラルド
      quaternary: '#f59e0b', // オレンジ
    },
    // 円グラフ用
    pie: ['#06C755', '#E1306C', '#3B82F6', '#9CA3AF'],
  },

  // ランキング用
  ranking: {
    gold: { bg: 'bg-yellow-400', text: 'text-yellow-900' },
    silver: { bg: 'bg-gray-300', text: 'text-gray-700' },
    bronze: { bg: 'bg-amber-600', text: 'text-white' },
    other: { bg: 'bg-amber-100', text: 'text-amber-700' },
    highlight: { border: 'border-amber-300', bg: 'bg-amber-50/30' },
  },

  // ステータスカラー
  status: {
    positive: 'text-green-500',
    negative: 'text-red-500',
    neutral: 'text-gray-500',
  },
} as const;

// ============================================
// 2. 角丸（Border Radius）
// ============================================

export const radius = {
  sm: '8px', // 小さいボタン、タグ
  md: '12px', // カード内要素、入力フィールド
  lg: '16px', // カード、モーダル
  xl: '20px', // 大きなカード
  full: '9999px', // 完全な円、ピル形状

  // ロゴ専用（iOSアプリアイコン風）
  logo: {
    sm: '8px',
    md: '10px',
    lg: '12px',
    xl: '14px',
  },

  // Tailwindクラス名
  class: {
    sm: 'rounded-lg', // 8px
    md: 'rounded-xl', // 12px
    lg: 'rounded-2xl', // 16px
    xl: 'rounded-3xl', // 24px
    full: 'rounded-full',
  },
} as const;

// ============================================
// 3. シャドウ
// ============================================

export const shadows = {
  // 浮き上がった要素（モーダル、ドロップダウン）
  elevated: '0 12px 30px rgba(12, 16, 20, 0.08)',
  // 軽いシャドウ（カード）
  soft: '0 6px 18px rgba(12, 16, 20, 0.06)',
  // ui-card用の強いシャドウ
  card: '0 18px 36px rgba(14, 20, 34, 0.12)',
  // ホバー時
  hover: '0 24px 48px rgba(14, 20, 34, 0.16)',

  // Tailwindクラス名
  class: {
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl',
  },
} as const;

// ============================================
// 4. タイポグラフィ
// ============================================

export const typography = {
  // フォントファミリー
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",

  // フォントサイズ
  size: {
    xs: 'text-xs', // 12px - キャプション、ラベル
    sm: 'text-sm', // 14px - 本文小、サブテキスト
    base: 'text-base', // 16px - 本文
    lg: 'text-lg', // 18px - 小見出し
    xl: 'text-xl', // 20px - 中見出し
    '2xl': 'text-2xl', // 24px - 大見出し
    '3xl': 'text-3xl', // 30px - ページタイトル
    '4xl': 'text-4xl', // 36px - ヒーロータイトル
  },

  // フォントウェイト
  weight: {
    normal: 'font-normal', // 400
    medium: 'font-medium', // 500
    semibold: 'font-semibold', // 600
    bold: 'font-bold', // 700
  },

  // 行間
  leading: {
    tight: 'leading-tight',
    normal: 'leading-normal',
    relaxed: 'leading-relaxed',
  },
} as const;

// ============================================
// 5. スペーシング
// ============================================

export const spacing = {
  // 要素間のギャップ
  gap: {
    xs: 'gap-1', // 4px
    sm: 'gap-2', // 8px
    md: 'gap-3', // 12px
    lg: 'gap-4', // 16px
    xl: 'gap-6', // 24px
    '2xl': 'gap-8', // 32px
  },

  // パディング
  padding: {
    card: 'p-4 md:p-6', // カード内パディング
    section: 'p-4 lg:p-6', // セクションパディング
    button: 'px-4 py-3', // ボタンパディング
    buttonSm: 'px-3 py-2', // 小さいボタン
  },

  // セクション間のスペース（section-stackクラス）
  section: '32px', // モバイル
  sectionDesktop: '48px', // デスクトップ
} as const;

// ============================================
// 6. コンポーネントスタイル
// ============================================

export const components = {
  // ボタン
  button: {
    // プライマリボタン（グラデーション）
    primary: `
      bg-gradient-to-r from-purple-500 to-emerald-400
      hover:from-purple-600 hover:to-emerald-500
      text-white font-semibold
      rounded-xl py-3 px-6
      transition-all duration-200
      disabled:opacity-50 disabled:cursor-not-allowed
    `.replace(/\s+/g, ' ').trim(),

    // セカンダリボタン（アウトライン）
    secondary: `
      border border-gray-300
      bg-white text-gray-800
      hover:bg-gray-100
      font-medium rounded-xl py-3 px-6
      transition-colors
    `.replace(/\s+/g, ' ').trim(),

    // ゴーストボタン
    ghost: `
      text-gray-600 hover:text-gray-800
      hover:bg-gray-100
      rounded-lg px-3 py-2
      transition-colors
    `.replace(/\s+/g, ' ').trim(),

    // タブボタン（アクティブ）
    tabActive: 'bg-gray-900 text-white',
    tabInactive: 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
  },

  // カード
  card: {
    // メインカード（ui-card）
    main: `
      bg-white/88
      border border-gray-100
      rounded-2xl
      shadow-[0_18px_36px_rgba(14,20,34,0.12)]
      backdrop-blur-[18px]
      p-4 md:p-6
    `.replace(/\s+/g, ' ').trim(),

    // シンプルカード
    simple: 'bg-white border border-gray-200 rounded-2xl shadow-sm p-6',

    // KPI/メトリクスカード
    metric: `
      rounded-xl
      border border-gray-200
      bg-gray-50
      p-4
    `.replace(/\s+/g, ' ').trim(),
  },

  // 入力フィールド
  input: `
    w-full px-4 py-3
    border border-gray-300 rounded-xl
    focus:ring-2 focus:ring-gray-900 focus:border-transparent
    outline-none transition-all
    text-gray-900 placeholder-gray-400
  `.replace(/\s+/g, ' ').trim(),

  // セレクトボックス
  select: `
    h-9 rounded-lg
    border border-gray-200
    bg-white px-3
    text-sm text-gray-600
  `.replace(/\s+/g, ' ').trim(),

  // ヘッダー
  header: {
    sticky: 'sticky top-0 z-30 bg-white/80 backdrop-blur-sm border-b border-gray-200',
    fixed: 'fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200',
  },

  // サイドバー
  sidebar: 'bg-white border-r border-gray-200 w-56',

  // ボトムナビ
  bottomNav: `
    fixed bottom-0 left-0 right-0
    bg-white border-t border-gray-200
    z-40
  `.replace(/\s+/g, ' ').trim(),
} as const;

// ============================================
// 7. アニメーション
// ============================================

export const animation = {
  // トランジション
  transition: {
    default: 'transition-all duration-200',
    fast: 'transition-all duration-150',
    slow: 'transition-all duration-300',
    colors: 'transition-colors duration-200',
  },

  // パルス（ローディング）
  pulse: 'animate-pulse',

  // スピン（ローディングスピナー）
  spin: 'animate-spin',
} as const;

// ============================================
// 8. レスポンシブブレークポイント
// ============================================

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',

  // よく使うパターン
  patterns: {
    // サイドバー表示（デスクトップのみ）
    sidebarVisible: 'hidden lg:flex',
    // モバイルのみ表示
    mobileOnly: 'lg:hidden',
    // グリッドレイアウト
    gridResponsive: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  },
} as const;

// ============================================
// 9. CSS変数定義（globals.css用）
// ============================================

export const cssVariables = {
  light: {
    '--color-background': '#f5f5f5',
    '--color-surface': '#ffffff',
    '--color-surface-muted': '#fafafa',
    '--color-border': '#e1e3e6',
    '--color-text-primary': '#161819',
    '--color-text-secondary': '#4a4d51',
    '--color-text-muted': '#6c6f73',
    '--color-accent': '#0a7aff',
    '--color-accent-hover': '#005ae0',
    '--color-success': '#19c37d',
    '--color-warning': '#ffb020',
    '--color-error': '#ff4d4f',
    '--shadow-elevated': '0 12px 30px rgba(12, 16, 20, 0.08)',
    '--shadow-soft': '0 6px 18px rgba(12, 16, 20, 0.06)',
    '--radius-sm': '8px',
    '--radius-md': '12px',
    '--radius-lg': '16px',
    '--radius-xl': '20px',
  },
  dark: {
    '--color-background': '#111111',
    '--color-surface': '#1e1e1e',
    '--color-surface-muted': '#252525',
    '--color-border': 'rgba(255, 255, 255, 0.1)',
    '--color-text-primary': '#f5f5f5',
    '--color-text-secondary': '#a1a1a1',
    '--color-text-muted': '#9CA3AF',
    '--color-accent': '#60A5FA',
    '--color-accent-hover': '#3B82F6',
  },
} as const;

// ============================================
// 10. よく使うクラスの組み合わせ
// ============================================

export const presets = {
  // ページ背景
  pageBackground: 'min-h-screen bg-gradient-to-r from-pink-50/70 via-blue-50/50 to-teal-50/30',

  // ローディング背景
  loadingBackground: 'min-h-screen bg-gradient-to-br from-purple-50 to-emerald-50',

  // ANALYCAロゴアイコン背景
  logoIcon: 'bg-gradient-to-r from-purple-500 to-emerald-400',

  // センタリング
  center: 'flex items-center justify-center',

  // カードグリッド
  cardGrid: 'grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3',

  // KPIグリッド
  kpiGrid: 'grid grid-cols-2 md:grid-cols-4 gap-4',

  // トップコンテンツカード（ハイライト）
  topContentCard: 'border-amber-300 bg-amber-50/30',

  // 遷移率表示エリア
  transitionRate: 'rounded-md bg-gradient-to-r from-purple-50 to-indigo-50 p-2 border border-purple-100',

  // エラーアラート
  errorAlert: 'bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm',

  // 成功アラート
  successAlert: 'bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm',
} as const;
