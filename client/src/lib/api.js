import axios from "axios";

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "/api", withCredentials: true });

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const url = err.config?.url || "";
    if (err.response?.status === 401 && !url.includes("/auth/login") && !url.includes("/auth/me")) {
      window.dispatchEvent(new Event("auth:expired"));
    }
    return Promise.reject(err);
  }
);

export const errMsg = (e) => e?.response?.data?.message || e?.message || "Something went wrong";
// Files are served by the API behind auth (cookie is sent automatically for same-origin / credentialed requests)
export const fileUrl = (u) => (!u ? "" : u.startsWith("http") ? u : (import.meta.env.VITE_API_ORIGIN || "") + u);
export default api;
