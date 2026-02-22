/**
 * ANALYCA サブスクリプションプラン定義（一元管理）
 * checkout/page.tsx と api/payment/subscribe/route.ts の両方からimportする
 */

export interface Plan {
  name: string;
  subtitle: string;
  price: number;
  onboardingPath: string;
}

export const PLANS: Record<string, Plan> = {
  'light-threads': {
    name: 'Light',
    subtitle: 'Threads分析',
    price: 4980,
    onboardingPath: '/onboarding/light',
  },
  'light-instagram': {
    name: 'Light',
    subtitle: 'Instagram分析',
    price: 4980,
    onboardingPath: '/onboarding/light2',
  },
  'standard': {
    name: 'Standard',
    subtitle: 'Instagram + Threads',
    price: 9800,
    onboardingPath: '/onboarding/standard',
  },
};
