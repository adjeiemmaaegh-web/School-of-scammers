import { useState } from 'react';

export function CopyField({
  label,
  value,
  textarea = false,
}: {
  label: string;
  value: string;
  textarea?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Fallback: select the text so the viewer can copy manually.
      const el = document.getElementById(`copy-${label}`) as HTMLInputElement | HTMLTextAreaElement | null;
      el?.focus();
      el?.select();
    }
  };

  return (
    <div className="copy-field">
      <div className="copy-row">
        <span className="copy-label">{label}</span>
        <button className="btn ghost small" onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button>
      </div>
      {textarea ? (
        <textarea id={`copy-${label}`} className="code-input" readOnly value={value} rows={2} onFocus={(e) => e.currentTarget.select()} />
      ) : (
        <input id={`copy-${label}`} className="code-input" readOnly value={value} onFocus={(e) => e.currentTarget.select()} />
      )}
    </div>
  );
}
