import { createContext, useContext, useState, useEffect } from "react";
import { getCurrentUser } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(() => localStorage.getItem("legalaid_token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      localStorage.setItem("legalaid_token", token);
    } else {
      localStorage.removeItem("legalaid_token");
    }
  }, [token]);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    getCurrentUser()
      .then(res => setUser(res.data.user))
      .catch(() => { setToken(null); setUser(null); })
      .finally(() => setLoading(false));
  }, [token]);

  const login = (tokenValue, userData) => {
    setToken(tokenValue);
    setUser(userData);
  };

  const logout = () => {
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
