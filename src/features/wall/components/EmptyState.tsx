// Shown when no notes are approved yet. One honest placeholder — no seeded
// fake notes (empty is honest; fake is worse than empty).
export default function EmptyState() {
  return (
    <div class="wall-empty">
      <div class="wall-empty__note">
        <span class="wall-empty__text">be the first</span>
      </div>
    </div>
  );
}
