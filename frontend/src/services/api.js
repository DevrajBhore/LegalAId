import axios from "axios";

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(
    /\/$/,
    ""
  );

const API = axios.create({
  baseURL: API_BASE_URL,
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("legalaid_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.skipAuthRedirect) {
      localStorage.removeItem("legalaid_token");
      window.location.assign("/login");
    }
    return Promise.reject(error);
  }
);

export { API, API_BASE_URL };

export const getDocumentTypes = () => API.get("/document-types");
export const getDocumentConfig = (type) => API.get(`/document-config/${type}`);
export const generateDocument = (data) => API.post("/generate", data);
export const chatWithIntakeAssistant = (data) =>
  API.post("/intake-assistant", data);
export const getDocumentHistoryList = () => API.get("/history/documents");
export const getDocumentHistoryDetail = (draftId) =>
  API.get(`/history/documents/${draftId}`);
export const deleteDocumentHistory = (draftId) =>
  API.delete(`/history/documents/${draftId}`);
export const saveDocumentHistory = (payload) =>
  API.post("/history/documents/save", payload);
export const restoreDocumentHistoryVersion = (draftId, versionId) =>
  API.post(`/history/documents/${draftId}/restore/${versionId}`);
export const validateDocument = (data, mode = "final") => {
  const resolvedMode =
    typeof mode === "boolean" ? (mode ? "final" : "background") : mode;
  return API.post("/validate", { ...data, mode: resolvedMode });
};
export const chatWithDocument = (draft, message) =>
  API.post("/chat", { draft, message });
export const fixIssue = (draft, issue) =>
  API.post("/fix-issue", { draft, issue });

export const loginUser = (data) =>
  API.post("/auth/login", data, { skipAuthRedirect: true });
export const registerUser = (data) =>
  API.post("/auth/register", data, { skipAuthRedirect: true });
export const resendVerificationEmail = (email) =>
  API.post(
    "/auth/resend-verification",
    { email },
    { skipAuthRedirect: true }
  );
export const verifyEmailToken = (token) =>
  API.get("/auth/verify-email", {
    params: { token },
    skipAuthRedirect: true,
  });
export const forgotPassword = (email) =>
  API.post("/auth/forgot-password", { email }, { skipAuthRedirect: true });
export const resetPassword = (token, password) =>
  API.post(
    "/auth/reset-password",
    { token, password },
    { skipAuthRedirect: true }
  );
export const getCurrentUser = () =>
  API.get("/auth/me", { skipAuthRedirect: true });

function resolveDownloadExtension(format = "docx") {
  const normalized = String(format || "docx").toLowerCase();
  if (["docx", "pdf", "txt"].includes(normalized)) {
    return normalized;
  }
  return "docx";
}

export async function downloadDocument(draft, validation, format = "docx") {
  const extension = resolveDownloadExtension(format);
  const response = await API.post(
    "/export",
    { draft, validation, format: extension },
    { responseType: "blob" }
  );
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(draft.document_type || "document").toLowerCase()}.${extension}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
