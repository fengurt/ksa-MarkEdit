import { useState } from 'react';
import {
  confirmRecoveryPackage,
  downloadRecoveryPackage,
  type RecoveryChallenge,
  type RecoveryPackageV2,
} from './VaultRecovery';

export function VaultRecoveryDialog({
  workspaceId,
  deviceToken,
  recoveryPackage,
  challenge,
  onClose,
  onConfigured,
}: {
  workspaceId: string;
  deviceToken: string;
  recoveryPackage: RecoveryPackageV2;
  challenge: RecoveryChallenge[];
  onClose: () => void;
  onConfigured: () => void;
}) {
  const [downloaded, setDownloaded] = useState(false);
  const [answers, setAnswers] = useState<string[]>(Array(4).fill(''));
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="manager-dialog recovery-dialog" role="dialog" aria-modal="true" aria-labelledby="recovery-title">
        <header>
          <div>
            <p className="eyebrow">Zero-knowledge recovery</p>
            <h2 id="recovery-title">Save your 24-word recovery package</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">×</button>
        </header>
        <p>This package contains the only offline recovery path for your encrypted Vault. It is never uploaded.</p>
        <button className="primary-button" type="button" onClick={() => {
          downloadRecoveryPackage(recoveryPackage);
          setDownloaded(true);
        }}>
          Download recovery package
        </button>
        <div className="recovery-challenge">
          {challenge.map((item, index) => (
            <label key={item.position}>
              Word {item.position}
              <input
                autoComplete="off"
                value={answers[index]}
                onChange={event => setAnswers(current => current.map((value, answerIndex) => (
                  answerIndex === index ? event.target.value : value
                )))}
              />
            </label>
          ))}
        </div>
        {error && <p className="inline-notice" role="alert">{error}</p>}
        <footer>
          <button type="button" onClick={onClose}>Cancel</button>
          <button
            className="primary-button"
            type="button"
            disabled={!downloaded || saving || answers.some(answer => !answer.trim())}
            onClick={async () => {
              setSaving(true);
              setError(undefined);
              try {
                await confirmRecoveryPackage({
                  workspaceId,
                  vaultId: recoveryPackage.vaultId,
                  deviceToken,
                  recoveryPackage,
                  challenge,
                  answers,
                });
                onConfigured();
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : String(caught));
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? 'Verifying…' : 'Verify and enable sync'}
          </button>
        </footer>
      </section>
    </div>
  );
}
