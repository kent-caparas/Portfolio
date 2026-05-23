import { useState } from 'preact/hooks';

export default function AdminLogin() {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: Event) {
    event.preventDefault();
    if (!token || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        window.location.href = '/admin/wall';
        return;
      }
      setError(data.error ?? 'Login failed.');
    } catch {
      setError('Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form class="wall-form admin-login" onSubmit={handleSubmit} novalidate>
      <label class="wall-form__field">
        <span class="wall-form__label">admin token</span>
        <input
          type="password"
          value={token}
          autoComplete="off"
          placeholder="paste WALL_ADMIN_TOKEN"
          onInput={(e) => setToken((e.currentTarget as HTMLInputElement).value)}
        />
      </label>
      <div class="wall-form__foot" style={{ justifyContent: 'flex-end' }}>
        <button class="wall-btn" type="submit" disabled={!token || busy}>
          {busy ? 'checking…' : 'enter'}
        </button>
      </div>
      {error && (
        <div class="wall-status" data-kind="error" role="status">
          {error}
        </div>
      )}
    </form>
  );
}
