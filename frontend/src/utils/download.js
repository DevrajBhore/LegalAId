export function downloadDocument(draft) {
    const text = draft.clauses
      .map((c) => `${c.title}\n\n${c.text}\n\n`)
      .join("\n");
  
    const blob = new Blob([text], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
  
    const a = document.createElement("a");
    a.href = url;
    a.download = `${draft.document_type}.txt`;
    a.click();
  
    window.URL.revokeObjectURL(url);
  }