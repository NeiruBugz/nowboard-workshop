import { client } from "./generated/client.gen";

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

client.setConfig({
  baseUrl,
  credentials: "include",
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

client.interceptors.response.use(async (response) => {
  if (!response.ok) {
    let payload: unknown;
    try {
      payload = await response.clone().json();
    } catch {
      payload = { status: response.status, statusText: response.statusText };
    }
    throw new Error(JSON.stringify(payload));
  }
  return response;
});

export { client };
