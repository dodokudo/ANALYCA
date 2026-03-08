# ANALYCA Project Overview

## Purpose
Instagram & Threads分析SaaSダッシュボード。Meta公式APIでユーザーのSNSデータをBigQueryに蓄積・可視化。

## Tech Stack
- Next.js 16 (App Router, Turbopack)
- TypeScript, Tailwind CSS 4
- BigQuery (GCP project: mark-454114, dataset: analyca)
- UnivaPay (決済)
- Google Cloud Storage (画像保存)
- Sentry (エラー監視)
- Vercel (デプロイ)

## Commands
- `npm run dev` — dev server (Turbopack)
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm run start` — production serve

## Key Structure
- `app/` — Pages & API routes
- `app/[userId]/` — Main dashboard
- `app/api/` — All API endpoints (auth, sync, payment, webhooks, cron)
- `lib/` — Data utilities (bigquery.ts, threads.ts, instagram.ts, univapay/)
- `components/` — Shared UI (AnalycaLogo, LoadingScreen)

## Conventions
- TypeScript mandatory, explicit types on exports
- PascalCase components, camelCase helpers, SCREAMING_SNAKE_CASE env vars
- kebab-case filenames
- 2-space indent, Tailwind for styling
- DESIGN_GUIDELINE.md has full design system (colors, components, layout)

## Auth
- Custom OAuth (no NextAuth) — Instagram + Threads
- Cookie + localStorage for session (`analycaUserId`)
- Tokens: 60-day long-lived, Threads auto-refresh via cron

## Plans
- Light (Threads): ¥4,980/mo
- Light (Instagram): ¥4,980/mo  
- Standard (Both): ¥9,800/mo
- Course (one-time): ¥110,000

## Meta API Permissions (as of 2026-03)
- threads_basic ✅
- threads_manage_insights ✅
- threads_content_publish ✅
- threads_manage_replies ✅
- threads_read_replies — pending review

## BigQuery Tables
users, instagram_reels, instagram_stories, instagram_insights, line_daily, threads_posts, threads_comments
