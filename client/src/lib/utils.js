export const cx = (...a) => a.filter(Boolean).join(" ");
export const money = (n) => (n == null ? "—" : "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 }));
export const fmtDate = (d, withTime = false) =>
  !d ? "—" : new Date(d).toLocaleString("en-IN", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
export const timeAgo = (d) => {
  const s = Math.max(1, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  const u = [["y", 31536000], ["mo", 2592000], ["d", 86400], ["h", 3600], ["m", 60]];
  for (const [l, v] of u) if (s >= v) return `${Math.floor(s / v)}${l} ago`;
  return "just now";
};
export const STATUSES = ["pending", "assigned", "in-progress", "completed", "cancelled", "disputed"];
export const statusLabel = (s) => ({ "in-progress": "In progress" }[s] || (s ? s[0].toUpperCase() + s.slice(1) : ""));
export const toLocalInput = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const getPosition = () =>
  new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error("Location is not supported on this device"));
    navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => rej(new Error("Location permission denied")), { timeout: 10000 });
  });
