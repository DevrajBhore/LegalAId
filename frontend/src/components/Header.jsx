import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Header.css";

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="header">
      <div className="header-logo">
        <Link to="/">LegalAId</Link>
        <span className="header-tagline">Indian Legal Document Engine</span>
      </div>

      <nav className="header-nav">
        <Link to="/" className={location.pathname === "/" ? "nav-active" : ""}>
          Home
        </Link>

        {user ? (
          <div className="header-user">
            <div className="header-avatar">{user.name.charAt(0).toUpperCase()}</div>
            <span className="header-user-name">{user.name.split(" ")[0]}</span>
            <button className="header-logout" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        ) : (
          <div className="header-auth-links">
            <Link to="/login" className="header-login-btn">Sign in</Link>
            <Link to="/register" className="header-register-btn">Get started</Link>
          </div>
        )}
      </nav>
    </header>
  );
}