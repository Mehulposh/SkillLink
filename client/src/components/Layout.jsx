import { useState } from "react";
import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import { Bell, Briefcase, ClipboardList, Gift, LayoutDashboard, LogOut, Menu, PlusCircle, Scale, Search, Settings, ShieldCheck, Users, Wallet, Wrench, X, UserCog, Tag, UserCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";
import { useFetch, useInterval } from "../lib/hooks";
import { Avatar } from "./ui";
import ThemeToggle from "./ThemeToggle";
import { cx } from "../lib/utils";

const NAV = {
  user: [
    ["/dashboard", "Dashboard", LayoutDashboard], ["/new", "New request", PlusCircle], ["/requests", "My requests", ClipboardList],
    ["/workers", "Find workers", Search],
  ],
  worker: [
    ["/worker", "Dashboard", LayoutDashboard], ["/worker/open", "Open jobs", Search], ["/worker/jobs", "My jobs", Briefcase],
    ["/worker/earnings", "Earnings", Wallet], ["/worker/profile", "My profile", UserCircle],
  ],
  admin: [
    ["/admin", "Overview", LayoutDashboard], ["/admin/users", "Users", Users], ["/admin/jobs", "All jobs", ClipboardList],
    ["/admin/verifications", "Verifications", ShieldCheck], ["/admin/disputes", "Disputes", Scale], ["/admin/catalog", "Promos & more", Tag],
  ],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const count = useFetch(() => api.get("/notifications/unread-count"), []);
  useInterval(() => count.reload(true), 30000);
  const items = NAV[user.type] || NAV.user;

  const Links = () => (
    <nav className="space-y-1">
      {items.map(([to, label, Icon]) => (
        <NavLink key={to} to={to} end onClick={() => setOpen(false)}
          className={({ isActive }) => cx("flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition",
            isActive ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/30" : "text-slate-600 hover:bg-slate-500/10 dark:text-slate-300")}>
          <Icon size={18} /> {label}
        </NavLink>))}
    </nav>
  );
  const Brand = () => (
    <Link to="/" className="flex items-center gap-2.5 px-2">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/40"><Wrench size={20} /></span>
      <span className="text-lg font-extrabold tracking-tight">Skilled<span className="gradient-text">Workers</span></span>
    </Link>
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-[1500px] gap-5 p-3 sm:p-5">
      <aside className="glass sticky top-5 hidden h-[calc(100vh-2.5rem)] w-64 shrink-0 flex-col rounded-3xl p-4 lg:flex">
        <Brand />
        <div className="mt-8 flex-1 overflow-y-auto"><Links /></div>
        {user.referralCode && user.type === "user" && (
          <Link to="/settings" className="mb-3 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400/20 to-fuchsia-400/20 p-3 text-xs font-semibold"><Gift size={16} className="text-fuchsia-500" /> Invite friends, earn ₹ off</Link>)}
        <button onClick={async () => { await logout(); nav("/"); }} className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-500/10 dark:text-rose-300"><LogOut size={18} /> Log out</button>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <aside onClick={(e) => e.stopPropagation()} className="glass-strong animate-rise absolute left-3 top-3 bottom-3 w-72 overflow-y-auto rounded-3xl p-4">
            <div className="mb-6 flex items-center justify-between"><Brand /><button onClick={() => setOpen(false)} aria-label="Close menu"><X size={20} /></button></div>
            <Links />
            <button onClick={async () => { await logout(); nav("/"); }} className="mt-4 flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-rose-600"><LogOut size={18} /> Log out</button>
          </aside>
        </div>)}

      <div className="min-w-0 flex-1">
        <header className="glass sticky top-3 z-30 mb-5 flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 sm:top-5 sm:px-4">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="grid h-10 w-10 place-items-center rounded-xl hover:bg-slate-500/10 lg:hidden"><Menu size={20} /></button>
          <p className="hidden text-sm text-slate-500 dark:text-slate-400 sm:block">Welcome back, <b className="text-slate-800 dark:text-white">{user.name.split(" ")[0]}</b> 👋</p>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link to="/notifications" aria-label="Notifications" className="glass relative grid h-10 w-10 place-items-center rounded-xl transition hover:scale-105">
              <Bell size={18} />
              {count.data?.unread > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{count.data.unread > 9 ? "9+" : count.data.unread}</span>}
            </Link>
            <Link to="/settings" className="glass flex items-center gap-2 rounded-xl py-1 pl-1 pr-3 transition hover:scale-[1.02]">
              <Avatar user={user} size={32} /><span className="hidden text-sm font-semibold sm:block">{user.name.split(" ")[0]}</span>
              {user.type === "admin" && <UserCog size={14} className="text-indigo-500" />}
            </Link>
          </div>
        </header>
        <main className="animate-rise pb-10"><Outlet /></main>
      </div>
    </div>
  );
}
