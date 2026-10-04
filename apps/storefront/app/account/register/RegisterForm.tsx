'use client';

import { rich } from '@nixzora/i18n';
import {
  flagOf,
  PHONE_COUNTRIES,
  passwordChecks,
  type SignUpProblem,
  type SignUpValues,
} from '@nixzora/validation';
import Link from 'next/link';
import { useActionState, useMemo, useState } from 'react';
import { useLocale, useT } from '@/components/I18nProvider';
import { register, type SignUpState } from '../actions';

type Field = keyof SignUpValues;

/** The sign-up form: every field checked as you go, and kept if something needs fixing. */
export function RegisterForm({ next, defaultCountry }: { next: string; defaultCountry: string }) {
  const t = useT('auth');
  const locale = useLocale();
  const [state, action, pending] = useActionState<SignUpState, FormData>(register, {});
  const kept = state.values ?? {};
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [email, setEmail] = useState(kept.email ?? '');
  const [firstName, setFirstName] = useState(kept.firstName ?? '');
  const [lastName, setLastName] = useState(kept.lastName ?? '');
  const [phoneCountry, setPhoneCountry] = useState(kept.phoneCountry ?? defaultCountry);
  const [phone, setPhone] = useState(kept.phone ?? '');
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(kept.marketingEmails ?? false);
  const [shown, setShown] = useState({ password: false, confirm: false });
  const checks = passwordChecks({ password, confirmPassword: confirm, email, firstName, lastName });

  const countryNames = useMemo(() => {
    const names = new Intl.DisplayNames([locale], { type: 'region' });
    return PHONE_COUNTRIES.map((c) => ({ ...c, name: names.of(c.iso) ?? c.iso })).sort((a, b) =>
      a.name.localeCompare(b.name, locale),
    );
  }, [locale]);

  const problem = (field: Field): string | undefined => {
    const code: SignUpProblem | undefined = state.problems?.[field];
    if (code) return t(`problem_${code}`);
    const api = state.fieldErrors?.[field];
    return api;
  };
  const errorProps = (field: Field) => {
    const message = problem(field);
    return message
      ? { 'aria-invalid': true as const, 'aria-describedby': `${field}-error` }
      : { 'aria-invalid': false as const };
  };
  const errorText = (field: Field) => {
    const message = problem(field);
    return message ? (
      <span className="field-error" id={`${field}-error`}>
        {message}
      </span>
    ) : null;
  };
  const star = (
    <span className="req" aria-hidden="true">
      *
    </span>
  );

  return (
    <form action={action} className="form signup-form" noValidate>
      <input type="hidden" name="next" value={next} />
      {state.error ? (
        <p className="banner banner--error" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="signup-row">
        <label>
          <span>
            {t('firstName')} {star}
            <span className="sr-only"> ({t('required')})</span>
          </span>
          <input
            name="firstName"
            autoComplete="given-name"
            maxLength={100}
            required
            placeholder={t('firstNamePlaceholder')}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            {...errorProps('firstName')}
          />
          {errorText('firstName')}
        </label>
        <label>
          <span>
            {t('lastName')} {star}
            <span className="sr-only"> ({t('required')})</span>
          </span>
          <input
            name="lastName"
            autoComplete="family-name"
            maxLength={100}
            required
            placeholder={t('lastNamePlaceholder')}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            {...errorProps('lastName')}
          />
          {errorText('lastName')}
        </label>
      </div>

      <label>
        <span>
          {t('emailAddress')} {star}
          <span className="sr-only"> ({t('required')})</span>
        </span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder={t('emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          {...errorProps('email')}
        />
        {errorText('email')}
      </label>

      <fieldset className="signup-phone">
        <legend>
          {t('mobilePhone')} <span className="hint">({t('optional')})</span>
        </legend>
        <div className="phone-input">
          {/* Shows the flag and code; the native list (with country names) opens on click. */}
          <span className="phone-country">
            <span aria-hidden="true">
              {flagOf(phoneCountry)} +{PHONE_COUNTRIES.find((c) => c.iso === phoneCountry)?.dial}
            </span>
            <select
              name="phoneCountry"
              aria-label={t('countryCode')}
              value={phoneCountry}
              onChange={(e) => setPhoneCountry(e.target.value)}
              autoComplete="tel-country-code"
            >
              {countryNames.map((c) => (
                <option key={c.iso} value={c.iso}>
                  {`${flagOf(c.iso)} ${c.name} (+${c.dial})`}
                </option>
              ))}
            </select>
          </span>
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            maxLength={20}
            aria-label={t('mobilePhone')}
            placeholder={t('mobilePlaceholder')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            {...errorProps('phone')}
          />
        </div>
        {errorText('phone') ?? <span className="hint">{t('mobileHint')}</span>}
      </fieldset>

      <div className="signup-row">
        <label>
          <span>
            {t('password')} {star}
            <span className="sr-only"> ({t('required')})</span>
          </span>
          <span className="password-input">
            <input
              name="password"
              type={shown.password ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              placeholder={t('passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              {...errorProps('password')}
            />
            <button
              type="button"
              className="password-toggle"
              aria-label={shown.password ? t('hidePasswordAria') : t('showPasswordAria')}
              aria-pressed={shown.password}
              onClick={() => setShown((s) => ({ ...s, password: !s.password }))}
            >
              <EyeIcon />
              {shown.password ? t('hide') : t('show')}
            </button>
          </span>
          {errorText('password')}
        </label>
        <label>
          <span>
            {t('confirmPassword')} {star}
            <span className="sr-only"> ({t('required')})</span>
          </span>
          <span className="password-input">
            <input
              name="confirmPassword"
              type={shown.confirm ? 'text' : 'password'}
              autoComplete="new-password"
              required
              maxLength={128}
              placeholder={t('confirmPlaceholder')}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              {...errorProps('confirmPassword')}
            />
            <button
              type="button"
              className="password-toggle"
              aria-label={shown.confirm ? t('hidePasswordAria') : t('showPasswordAria')}
              aria-pressed={shown.confirm}
              onClick={() => setShown((s) => ({ ...s, confirm: !s.confirm }))}
            >
              <EyeIcon />
              {shown.confirm ? t('hide') : t('show')}
            </button>
          </span>
          {errorText('confirmPassword')}
        </label>
      </div>

      <ul className="password-checks" aria-label={t('passwordRules')} aria-live="polite">
        {(['length', 'notPersonal', 'matches'] as const).map((key) => (
          <li key={key} className={checks[key] ? 'is-met' : undefined}>
            <CheckIcon met={checks[key]} />
            {t(`check_${key}`)}
          </li>
        ))}
      </ul>

      <label className="check">
        <input
          type="checkbox"
          name="acceptTerms"
          required
          checked={terms}
          onChange={(e) => setTerms(e.target.checked)}
          {...errorProps('acceptTerms')}
        />
        <span>
          {rich(t('acceptTerms'), {
            terms: (chunk) => (
              <Link key="terms" href="/terms" target="_blank">
                {chunk}
              </Link>
            ),
            privacy: (chunk) => (
              <Link key="privacy" href="/privacy" target="_blank">
                {chunk}
              </Link>
            ),
          })}
        </span>
      </label>
      {errorText('acceptTerms')}
      <label className="check">
        <input
          type="checkbox"
          name="marketingEmails"
          checked={marketing}
          onChange={(e) => setMarketing(e.target.checked)}
        />
        <span>{t('marketingOptIn')}</span>
      </label>

      <button className="btn btn--primary btn--block" type="submit" disabled={pending}>
        {pending ? '…' : t('createAccountButton')}
      </button>
    </form>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  );
}

function CheckIcon({ met }: { met: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle
        cx="12"
        cy="12"
        r="10"
        fill={met ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
      />
      {met ? <path d="m7.5 12.5 3 3 6-6.5" fill="none" stroke="#fff" strokeWidth="2.4" /> : null}
    </svg>
  );
}
