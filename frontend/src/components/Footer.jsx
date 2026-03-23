import "./Footer.css";

export default function Footer() {
  return (
    <footer className="footer">
      <span>© {new Date().getFullYear()} LegalAId</span>
      <span className="footer-dot">·</span>
      <span>Powered by IndiaCode · IRE · Gemini</span>
    </footer>
  );
}
