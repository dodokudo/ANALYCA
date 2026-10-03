import { getUsersExtendedInfo } from './admin-queries';
import { getAdminPaymentData, type AdminPaymentData } from './admin-payment-data';
import { adminPaymentSnapshotStore } from './admin-payment-snapshot';
import { listAllSubscriptions } from './univapay/client';

export async function syncAdminPaymentSnapshot(): Promise<AdminPaymentData> {
  const startedAt = new Date().toISOString();
  const [users, subscriptions] = await Promise.all([getUsersExtendedInfo(), listAllSubscriptions()]);
  const data = await getAdminPaymentData(users, subscriptions);
  // Older concurrent syncs must not supersede a more recently started sync.
  const snapshot = { ...data, fetchedAt: startedAt };
  await adminPaymentSnapshotStore().save(snapshot);
  return snapshot;
}
