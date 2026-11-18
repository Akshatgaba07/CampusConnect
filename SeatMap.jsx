// Seats are drawn by row letter. State always comes from the server; the UI only adds the local "selected" highlight.
export default function SeatMap({ seats, selected, onToggle, disabled }) {
  const rows = seats.reduce((m, s) => { const r = s.label[0]; (m[r] ||= []).push(s); return m; }, {});
  const style = (s) => {
    if (selected.includes(s.id)) return 'bg-brand text-white border-brand';
    if (s.status === 'BOOKED') return 'bg-ink-200 text-ink-400 border-ink-200 cursor-not-allowed';
    if (s.status === 'HELD') return 'bg-warn-soft text-warn border-warn/30 cursor-not-allowed';
    return 'bg-white text-ink-900 border-ink-200 hover:border-ink-900';
  };
  return (
    <div>
      <div className="mx-auto mb-5 h-2 w-3/4 rounded-full bg-ink-900" aria-hidden />
      <div className="mb-4 text-center text-xs text-ink-400">Stage / front</div>
      <div className="space-y-1.5 overflow-x-auto pb-2">
        {Object.entries(rows).map(([r, list]) => (
          <div key={r} className="flex items-center justify-center gap-1.5">
            <span className="w-5 text-xs text-ink-400">{r}</span>
            {list.map((s) => (
              <button key={s.id} type="button" disabled={disabled || (s.status !== 'AVAILABLE' && !selected.includes(s.id))} onClick={() => onToggle(s)}
                aria-label={`Seat ${s.label}, ${s.status.toLowerCase()}`} aria-pressed={selected.includes(s.id)}
                className={`h-8 w-8 shrink-0 rounded-md border text-[11px] font-semibold ${style(s)}`}>{s.label.slice(1)}</button>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-ink-600">
        {[['bg-white border-ink-200', 'Free'], ['bg-brand border-brand', 'Yours'], ['bg-warn-soft border-warn/30', 'Held by someone'], ['bg-ink-200 border-ink-200', 'Booked']].map(([c, l]) => <span key={l} className="flex items-center gap-1.5"><i className={`h-3.5 w-3.5 rounded border ${c}`} />{l}</span>)}
      </div>
    </div>
  );
}
