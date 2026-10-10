import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, MapPin, MessageSquare, ShieldCheck, Star, Wallet, Wrench, Zap } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";
import { Button, Card } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useFetch } from "../lib/hooks";
import api from "../lib/api";

const FEATURES = [
  [BadgeCheck, "Verified professionals", "Workers upload ID that our team reviews. Look for the verified badge."],
  [Wallet, "Compare quotes", "Get several fixed-price quotes and pick the one that fits your budget."],
  [Star, "Real ratings", "Only customers who completed a job can review, so scores are honest."],
  [MessageSquare, "Chat in the app", "Share details and photos with your worker without giving out your number."],
  [MapPin, "Near you", "Search by city or use your location to find help within minutes."],
  [ShieldCheck, "Protected payments", "Pay online or in cash, get an invoice, and raise a dispute if needed."],
];
const STEPS = [["1", "Describe the problem", "Add photos, pick a category and a time."], ["2", "Get matched", "Workers accept or send you quotes."], ["3", "Get it fixed", "Track progress, chat, pay and leave a review."]];

export default function Landing() {
  const { user } = useAuth();
  const cats = useFetch(() => api.get("/categories"), []);
  const home = user ? ({ user: "/dashboard", worker: "/worker", admin: "/admin" })[user.type] : "/register";
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <header className="glass sticky top-3 z-30 mt-3 flex items-center justify-between rounded-2xl px-4 py-3">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white"><Wrench size={18} /></span>
          <span className="text-lg font-extrabold">Skilled<span className="gradient-text">Workers</span></span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? <Link to={home}><Button size="sm">Open app</Button></Link> : (<>
            <Link to="/login" className="hidden sm:block"><Button variant="ghost" size="sm">Log in</Button></Link>
            <Link to="/register"><Button size="sm">Get started</Button></Link></>)}
        </div>
      </header>

      <section className="grid items-center gap-10 py-16 lg:grid-cols-2 lg:py-24">
        <div className="animate-rise">
          <span className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold"><Zap size={14} className="text-amber-500" /> Urgent jobs get picked up fast</span>
          <h1 className="mt-5 text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">Trusted help for <span className="gradient-text">every home job</span></h1>
          <p className="mt-5 max-w-xl text-lg text-slate-600 dark:text-slate-300">Plumbers, electricians, carpenters and more. Post a problem, compare quotes from verified workers, and pay safely when the job is done.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={home}><Button size="lg">Post a problem <ArrowRight size={18} /></Button></Link>
            <Link to="/register?role=worker"><Button size="lg" variant="ghost">Earn as a worker</Button></Link>
          </div>
          <div className="mt-8 flex items-center gap-6 text-sm text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5"><Star size={16} className="fill-amber-400 text-amber-400" /> Honest reviews</span>
            <span className="flex items-center gap-1.5"><ShieldCheck size={16} className="text-emerald-500" /> ID-verified</span>
          </div>
        </div>
        <div className="relative animate-rise [animation-delay:150ms]">
          <Card className="space-y-4 !p-6">
            <div className="flex items-center justify-between"><p className="font-bold">Leaking kitchen tap</p><span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-300">Urgent</span></div>
            {[["Ravi Kumar", "₹450", "4.9"], ["Imran Sheikh", "₹520", "4.7"], ["Suresh P.", "₹600", "4.8"]].map(([n, p, r], i) => (
              <div key={n} className="glass flex items-center justify-between rounded-2xl p-3">
                <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 font-bold text-white">{n[0]}</div>
                  <div><p className="flex items-center gap-1 text-sm font-semibold">{n} <BadgeCheck size={14} className="text-sky-500" /></p><p className="flex items-center gap-1 text-xs text-slate-500"><Star size={12} className="fill-amber-400 text-amber-400" />{r}</p></div></div>
                <div className="text-right"><p className="font-extrabold">{p}</p>{i === 0 && <p className="text-[10px] font-semibold text-emerald-500">Best price</p>}</div>
              </div>))}
          </Card>
          <div className="absolute -bottom-5 -left-3 hidden animate-blob rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-sm font-bold text-white shadow-xl sm:block">Job completed ✓</div>
        </div>
      </section>

      {cats.data?.categories?.length > 0 && (
        <section className="flex flex-wrap justify-center gap-2.5 pb-14">
          {cats.data.categories.map((c) => <span key={c.name} className="glass rounded-full px-4 py-2 text-sm font-semibold">{c.name}</span>)}
        </section>)}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(([Icon, t, d]) => (
          <Card key={t} className="transition hover:-translate-y-1"><div className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-indigo-500/10 text-indigo-500"><Icon size={22} /></div>
            <h3 className="font-bold">{t}</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{d}</p></Card>))}
      </section>

      <section className="py-20">
        <h2 className="mb-10 text-center text-3xl font-extrabold">How it <span className="gradient-text">works</span></h2>
        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map(([n, t, d]) => (
            <Card key={n} className="text-center"><div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-lg font-black text-white">{n}</div>
              <h3 className="font-bold">{t}</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{d}</p></Card>))}
        </div>
      </section>

      <Card className="text-center !py-12">
        <h2 className="text-3xl font-extrabold">Ready to get it fixed?</h2>
        <p className="mx-auto mt-2 max-w-md text-slate-600 dark:text-slate-300">Join as a customer or a skilled worker. It takes a minute.</p>
        <Link to="/register"><Button size="lg" className="mt-6">Create free account</Button></Link>
      </Card>
      <p className="mt-10 text-center text-xs text-slate-500">© {new Date().getFullYear()} Skilled Workers</p>
    </div>
  );
}
