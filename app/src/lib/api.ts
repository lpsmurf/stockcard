/** Response envelope for all route handlers (contracts/api.md). */
export function ok(data: unknown, init?: { status?: number; headers?: HeadersInit }) {
  return Response.json({ ok: true, data }, init);
}

export function err(code: string, message: string, status = 400) {
  return Response.json({ ok: false, error: { code, message } }, { status });
}
