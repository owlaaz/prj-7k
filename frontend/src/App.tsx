import { Component, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import PlanningsListPage from "./pages/PlanningsListPage";
import InputPage from "./pages/InputPage";
import SummaryPage from "./pages/SummaryPage";
import { useGuildStore } from "./store/useGuildStore";
import LockBadge from "./components/LockBadge";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="max-w-lg mx-auto py-20 text-center text-gray-400">
          <h1 className="text-2xl font-bold mb-4 text-red-600">Something went wrong</h1>
          <p className="text-sm mb-6 font-mono text-gray-500">
            {(this.state.error as Error).message}
          </p>
          <button
            className="text-blue-600 hover:underline"
            onClick={() => { this.setState({ error: null }); window.location.href = "/"; }}
          >
            Return to home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function NotFound() {
  return (
    <div className="max-w-lg mx-auto py-20 text-center text-gray-400">
      <h1 className="text-4xl font-bold mb-4">404</h1>
      <p className="mb-6">Plan not found.</p>
      <Link to="/" className="text-blue-600 hover:underline"> Back to all plans</Link>
    </div>
  );
}

function TopNav() {
  const { record } = useGuildStore();
  const loc = useLocation();
  const onPlanPage = loc.pathname.startsWith("/plan/");

  return (
    <header className="border-b bg-white sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-12 flex items-center gap-4">
        <Link to="/" className="font-bold text-gray-900 hover:text-blue-600 text-sm">
          Guild Boss Planner
        </Link>
        {onPlanPage && record && (
          <span className="flex items-center gap-2 text-sm text-gray-600">
            <span className="text-gray-300">?</span>
            {record.name}
            <LockBadge locked={record.locked} className="ml-1" />
          </span>
        )}
        <Link to="/" className="ml-auto text-sm text-gray-500 hover:text-blue-600">
          All Plans
        </Link>
      </div>
    </header>
  );
}

// Vite sets import.meta.env.BASE_URL to the configured `base` (e.g. "/7k-planner/").
// React Router uses this as the basename so all <Link to="/..."> paths stay relative.
export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ErrorBoundary>
        <TopNav />
        <Routes>
          <Route path="/" element={<PlanningsListPage />} />
          <Route path="/plan/new" element={<InputPage />} />
          <Route path="/plan/:id/edit" element={<InputPage />} />
          <Route path="/plan/:id" element={<SummaryPage />} />
          <Route path="/not-found" element={<NotFound />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
