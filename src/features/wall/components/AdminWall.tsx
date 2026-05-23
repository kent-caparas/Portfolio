import { useEffect, useState } from 'preact/hooks';

type Tab = 'pending' | 'approved' | 'rejected';

interface AdminNote {
  id: string;
  name: string;
  topic: string;
  body: string;
  createdAt: string;
  reason?: string;
  confidence?: number;
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'pending', label: 'pending' },
  { key: 'approved', label: 'approved' },
  { key: 'rejected', label: 'rejected' },
];

async function adminAction(action: string, id: string): Promise<boolean> {
  const res = await fetch(`/api/wall/admin?action=${action}&id=${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
  });
  const data = await res.json().catch(() => ({}));
  return res.ok && data.ok;
}

export default function AdminWall() {
  const [tab, setTab] = useState<Tab>('pending');
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load(which: Tab) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/wall/admin?action=list-${which}`, {
        headers: { 'content-type': 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setNotes(data.notes as AdminNote[]);
      } else {
        setError(data.error ?? 'Failed to load.');
      }
    } catch {
      setError('Failed to load.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function run(action: string, id: string) {
    setBusyId(id);
    const ok = await adminAction(action, id);
    setBusyId(null);
    if (ok) {
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } else {
      setError('Action failed.');
    }
  }

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST', headers: { 'content-type': 'application/json' } });
    window.location.href = '/admin';
  }

  return (
    <div class="admin-wall">
      <div class="admin-bar">
        <div class="admin-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              class={`admin-tab${tab === t.key ? ' is-active' : ''}`}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button class="admin-logout" onClick={logout}>
          log out
        </button>
      </div>

      {error && (
        <div class="wall-status" data-kind="error" role="status">
          {error}
        </div>
      )}

      {loading ? (
        <p class="admin-empty">loading…</p>
      ) : notes.length === 0 ? (
        <p class="admin-empty">nothing in {tab}.</p>
      ) : (
        <ul class="admin-list">
          {notes.map((note) => (
            <li class="admin-row" key={note.id}>
              <div class="admin-row__meta">
                <span class="admin-row__name">{note.name || 'anon'}</span>
                <span class="admin-row__topic">{note.topic}</span>
                <span class="admin-row__id">{note.id}</span>
              </div>
              <p class="admin-row__body">{note.body}</p>
              {note.reason && (
                <p class="admin-row__reason">
                  moderator: {note.reason}
                  {typeof note.confidence === 'number' ? ` (${note.confidence.toFixed(2)})` : ''}
                </p>
              )}
              <div class="admin-row__actions">
                {tab === 'pending' && (
                  <>
                    <button class="admin-act" disabled={busyId === note.id} onClick={() => run('approve', note.id)}>
                      approve
                    </button>
                    <button class="admin-act" disabled={busyId === note.id} onClick={() => run('reject', note.id)}>
                      reject
                    </button>
                  </>
                )}
                {tab === 'rejected' && (
                  <button class="admin-act" disabled={busyId === note.id} onClick={() => run('approve', note.id)}>
                    restore
                  </button>
                )}
                <button
                  class="admin-act admin-act--danger"
                  disabled={busyId === note.id}
                  onClick={() => run('delete', note.id)}
                >
                  delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
