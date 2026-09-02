import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: "100vh", background: "var(--surface)"
      }}>
        {/* The design system's spinner rather than a hand-rolled copy of it.
            The inline animation here could not be reached by the reduced-motion
            rules, so this was the one loader in the product that froze with no
            way to style it back to life. */}
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        state={{ ...(location.state || {}), from: location.pathname }}
        replace
      />
    );
  }

  return children;
}
