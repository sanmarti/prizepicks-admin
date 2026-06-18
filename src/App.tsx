import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router";
import AdminLayout from "./layout/AdminLayout";
import ProtectedRoute from "./components/admin/layout/ProtectedRoute";
import { ScrollToTop } from "./components/common/ScrollToTop";
import NotFound from "./pages/OtherPage/NotFound";

// Admin pages
import LoginPage           from "./pages/admin/LoginPage";
import DashboardPage       from "./pages/admin/DashboardPage";
import UsersPage           from "./pages/admin/UsersPage";
import UserDetailPage      from "./pages/admin/UserDetailPage";
import LeaguesPage         from "./pages/admin/LeaguesPage";
import LeagueDetailPage    from "./pages/admin/LeagueDetailPage";
import GameweekBuilderPage from "./pages/admin/GameweekBuilderPage";
import OddsReviewPage      from "./pages/admin/OddsReviewPage";
import ScoringMonitorPage  from "./pages/admin/ScoringMonitorPage";
import PaymentsPage        from "./pages/admin/PaymentsPage";
import CompetitionsPage    from "./pages/admin/CompetitionsPage";

function GameweeksListPage() {
  const navigate = useNavigate();
  return (
    <div className="text-center py-20 text-gray-400">
      <p className="mb-4 text-lg">Gameweeks</p>
      <button
        onClick={() => navigate("/admin/gameweeks/new")}
        className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm hover:bg-indigo-700 transition-colors font-medium"
      >
        + New Gameweek
      </button>
    </div>
  );
}

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
          <Route path="/admin/dashboard"          element={<DashboardPage />} />
          <Route path="/admin/users"              element={<UsersPage />} />
          <Route path="/admin/users/:id"          element={<UserDetailPage />} />
          <Route path="/admin/leagues"            element={<LeaguesPage />} />
          <Route path="/admin/leagues/:id"        element={<LeagueDetailPage />} />
          <Route path="/admin/gameweeks"          element={<GameweeksListPage />} />
          <Route path="/admin/gameweeks/new"      element={<GameweekBuilderPage />} />
          <Route path="/admin/gameweeks/:id"      element={<GameweekBuilderPage />} />
          <Route path="/admin/gameweeks/:id/odds" element={<OddsReviewPage />} />
          <Route path="/admin/competitions"       element={<CompetitionsPage />} />
          <Route path="/admin/scoring"            element={<ScoringMonitorPage />} />
          <Route path="/admin/payments"           element={<PaymentsPage />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}
