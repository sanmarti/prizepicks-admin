import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
import AdminLayout from "./layout/AdminLayout";
import ProtectedRoute from "./components/admin/layout/ProtectedRoute";
import { ScrollToTop } from "./components/common/ScrollToTop";
import NotFound from "./pages/OtherPage/NotFound";

// Admin pages
import LoginPage          from "./pages/admin/LoginPage";
import DashboardPage      from "./pages/admin/DashboardPage";
import UsersPage          from "./pages/admin/UsersPage";
import UserDetailPage     from "./pages/admin/UserDetailPage";
import LeaguesPage        from "./pages/admin/LeaguesPage";
import LeagueDetailPage   from "./pages/admin/LeagueDetailPage";
import ScoringMonitorPage from "./pages/admin/ScoringMonitorPage";
import PaymentsPage       from "./pages/admin/PaymentsPage";
import CompetitionsPage      from "./pages/admin/CompetitionsPage";
import CompetitionDetailPage from "./pages/admin/CompetitionDetailPage";
import DivisionsPage         from "./pages/admin/DivisionsPage";
import SprintsPage           from "./pages/admin/SprintsPage";
import SprintDetailPage      from "./pages/admin/SprintDetailPage";

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        {/* Public */}
        <Route path="/admin/login" element={<LoginPage />} />

        {/* Root redirects */}
        <Route path="/"      element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

        {/* Protected admin area */}
        <Route
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/admin/dashboard"        element={<DashboardPage />} />
          <Route path="/admin/users"            element={<UsersPage />} />
          <Route path="/admin/users/:id"        element={<UserDetailPage />} />
          <Route path="/admin/leagues"          element={<LeaguesPage />} />
          <Route path="/admin/leagues/:id"      element={<LeagueDetailPage />} />
          <Route path="/admin/competitions"     element={<CompetitionsPage />} />
          <Route path="/admin/competitions/:id" element={<CompetitionDetailPage />} />
          <Route path="/admin/divisions"        element={<DivisionsPage />} />
          <Route path="/admin/sprints"          element={<SprintsPage />} />
          <Route path="/admin/sprints/:id"      element={<SprintDetailPage />} />
          <Route path="/admin/scoring"          element={<ScoringMonitorPage />} />
          <Route path="/admin/payments"         element={<PaymentsPage />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}
