const tz = 'Asia/Kolkata';
export const fmtDate = (d) => new Intl.DateTimeFormat('en-IN', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(d));
export const fmtTime = (d) => new Intl.DateTimeFormat('en-IN', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date(d));
export const fmtFull = (d) => `${fmtDate(d)}, ${fmtTime(d)}`;
export const toLocalInput = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
