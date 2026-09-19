// Generates or retrieves a persistent anonymous client voter fingerprint
export function getVoterFingerprint() {
  const STORAGE_KEY = "pulse_voter_fingerprint";
  let fingerprint = localStorage.getItem(STORAGE_KEY);

  if (!fingerprint) {
    // Generate a random UUID-like string combined with browser platform info
    const randomPart = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const timestamp = Date.now().toString(36);
    fingerprint = `voter_${timestamp}_${randomPart}`;
    localStorage.setItem(STORAGE_KEY, fingerprint);
  }

  return fingerprint;
}
