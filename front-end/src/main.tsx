
 import { createRoot } from "react-dom/client";
 import App from "./app/App";
 import "./styles/index.css";
 import "./styles/app.css";

 createRoot(document.getElementById("root")!).render(<App />);

 if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
   navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
 }
 
