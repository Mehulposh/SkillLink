import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Background from "./components/Background";
import Layout from "./components/Layout";
import { Spinner } from "./components/ui";

import Landing from "./pages/Landing";
import { Login, Register, ForgotPassword, ResetPassword, VerifyEmail } from "./pages/Auth";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import JobDetail from "./pages/JobDetail";
import CustomerDashboard from "./pages/customer/Dashboard";
import NewRequest from "./pages/customer/NewRequest";
import MyRequests from "./pages/customer/MyRequests";
import FindWorkers from "./pages/customer/FindWorkers";
import WorkerPublic from "./pages/customer/WorkerPublic";
import WorkerDashboard from "./pages/worker/Dashboard";
import OpenJobs from "./pages/worker/OpenJobs";
import MyJobs from "./pages/worker/MyJobs";
import Earnings from "./pages/worker/Earnings";
import WorkerProfile from "./pages/worker/Profile";
import AdminOverview from "./pages/admin/Overview";
import AdminUsers from "./pages/admin/Users";
import AdminJobs from "./pages/admin/Jobs";
import AdminVerifications from "./pages/admin/Verifications";
import AdminDisputes from "./pages/admin/Disputes";
import AdminCatalog from "./pages/admin/Catalog";

const HOME = { user: "/dashboard", worker: "/worker", admin: "/admin" };

function Protected({ roles }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <Spinner className="min-h-screen" />;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (roles && !roles.includes(user.type)) return <Navigate to={HOME[user.type]} replace />;
  return <Outlet />;
}
function GuestOnly() {
  const { user, ready } = useAuth();
  if (!ready) return <Spinner className="min-h-screen" />;
  return user ? <Navigate to={HOME[user.type]} replace /> : <Outlet />;
}

export default function App() {
  return (
    <>
      <Background />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route element={<GuestOnly />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

        <Route element={<Protected />}>
          <Route element={<Layout />}>
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route element={<Protected roles={["user"]} />}>
              <Route path="/dashboard" element={<CustomerDashboard />} />
              <Route path="/new" element={<NewRequest />} />
              <Route path="/requests" element={<MyRequests />} />
              <Route path="/workers" element={<FindWorkers />} />
              <Route path="/workers/:id" element={<WorkerPublic />} />
            </Route>
            <Route element={<Protected roles={["worker"]} />}>
              <Route path="/worker" element={<WorkerDashboard />} />
              <Route path="/worker/open" element={<OpenJobs />} />
              <Route path="/worker/jobs" element={<MyJobs />} />
              <Route path="/worker/earnings" element={<Earnings />} />
              <Route path="/worker/profile" element={<WorkerProfile />} />
            </Route>
            <Route element={<Protected roles={["admin"]} />}>
              <Route path="/admin" element={<AdminOverview />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/jobs" element={<AdminJobs />} />
              <Route path="/admin/verifications" element={<AdminVerifications />} />
              <Route path="/admin/disputes" element={<AdminDisputes />} />
              <Route path="/admin/catalog" element={<AdminCatalog />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
