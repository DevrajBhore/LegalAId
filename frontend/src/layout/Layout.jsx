import { Outlet, useLocation } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "./Layout.css";

export default function Layout() {
  const location = useLocation();
  const isWorkspaceRoute = location.pathname.startsWith("/editor");

  return (
    <div className={`layout${isWorkspaceRoute ? " layout--workspace" : ""}`}>
      {!isWorkspaceRoute && <Header />}
      <main
        className={`layout-content${
          isWorkspaceRoute ? " layout-content--workspace" : ""
        }`}
      >
        <Outlet />
      </main>
      {!isWorkspaceRoute && <Footer />}
    </div>
  );
}
