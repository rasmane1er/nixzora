import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import QRCode from 'qrcode';
import { Banner, PageHeader } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { currentStaff } from '@/lib/auth';
import { param, type SearchParams } from '@/lib/format';
import { SETUP_COOKIE } from '@/lib/session';
import { startSetup } from '../actions';
import { EnableForm } from './EnableForm';

export const metadata: Metadata = { title: 'Set up two-step verification' };

export default async function SetupPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const me = await currentStaff();
  const otpauthUrl = (await cookies()).get(SETUP_COOKIE)?.value;

  if (me.mfaEnabled && !otpauthUrl) {
    return (
      <>
        <PageHeader eyebrow="Account" title="Two-step verification" />
        <section className="card">
          <p>Two-step verification is already on for {me.email}.</p>
          <Link href="/">Go to the dashboard →</Link>
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
      <PageHeader eyebrow="Required for staff" title="Set up two-step verification" />
      <Banner error={param(params, 'error')} />

      {!qr ? (
        <section className="card">
          <p>
            Staff tools need a code from an authenticator app (1Password, Google Authenticator,
            Authy…) on top of your password. It takes about a minute.
          </p>
          <form action={startSetup}>
            <SubmitButton>Start setup</SubmitButton>
          </form>
        </section>
      ) : (
        <section className="card">
          <h2>1. Scan this code</h2>
          {/* A data: URL generated on the server; nothing is fetched from elsewhere. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="qr"
            src={qr}
            alt="QR code for your authenticator app"
            width={200}
            height={200}
          />
          {secret ? (
            <p className="muted">
              Can&apos;t scan? Enter this key instead: <code>{secret}</code>
            </p>
          ) : null}
          <h2>2. Enter the 6-digit code it shows</h2>
          <EnableForm />
        </section>
      )}
    </>
  );
}
