export class ApiError extends Error {}
export async function api<T>(path: string, body?: object | FormData, signal?: AbortSignal): Promise<T> {
  const multipart = body instanceof FormData;
  const response = await fetch("/api/" + path, {
    method: body === undefined ? "GET" : "POST",
    ...(body === undefined || multipart ? {} : { headers: { "Content-Type": "application/json" } }),
    body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
    cache: "no-store",
    signal,
  }).catch(() => { throw new ApiError("unavailable"); });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(data?.error ?? (response.status < 500 ? "invalid" : "unavailable"));
  if (data === null) throw new ApiError("unavailable");
  return data as T;
}
