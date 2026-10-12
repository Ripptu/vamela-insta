// Berliner Ortszeit ohne Zusatzpaket.
export function berlin(d = new Date()) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false })
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]))
  const wd = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 }[p.weekday]
  return { datum: `${p.year}-${p.month}-${p.day}`, stunde: +p.hour % 24, minute: +p.minute, wochentag: wd, minutenSeitMitternacht: (+p.hour % 24) * 60 + +p.minute }
}
export const inFenster = (d, uhrzeit, fensterMin) => {
  const b = berlin(d)
  const [h, m] = uhrzeit.split(':').map(Number)
  const s = h * 60 + m
  return b.minutenSeitMitternacht >= s && b.minutenSeitMitternacht < s + fensterMin
}
