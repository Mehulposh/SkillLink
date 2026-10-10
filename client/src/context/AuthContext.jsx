import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "../lib/api";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try { const { data } = await api.get("/auth/me"); setUser(data.user); return data.user; }
    catch { setUser(null); return null; }
    finally { setReady(true); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const h = () => setUser(null);
    window.addEventListener("auth:expired", h);
    return () => window.removeEventListener("auth:expired", h);
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    if (!data.success) throw new Error(data.message || "Login failed");
    setUser(data.userData);
    return data.userData;
  };
  const logout = async () => { try { await api.post("/auth/logout"); } finally { setUser(null); } };

  return <Ctx.Provider value={{ user, ready, login, logout, refresh, setUser }}>{children}</Ctx.Provider>;
}
