import { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage";
import { DashboardPage } from "./pages/DashboardPage";
import { CanvasPage } from "./pages/CanvasPage";
import { ExportPage } from "./pages/ExportPage";
import AuthPage from "./pages/AuthPage";
import { Toaster } from "./components/ui/toaster";
import { AuthProvider, useAuth } from "./hooks/useAuth";

// Protected route wrapper - requires authentication
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-white text-xl font-display">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

// Optional auth route - allows both authenticated and anonymous users
// Used for public board sharing
function OptionalAuthRoute({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-white text-xl font-display">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <Suspense fallback={
        <div className="min-h-screen gradient-bg flex items-center justify-center">
          <div className="text-white text-xl font-display">Loading...</div>
        </div>
      }>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          {/* Protected canvas route - requires login */}
          <Route
            path="/canvas/:boardId"
            element={
              <ProtectedRoute>
                <CanvasPage />
              </ProtectedRoute>
            }
          />
          {/* Public board sharing route - allows anonymous access for public boards */}
          <Route
            path="/board/:boardId"
            element={
              <OptionalAuthRoute>
                <CanvasPage />
              </OptionalAuthRoute>
            }
          />
          <Route
            path="/export/:boardId"
            element={
              <ProtectedRoute>
                <ExportPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
      <Toaster />
    </AuthProvider>
  );
}

export default App;
