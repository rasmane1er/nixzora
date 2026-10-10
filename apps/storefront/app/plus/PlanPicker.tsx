'use client';

import { type PlusPlan } from '@nixzora/validation';
import { type ReactNode, useState } from 'react';

export type PlanCopy = { name: string; price: string; save?: string; terms: string; cta: string };

/**
 * The two plans (p10-15). The terms and the button follow the plan picked, so the shopper
 * always reads the exact price and renewal they are agreeing to before joining.
 */
export function PlanPicker({
  plans,
  legend,
  children,
  canJoin,
}: {
  plans: Record<PlusPlan, PlanCopy>;
  legend: string;
  /** The card choice, between the plans and the terms. */
  children?: ReactNode;
  canJoin: boolean;
}) {
  const [plan, setPlan] = useState<PlusPlan>('MONTHLY');
  const chosen = plans[plan];
  return (
    <>
      <fieldset className="plus-plans">
        <legend className="sr-only">{legend}</legend>
        {(Object.keys(plans) as PlusPlan[]).map((key) => (
          <label key={key} className="plus-plan card">
            <input
              type="radio"
              name="plan"
              value={key}
              checked={plan === key}
              onChange={() => setPlan(key)}
            />
            <span className="plus-plan__name">{plans[key].name}</span>
            <span className="plus-plan__price">{plans[key].price}</span>
            {plans[key].save ? <span className="plus-plan__save">{plans[key].save}</span> : null}
          </label>
        ))}
      </fieldset>
      {children}
      {canJoin ? (
        <>
          <p className="hint plus-terms">{chosen.terms}</p>
          <button className="btn btn--primary plus-cta" type="submit">
            {chosen.cta}
          </button>
        </>
      ) : null}
    </>
  );
}
