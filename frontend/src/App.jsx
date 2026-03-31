import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

import Layout from "./layout/Layout";
import Home from "./pages/Home";
import Library from "./pages/Library";
import Form from "./pages/Form";
import Editor from "./pages/Editor";
import Profile from "./pages/Profile";
import Documents from "./pages/Documents";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Help from "./pages/Help";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";

import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import VerifyEmail from "./pages/auth/VerifyEmail";
import ResendVerification from "./pages/auth/ResendVerification";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_relativeSplatPath: true }}>
        <Routes>
          {/* Public auth routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/resend-verification" element={<ResendVerification />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* App routes */}
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="library" element={<Library />} />
            <Route path="about" element={<About />} />
            <Route path="contact" element={<Contact />} />
            <Route path="help" element={<Help />} />
            <Route path="privacy-policy" element={<PrivacyPolicy />} />
            <Route path="terms-of-service" element={<TermsOfService />} />
            <Route path="form" element={<ProtectedRoute><Form /></ProtectedRoute>} />
            <Route path="editor" element={<ProtectedRoute><Editor /></ProtectedRoute>} />
            <Route path="documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
            <Route path="profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
