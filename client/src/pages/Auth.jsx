import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Eye, EyeOff, Wrench, XCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import api, { errMsg } from "../lib/api";
import { Button, Card, Field, Input, Spinner } from "../components/ui";
import ThemeToggle from "../components/ThemeToggle";
import { cx } from "../lib/utils";

const HOME = { user: "/dashboard", worker: "/worker", admin: "/admin" };

function Shell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <div className="w-full max-w-md animate-rise">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2.5">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/40"><Wrench size={22} /></span>
          <span className="text-xl font-extrabold">Skilled<span className="gradient-text">Workers</span></span>
        </Link>
        <Card className="!p-7">
          <h1 className="text-2xl font-extrabold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </Card>
        {footer && <p className="mt-5 text-center text-sm text-slate-600 dark:text-slate-300">{footer}</p>}
      </div>
    </div>
  );
}
const PasswordInput = (p) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...p} type={show ? "text" : "password"} className="pr-11" />
      <button type="button" onClick={() => setShow(!show)} aria-label="Toggle password visibility" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
    </div>
  );
};

export function Login() {
  const { login } = useAuth(); const nav = useNavigate(); const loc = useLocation(); const toast = useToast();
  const [f, setF] = useState({ email: "", password: "" }); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const u = await login(f.email, f.password); nav(loc.state?.from || HOME[u.type], { replace: true }); }
    catch (err) { toast(err.response ? errMsg(err) : err.message, "error"); }
    finally { setBusy(false); }
  };
  return (
    <Shell title="Welcome back" subtitle="Log in to manage your jobs" footer={<>New here? <Link className="font-semibold text-indigo-500" to="/register">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email"><Input type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="you@example.com" /></Field>
        <Field label="Password"><PasswordInput required autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="••••••••" /></Field>
        <div className="text-right"><Link to="/forgot-password" className="text-xs font-semibold text-indigo-500">Forgot password?</Link></div>
        <Button className="w-full" loading={busy}>Log in</Button>
      </form>
    </Shell>
  );
}

export function Register() {
  const nav = useNavigate(); const toast = useToast(); const [sp] = useSearchParams();
  const [f, setF] = useState({ name: "", email: "", password: "", type: sp.get("role") === "worker" ? "worker" : "user", referralCode: sp.get("ref") || "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const body = { ...f }; if (!body.referralCode) delete body.referralCode;
      const { data } = await api.post("/auth/register", body);
      if (!data.success) return toast(data.message, "error");
      toast("Account created! Please log in."); nav("/login");
    } catch (err) { toast(errMsg(err), "error"); } finally { setBusy(false); }
  };
  const roles = [["user", "I need work done"], ["worker", "I am a skilled worker"]];
  return (
    <Shell title="Create your account" subtitle="Join in under a minute" footer={<>Already registered? <Link className="font-semibold text-indigo-500" to="/login">Log in</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2">{roles.map(([v, l]) => (
          <button type="button" key={v} onClick={() => setF({ ...f, type: v })}
            className={cx("rounded-xl border px-3 py-3 text-sm font-semibold transition", f.type === v ? "border-indigo-400 bg-indigo-500/15 text-indigo-600 dark:text-indigo-300" : "border-slate-300/60 dark:border-white/10")}>{l}</button>))}</div>
        <Field label="Full name"><Input required minLength={2} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Email"><Input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Password" hint="At least 8 characters with a letter and a number"><PasswordInput required minLength={8} autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <Field label="Referral code (optional)"><Input value={f.referralCode} onChange={(e) => setF({ ...f, referralCode: e.target.value.toUpperCase() })} maxLength={20} /></Field>
        <Button className="w-full" loading={busy}>Create account</Button>
      </form>
    </Shell>
  );
}

export function ForgotPassword() {
  const toast = useToast(); const [email, setEmail] = useState(""); const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.post("/auth/forgot-password", { email }); setSent(true); } catch (err) { toast(errMsg(err), "error"); } finally { setBusy(false); }
  };
  return (
    <Shell title="Reset password" subtitle="We will email you a reset link" footer={<Link className="font-semibold text-indigo-500" to="/login">Back to login</Link>}>
      {sent ? <p className="rounded-xl bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">If that email exists, a reset link is on its way. Check your inbox.</p> : (
        <form onSubmit={submit} className="space-y-4"><Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field><Button className="w-full" loading={busy}>Send reset link</Button></form>)}
    </Shell>
  );
}

export function ResetPassword() {
  const [sp] = useSearchParams(); const nav = useNavigate(); const toast = useToast();
  const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.post("/auth/reset-password", { token: sp.get("token") || "", password }); toast("Password updated. Please log in."); nav("/login"); }
    catch (err) { toast(errMsg(err), "error"); } finally { setBusy(false); }
  };
  return (
    <Shell title="Choose a new password" footer={<Link className="font-semibold text-indigo-500" to="/login">Back to login</Link>}>
      <form onSubmit={submit} className="space-y-4"><Field label="New password" hint="At least 8 characters with a letter and a number"><PasswordInput required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></Field><Button className="w-full" loading={busy}>Update password</Button></form>
    </Shell>
  );
}

export function VerifyEmail() {
  const [sp] = useSearchParams(); const [state, setState] = useState({ loading: true, ok: false, msg: "" });
  useEffect(() => {
    api.post("/auth/verify-email", { token: sp.get("token") || "" })
      .then(() => setState({ loading: false, ok: true, msg: "Your email is verified." }))
      .catch((e) => setState({ loading: false, ok: false, msg: errMsg(e) }));
  }, [sp]);
  return (
    <Shell title="Email verification" footer={<Link className="font-semibold text-indigo-500" to="/login">Continue to login</Link>}>
      {state.loading ? <Spinner /> : (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          {state.ok ? <CheckCircle2 size={48} className="text-emerald-500" /> : <XCircle size={48} className="text-rose-500" />}
          <p className="font-semibold">{state.msg}</p>
        </div>)}
    </Shell>
  );
}
