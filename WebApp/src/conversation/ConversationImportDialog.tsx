import { useMemo, useState } from 'react';
import { t } from '../i18n';
import type { ConversationImportDecision, ConversationImportPlan } from './types';

export function ConversationImportDialog({
  plan,
  onClose,
  onApply,
}: {
  plan: ConversationImportPlan;
  onClose: () => void;
  onApply: (decisions: ConversationImportDecision[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState(() => new Set(
    plan.items.filter(item => item.action === 'create' || item.action === 'update').map(item => item.id),
  ));
  const [saving, setSaving] = useState(false);
  const [edits, setEdits] = useState<Record<string, { title: string; category: string; tags: string }>>(
    () => Object.fromEntries(plan.items.map(item => [item.id, {
      title: item.conversation.title,
      category: `Conversations/${providerName(item.conversation.provider)}`,
      tags: `conversation, ${item.conversation.provider}`,
    }])),
  );
  const summary = useMemo(() => ({
    create: plan.items.filter(item => item.action === 'create').length,
    update: plan.items.filter(item => item.action === 'update').length,
    skip: plan.items.filter(item => item.action === 'skip').length,
    review: plan.items.filter(item => item.action === 'review').length,
  }), [plan]);

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="taxonomy-dialog conversation-import-dialog" role="dialog" aria-modal="true" aria-labelledby="conversation-import-title">
        <header>
          <div>
            <p className="eyebrow">{t('conversationInbox')}</p>
            <h2 id="conversation-import-title">{t('conversationImportPreview')}</h2>
          </div>
          <button className="icon-button" type="button" aria-label={t('cancel')} onClick={onClose}>×</button>
        </header>
        <div className="conversation-import-summary">
          <span>＋{summary.create} {t('conversationNew')}</span>
          <span>↑{summary.update} {t('conversationUpdates')}</span>
          <span>＝{summary.skip} {t('conversationDuplicates')}</span>
          <span>! {summary.review} {t('needsReview')}</span>
        </div>
        {plan.failures.length > 0 && (
          <div className="conversation-import-failures" role="alert">
            {plan.failures.map(failure => <p key={`${failure.sourceName}:${failure.reason}`}><b>{failure.sourceName}</b> · {failure.reason}</p>)}
          </div>
        )}
        <div className="conversation-import-list">
          {plan.items.map(item => (
            <label key={item.id} className={`conversation-import-item action-${item.action}`}>
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                disabled={item.action === 'skip'}
                onChange={event => setSelected(current => {
                  const next = new Set(current);
                  if (event.target.checked) next.add(item.id);
                  else next.delete(item.id);
                  return next;
                })}
              />
              <span>
                <input
                  aria-label={t('title')}
                  value={edits[item.id]?.title ?? item.conversation.title}
                  onChange={event => setEdits(current => ({
                    ...current,
                    [item.id]: { ...current[item.id], title: event.target.value },
                  }))}
                />
                <small>{item.conversation.provider} · {item.conversation.messages.length} {t('conversationMessages')}</small>
                <small>{item.reason}</small>
                <span className="conversation-metadata-fields">
                  <input
                    aria-label={t('category')}
                    value={edits[item.id]?.category ?? ''}
                    onChange={event => setEdits(current => ({
                      ...current,
                      [item.id]: { ...current[item.id], category: event.target.value },
                    }))}
                  />
                  <input
                    aria-label={t('tags')}
                    value={edits[item.id]?.tags ?? ''}
                    onChange={event => setEdits(current => ({
                      ...current,
                      [item.id]: { ...current[item.id], tags: event.target.value },
                    }))}
                  />
                </span>
                <code>{item.proposedPath}</code>
              </span>
              <b>{actionLabel(item.action)}</b>
            </label>
          ))}
        </div>
        <footer>
          <button type="button" onClick={onClose}>{t('cancel')}</button>
          <button
            className="primary-button"
            type="button"
            disabled={saving || selected.size === 0}
            onClick={() => {
              setSaving(true);
              const decisions = plan.items.map(item => {
                const edit = edits[item.id];
                return {
                  itemId: item.id,
                  action: selected.has(item.id)
                    ? item.action === 'review' ? 'keep-both' as const : 'apply' as const
                    : 'skip' as const,
                  title: edit?.title,
                  category: edit?.category,
                  tags: edit?.tags.split(',').map(tag => tag.trim()).filter(Boolean),
                };
              });
              void onApply(decisions).finally(() => setSaving(false));
            }}
          >
            {saving ? '…' : t('conversationApply')}
          </button>
        </footer>
      </section>
    </div>
  );
}

function providerName(provider: ConversationImportPlan['items'][number]['conversation']['provider']): string {
  if (provider === 'chatgpt') return 'ChatGPT';
  if (provider === 'claude') return 'Claude';
  return 'Imported';
}

function actionLabel(action: ConversationImportPlan['items'][number]['action']): string {
  if (action === 'create') return t('conversationAction_create');
  if (action === 'update') return t('conversationAction_update');
  if (action === 'skip') return t('conversationAction_skip');
  return t('conversationAction_review');
}
