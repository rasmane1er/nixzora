import { errorMessage } from '@nixzora/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { Banner, Button } from './ui';

/** "Notify me when it is back" on a sold-out product (p10-06). */
export function StockAlertButton({ productId }: { productId: string }) {
  const c = useT('community');
  const { status } = useSession();
  const client = useQueryClient();
  const alerts = useQuery({
    queryKey: ['alerts'],
    queryFn: () => api.account.alerts(),
    enabled: status === 'signedIn',
  });
  const on = !!alerts.data?.some((a) => a.productId === productId && a.kind === 'BACK_IN_STOCK');
  const toggle = useMutation({
    mutationFn: () => api.account.setAlert(productId, 'BACK_IN_STOCK', !on),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['alerts'] }),
  });
  if (status !== 'signedIn') {
    return (
      <Button title={c('notifySignIn')} tone="secondary" onPress={() => router.push('/sign-in')} />
    );
  }
  return (
    <>
      {on ? <Banner tone="ok">{c('notifyOn')}</Banner> : null}
      {toggle.error ? <Banner tone="error">{errorMessage(toggle.error)}</Banner> : null}
      <Button
        title={on ? c('notifyOff') : c('notifyMe')}
        tone={on ? 'ghost' : 'secondary'}
        loading={toggle.isPending || alerts.isLoading}
        onPress={() => toggle.mutate()}
      />
    </>
  );
}
