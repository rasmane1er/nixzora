'use client';

import { type ShoppingListSummary } from '@nixzora/validation';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useT } from '@/components/I18nProvider';
import { createListWith, listsFor, toggleListItem } from '../../account/lists/actions';

/** "Add to list" (p10-08): tick the lists this product belongs on, or start a new one. */
export function AddToList({ productId, slug }: { productId: string; slug: string }) {
  const t = useT('lists');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<ShoppingListSummary[] | null>(null);
  const [on, setOn] = useState<Set<string>>(new Set());
  const [name, setName] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, start] = useTransition();

  function toggleOpen() {
    if (open) return setOpen(false);
    start(async () => {
      const picker = await listsFor(productId);
      if (picker.signIn) {
        router.push(`/account/login?next=/p/${slug}`);
        return;
      }
      setLists(picker.lists);
      setOn(new Set(picker.containing));
      setMessage(null);
      setOpen(true);
    });
  }

  function toggle(list: ShoppingListSummary) {
    const next = !on.has(list.id);
    start(async () => {
      const result = await toggleListItem(list.id, productId, next);
      if (!result.ok) return setMessage({ kind: 'error', text: result.error });
      setOn((current) => {
        const copy = new Set(current);
        if (next) copy.add(list.id);
        else copy.delete(list.id);
        return copy;
      });
      setMessage({
        kind: 'ok',
        text: t(next ? 'addedTo' : 'removedFrom', { name: list.name }),
      });
    });
  }

  function create(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    start(async () => {
      const result = await createListWith(name, productId);
      if (!result.ok) return setMessage({ kind: 'error', text: result.error });
      setLists((current) => [result.list, ...(current ?? [])]);
      setOn((current) => new Set(current).add(result.list.id));
      setName('');
      setMessage({ kind: 'ok', text: t('addedTo', { name: result.list.name }) });
    });
  }

  const count = on.size;
  return (
    <div className="add-to-list">
      <button
        type="button"
        className="wish"
        aria-expanded={open}
        aria-controls="add-to-list-panel"
        disabled={pending && !open}
        onClick={toggleOpen}
      >
        {count === 1 && lists
          ? t('onList', { name: lists.find((l) => on.has(l.id))?.name ?? '' })
          : t('addToList')}
      </button>
      {open && lists ? (
        <div className="add-to-list__panel card" id="add-to-list-panel">
          <strong>{t('addTo')}</strong>
          {lists.length ? (
            <ul>
              {lists.map((list) => (
                <li key={list.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={on.has(list.id)}
                      disabled={pending}
                      onChange={() => toggle(list)}
                    />
                    <span>{list.name}</span>
                    <span className="muted">{t(`kind_${list.kind}`)}</span>
                  </label>
                </li>
              ))}
            </ul>
          ) : null}
          <form onSubmit={create} className="add-to-list__new">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('newList')}
              aria-label={t('name')}
              maxLength={60}
            />
            <button className="btn btn--secondary" type="submit" disabled={pending || !name.trim()}>
              {t('newListNamed')}
            </button>
          </form>
          {message ? (
            <p
              className={`banner banner--${message.kind === 'ok' ? 'ok' : 'error'}`}
              role={message.kind === 'ok' ? 'status' : 'alert'}
            >
              {message.text}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
