import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Fonts are self-hosted (SIL OFL 1.1, via @fontsource) so that loading the site
// does not send every visitor's IP address to Google Fonts.
import "@fontsource/dm-serif-display/400.css";
import "@fontsource/dm-serif-display/400-italic.css";
import "@fontsource-variable/dm-sans/opsz.css";
import "@fontsource-variable/dm-sans/opsz-italic.css";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";
import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
