import { getWsUrl } from "./client";

export class PollWebSocket {
  constructor(pollId, onUpdate, onStatusChange) {
    this.pollId = pollId;
    this.onUpdate = onUpdate;
    this.onStatusChange = onStatusChange;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 15;
    this.reconnectTimeout = null;
    this.isExplicitlyClosed = false;

    this.connect();
  }

  connect() {
    if (this.isExplicitlyClosed) return;

    try {
      const url = getWsUrl(this.pollId);
      if (this.onStatusChange) this.onStatusChange("connecting");

      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        if (this.onStatusChange) this.onStatusChange("connected");
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (this.onUpdate) {
            this.onUpdate(payload);
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err, event.data);
        }
      };

      this.ws.onclose = () => {
        if (this.onStatusChange) this.onStatusChange("disconnected");
        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        console.warn("WebSocket encounter error:", err);
      };
    } catch (err) {
      console.error("WebSocket connection initiation error:", err);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.isExplicitlyClosed) return;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (this.onStatusChange) this.onStatusChange("failed");
      return;
    }

    const backoff = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 8000);
    this.reconnectAttempts++;

    clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, backoff);
  }

  close() {
    this.isExplicitlyClosed = true;
    clearTimeout(this.reconnectTimeout);
    if (this.ws) {
      this.ws.close();
    }
  }
}
