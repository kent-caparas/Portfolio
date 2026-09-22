// a pushpin head seen from above, the needle is through the paper
export default function NotePin() {
  return (
    <svg class="note-pin" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <circle class="note-pin__head" cx="10" cy="10" r="7.5" />
      <circle class="note-pin__ring" cx="10" cy="10" r="3.8" />
      <ellipse class="note-pin__shine" cx="7.4" cy="6.9" rx="1.9" ry="1.2" transform="rotate(-35 7.4 6.9)" />
    </svg>
  );
}
