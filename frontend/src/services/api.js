import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:5000",
});

// Attach JWT token from localStorage to every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("legalaid_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-redirect to login on 401
API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("legalaid_token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export const getDocumentTypes = () => API.get("/document-types");
export const getDocumentConfig = (type) => API.get(`/document-config/${type}`);
export const generateDocument = (data) => API.post("/generate", data);
export const validateDocument = (data, deep = false) =>
  API.post("/validate", { ...data, deep });
export const chatWithDocument = (draft, message) =>
  API.post("/chat", { draft, message });
export const fixIssue = (draft, issue) =>
  API.post("/fix-issue", { draft, issue });

export async function downloadDocx(draft, validation) {
  const response = await API.post(
    "/export",
    { draft, validation, format: "docx" },
    { responseType: "blob" }
  );
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(draft.document_type || "document").toLowerCase()}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
