import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { ErrorBoundary } from "./app/ErrorBoundary";
import { AuthGate } from "./app/AuthGate";
import { runStartupTasks } from "./app/startup";
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/base.css";

runStartupTasks();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthGate>
        <App />
      </AuthGate>
    </ErrorBoundary>
  </StrictMode>,
);
