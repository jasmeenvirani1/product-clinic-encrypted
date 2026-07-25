// Lightweight cross-component signal used to refresh integration (WhatsApp /
// Instagram) connection status instantly — without waiting for the banner's
// polling interval. Fired whenever a connection is established or removed.
export const INTEGRATIONS_REFRESH_EVENT = "integrations:refresh";

/** Notify listeners (e.g. the NotificationBanner) that connection state changed. */
export const notifyIntegrationsChanged = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(INTEGRATIONS_REFRESH_EVENT));
  }
};
