'use client';

import { type ShoppingListView } from '@nixzora/validation';
import { useActionState, useState } from 'react';
import { useT } from '@/components/I18nProvider';
import { createList, type ListState, updateList } from './actions';

/** New list, or the settings of one (name, registry date, note, sharing). */
export function ListForm({ list }: { list?: ShoppingListView }) {
  const t = useT('lists');
  const [state, action, pending] = useActionState<ListState, FormData>(
    list ? updateList : createList,
    {},
  );
  const [kind, setKind] = useState(list?.kind ?? 'LIST');
  return (
    <form action={action} className="card form list-form">
      {list ? <input type="hidden" name="id" value={list.id} /> : <h2>{t('newList')}</h2>}
      <div className="form-row">
        <label>
          {t('name')}
          <input
            name="name"
            required
            maxLength={60}
            defaultValue={list?.name}
            placeholder={t('namePlaceholder')}
          />
        </label>
        <label>
          {t('kind')}
          <select
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value === 'REGISTRY' ? 'REGISTRY' : 'LIST')}
          >
            <option value="LIST">{t('kind_LIST')}</option>
            <option value="REGISTRY">{t('kind_REGISTRY')}</option>
          </select>
        </label>
      </div>
      {kind === 'REGISTRY' ? (
        <div className="form-row">
          <label>
            {t('eventDate')}
            <input type="date" name="eventDate" defaultValue={list?.eventDate ?? ''} />
          </label>
          <label>
            {t('note')}
            <input name="note" maxLength={300} defaultValue={list?.note ?? ''} />
          </label>
        </div>
      ) : null}
      <label className="check">
        <input
          type="checkbox"
          name="isShared"
          defaultChecked={list ? list.isShared : false}
          key={`${kind}-${list?.isShared}`}
        />{' '}
        {t('sharedLabel')}
      </label>
      {state.error ? (
        <p className="banner banner--error" role="alert">
          {state.error}
        </p>
      ) : state.message ? (
        <p className="banner banner--ok" role="status">
          {state.message}
        </p>
      ) : null}
      <div>
        <button className="btn btn--primary" type="submit" disabled={pending}>
          {list ? t('save') : t('create')}
        </button>
      </div>
    </form>
  );
}
