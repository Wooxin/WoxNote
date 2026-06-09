import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

// Disable Tauri/browser native context menu (only when no custom menu)
document.addEventListener("contextmenu", (e) => {
  // Allow our custom context menus to work by checking if the target
  // or its parent has a custom context menu handler
  const target = e.target as HTMLElement;
  const hasCustomMenu = target.closest("[data-custom-contextmenu], .document-surface, .file-tree, .context-menu-shield");
  if (!hasCustomMenu) {
    e.preventDefault();
  }
});