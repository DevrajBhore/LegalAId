import { createContext, useContext, useState, useEffect } from "react";
import { getCurrentUser, logoutRequest, setAuthToken } from "../services/api";

const AuthContext = createContext(null);

// One-time cleanup for sessions issued before the token stopped being persisted.
// Without this, a stale JWT sits in localStorage indefinitely on returning
// browsers — exactly the XSS-readable copy we are removing.
function purgeLegacyStoredToken() {
  try {
    localStorage.removeItem("legalaid_token");
  } catch {
    // Private-mode / storage-disabled browsers: nothing to purge.
  }
}

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(null);
  const [loading, setLoading] = useState(true);

  // Always ask the server who we are, rather than inferring it from a stored
  // token. The session lives in the httpOnly cookie, so this is the only way to
  // see it — the previous version skipped this call whenever localStorage was
  // empty and so reported a perfectly valid cookie session as logged out.
  useEffect(() => {
    purgeLegacyStoredToken();
    let cancelled = false;

    getCurrentUser()
      .then((res) => {
        if (!cancelled) setUser(res.data.user);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = (tokenValue, userData) => {
    setAuthToken(tokenValue); // in-memory only; the cookie is the durable session
    setToken(tokenValue);
    setUser(userData);
  };

  const logout = () => {
    logoutRequest(); // clear the httpOnly cookie server-side
    setAuthToken(null);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
