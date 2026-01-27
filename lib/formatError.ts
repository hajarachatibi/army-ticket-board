export function formatError(error: unknown, context?: string): string {
  if (!error) return "Something went wrong";

  if (typeof error === "object" && error !== null) {
    const e = error as { message?: string };
    return e.message ?? `${context ?? "Error"} failed`;
  }

  return `${context ?? "Error"} failed`;
}
