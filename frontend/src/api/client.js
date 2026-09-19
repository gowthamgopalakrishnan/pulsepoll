// API Client for Live Polling backend

export const API_BASE_URL = (() => {
  let envUrl = import.meta.env.VITE_API_URL;

  // When loaded from Render frontend domain
  if (typeof window !== 'undefined' && window.location.hostname.includes('onrender.com')) {
    if (!envUrl || !envUrl.includes('.onrender.com')) {
      return "https://pulsepoll-backend-i4aq.onrender.com";
    }
  }

  if (!envUrl) {
    return "http://localhost:8080";
  }

  // Handle Render internal service names like pulsepoll-backend-i4aq
  if (envUrl.includes('pulsepoll-backend') && !envUrl.includes('.onrender.com')) {
    return "https://pulsepoll-backend-i4aq.onrender.com";
  }

  if (!envUrl.startsWith("http://") && !envUrl.startsWith("https://")) {
    return `https://${envUrl}`;
  }
  return envUrl;
})();

export const getWsUrl = (pollId) => {
  let envWs = import.meta.env.VITE_WS_URL;
  if (envWs) {
    if (envWs.includes('pulsepoll-backend') && !envWs.includes('.onrender.com')) {
      return `wss://pulsepoll-backend-i4aq.onrender.com/ws/polls/${pollId}`;
    }
    if (!envWs.startsWith('ws://') && !envWs.startsWith('wss://')) {
      return `wss://${envWs}/ws/polls/${pollId}`;
    }
    return `${envWs}/ws/polls/${pollId}`;
  }
  if (API_BASE_URL.startsWith("http")) {
    const url = new URL(API_BASE_URL);
    const wsProto = url.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProto}//${url.host}/ws/polls/${pollId}`;
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws/polls/${pollId}`;
};

export const auth = {
  getToken: () => localStorage.getItem("pulse_poll_token"),
  setToken: (token) => localStorage.setItem("pulse_poll_token", token),
  clearToken: () => localStorage.removeItem("pulse_poll_token"),
  getUser: () => {
    const raw = localStorage.getItem("pulse_poll_user");
    return raw ? JSON.parse(raw) : null;
  },
  setUser: (user) => localStorage.setItem("pulse_poll_user", JSON.stringify(user)),
  clearUser: () => localStorage.removeItem("pulse_poll_user"),
  logout: () => {
    auth.clearToken();
    auth.clearUser();
  },
};

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  const token = auth.getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || data.details || `HTTP error ${response.status}`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  // Auth
  register: (name, email, password) =>
    request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),

  login: (email, password) =>
    request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  getMe: () => request("/api/auth/me"),

  // Polls
  createPoll: (pollData) =>
    request("/api/polls", {
      method: "POST",
      body: JSON.stringify(pollData),
    }),

  getUserPolls: () => request("/api/polls"),

  getPoll: (pollId) => request(`/api/polls/${pollId}`),

  updatePollStatus: (pollId, isActive) =>
    request(`/api/polls/${pollId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: isActive }),
    }),

  deletePoll: (pollId) =>
    request(`/api/polls/${pollId}`, {
      method: "DELETE",
    }),

  // Voting
  castVote: (pollId, optionIds, voterFingerprint) =>
    request(`/api/polls/${pollId}/vote`, {
      method: "POST",
      body: JSON.stringify({
        option_ids: optionIds,
        voter_fingerprint: voterFingerprint,
      }),
    }),

  checkVoteStatus: (pollId, voterFingerprint) =>
    request(`/api/polls/${pollId}/has-voted?fingerprint=${encodeURIComponent(voterFingerprint)}`),
};
