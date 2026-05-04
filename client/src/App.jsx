import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { RouteProvider } from './context/RouteContext';
import { AIChatProvider } from './context/AIChatContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import HomeLayout from './components/layout/HomeLayout';
import AppLayout from './components/layout/AppLayout';
import HomePage from './pages/HomePage';
import PlannerPage from './pages/PlannerPage';
import HistoryPage from './pages/HistoryPage';
import AISuggestionsPage from './pages/AISuggestionsPage';
import SavedPlacesPage from './pages/SavedPlacesPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ProfilePage from './pages/ProfilePage';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#0f172a',
          color: '#6366f1',
          fontSize: '1.2rem',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 40,
              height: 40,
              border: '3px solid #6366f1',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 12px',
            }}
          />
          Restoring session...
        </div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <AuthProvider>
      <RouteProvider>
        <AIChatProvider>
          <Router>
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  background: 'rgba(15, 23, 42, 0.95)',
                  color: '#e2e8f0',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  borderRadius: '12px',
                  backdropFilter: 'blur(8px)',
                },
              }}
            />
            <Routes>
              <Route path="/" element={<HomeLayout><HomePage /></HomeLayout>} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />

              <Route path="/planner" element={<ProtectedRoute><AppLayout><PlannerPage /></AppLayout></ProtectedRoute>} />
              <Route path="/planner/:routeId" element={<ProtectedRoute><AppLayout><PlannerPage /></AppLayout></ProtectedRoute>} />
              <Route path="/history" element={<ProtectedRoute><AppLayout><HistoryPage /></AppLayout></ProtectedRoute>} />
              <Route path="/saved" element={<ProtectedRoute><AppLayout><SavedPlacesPage /></AppLayout></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><AppLayout><ProfilePage /></AppLayout></ProtectedRoute>} />
              <Route path="/ai-suggestions" element={<ProtectedRoute><AppLayout><AISuggestionsPage /></AppLayout></ProtectedRoute>} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </AIChatProvider>
      </RouteProvider>
    </AuthProvider>
  );
}

export default App;
