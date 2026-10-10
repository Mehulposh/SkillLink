import { useRef, useState } from "react";
import { Camera, Copy, Gift } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useTheme } from "../context/ThemeContext";
import api, { errMsg } from "../lib/api";
import { Avatar, Button, Card, Field, Input, PageHeader, Select, Switch } from "../components/ui";

export default function Settings() {
  const { user, refresh } = useAuth(); const toast = useToast(); const { theme, toggle } = useTheme();
  const [f, setF] = useState({ name: user.name, language: user.language || "en", smsOptIn: !!user.smsOptIn });
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [busy, setBusy] = useState("");
  const fileRef = useRef();

  const run = async (key, fn, ok) => { setBusy(key); try { await fn(); toast(ok); await refresh(); } catch (e) { toast(errMsg(e), "error"); } finally { setBusy(""); } };
  const upload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const fd = new FormData(); fd.append("avatar", file);
    run("avatar", () => api.post("/auth/avatar", fd), "Photo updated");
  };
  const link = `${window.location.origin}/register?ref=${user.referralCode}`;

  return (
    <>
      <PageHeader title="Settings" subtitle="Your profile, preferences and security" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="relative"><Avatar user={user} size={72} />
              <button onClick={() => fileRef.current.click()} aria-label="Change photo" className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-indigo-500 text-white shadow-lg"><Camera size={15} /></button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={upload} /></div>
            <div><p className="text-lg font-bold">{user.name}</p><p className="text-sm text-slate-500">{user.email}</p>
              <p className="text-xs font-semibold capitalize text-indigo-500">{user.type}{user.emailVerified ? " · email verified" : ""}</p></div>
          </div>
          {!user.emailVerified && <Button variant="soft" size="sm" loading={busy === "ver"} onClick={() => run("ver", () => api.post("/auth/resend-verification"), "Verification email sent")}>Resend verification email</Button>}
          <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Notification language"><Select value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })}><option value="en">English</option><option value="hi">हिन्दी (Hindi)</option></Select></Field>
          <Switch checked={f.smsOptIn} onChange={(v) => setF({ ...f, smsOptIn: v })} label="Send me SMS for urgent updates" />
          <Switch checked={theme === "dark"} onChange={toggle} label="Dark theme" />
          <Button loading={busy === "save"} onClick={() => run("save", () => api.patch("/auth/settings", f), "Settings saved")}>Save changes</Button>
        </Card>

        <div className="space-y-5">
          <Card className="space-y-4">
            <h3 className="font-bold">Change password</h3>
            <Field label="Current password"><Input type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
            <Field label="New password" hint="8+ characters, with a letter and a number"><Input type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
            <Button variant="soft" loading={busy === "pw"} onClick={() => run("pw", async () => { await api.post("/auth/change-password", pw); setPw({ currentPassword: "", newPassword: "" }); }, "Password changed")}>Update password</Button>
          </Card>
          {user.referralCode && (
            <Card className="space-y-3 bg-gradient-to-br from-fuchsia-500/10 to-amber-400/10">
              <h3 className="flex items-center gap-2 font-bold"><Gift size={18} className="text-fuchsia-500" /> Invite and earn</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">When a friend you invite pays for their first job, you receive a promo code.</p>
              <div className="flex items-center gap-2"><code className="glass flex-1 truncate rounded-xl px-3 py-2 text-sm font-bold tracking-widest">{user.referralCode}</code>
                <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(link); toast("Invite link copied"); }}><Copy size={14} /> Copy link</Button></div>
            </Card>)}
        </div>
      </div>
    </>
  );
}
