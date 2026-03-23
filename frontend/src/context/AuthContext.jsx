import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const AuthContext = createContext(null);

const API = axios.create({ baseURL: "http://localhost:5000" });

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(() => localStorage.getItem("legalaid_token"));
  const [loading, setLoading] = useState(true);

  // Attach token to every request
  useEffect(() => {
    if (token) {
      API.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      localStorage.setItem("legalaid_token", token);
    } else {
      delete API.defaults.headers.common["Authorization"];
      localStorage.removeItem("legalaid_token");
    }
  }, [token]);

  // Restore session on load
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    API.get("/auth/me")
      .then(res => setUser(res.data.user))
      .catch(() => { setToken(null); setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  const login = (tokenValue, userData) => {
    setToken(tokenValue);
    setUser(userData);
    API.defaults.headers.common["Authorization"] = `Bearer ${tokenValue}`;
    localStorage.setItem("legalaid_token", tokenValue);
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