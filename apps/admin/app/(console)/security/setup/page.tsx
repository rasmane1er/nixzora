import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import QRCode from 'qrcode';
import { Banner, PageHeader } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { currentStaff } from '@/lib/auth';
import { param, type SearchParams } from '@/lib/format';
import { getT } from '@/lib/i18n';
import { SETUP_COOKIE } from '@/lib/session';
import { startSetup } from '../actions';
import { EnableForm } from './EnableForm';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('ops');
  return { title: t('setupTitle') };
}

export default async function SetupPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const me = await currentStaff();
  const [t, common] = await Promise.all([getT('ops'), getT('common')]);
  const otpauthUrl = (await cookies()).get(SETUP_COOKIE)?.value;

  if (me.mfaEnabled && !otpauthUrl) {
    return (
      <>
        <PageHeader eyebrow={common('account')} title={t('twoStep')} />
        <section className="card">
          <p>{t('alreadyOn', { email: me.email })}</p>
          <Link href="/">{t('goToDashboard')}</Link>
        </section>
      </>
    );
  }

  const secret = otpauthUrl ? new URL(otpauthUrl).searchParams.get('secret') : null;
  const qr = otpauthUrl
    ? await QRCode.toDataURL(otpauthUrl, { margin: 0, width: 200, errorCorrectionLevel: 'M' })
    : null;

  return (
    <>
      <PageHeader eyebrow={t('requiredForStaff')} title={t('setupTitle')} />
      <Banner error={param(params, 'error')} />

      {!qr ? (
        <section className="card">
          <p>{t('setupIntro')}</p>
          <form action={startSetup}>
            <SubmitButton>{t('startSetup')}</SubmitButton>
          </form>
        </section>
      ) : (
        <section className="card">
          <h2>{t('scanTitle')}</h2>
          {/* A data: URL generated on the server; nothing is fetched from elsewhere. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="qr" src={qr} alt={t('qrAlt')} width={200} height={200} />
          {secret ? (
            <p className="muted">
              {t('cantScan')} <code>{secret}</code>
            </p>
          ) : null}
          <h2>{t('enterSixDigit')}</h2>
          <EnableForm />
        </section>
      )}
    </>
  );
}
