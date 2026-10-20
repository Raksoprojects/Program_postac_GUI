import { mount } from "svelte";
import { registerSW } from "virtual:pwa-register";
import "./styles/global.css";
import App from "./App.svelte";

// Service worker (autoUpdate): po wdrozeniu nowej wersji strona przeladowuje sie
// sama, zamiast pokazywac stara wersje z cache do nastepnego otwarcia.
// Sprawdzamy aktualizacje tez co godzine (aplikacja dlugo otwarta na telefonie).
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (registration) setInterval(() => void registration.update(), 60 * 60 * 1000);
  }
});

const target = document.getElementById("app");
if (!target) {
  throw new Error("Brak elementu #app w dokumencie.");
}

const app = mount(App, { target });

export default app;
