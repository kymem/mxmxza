export type AppRole = "guest" | "manager" | "worker" | "service_provider";

// "service_provider" stays accepted until the contract migration converts existing rows.
export const isWorkerRole = (role: string | null | undefined): boolean =>
  role === "worker" || role === "service_provider";

export const WORKER_ROLE_VALUES = ["worker", "service_provider"];
