import { AuthEngine } from "@/lib/auth/engine";
import { InMemoryAuthStore } from "@/lib/auth/store";

const store = new InMemoryAuthStore();

export const authEngine = new AuthEngine(store);

export const SESSION_COOKIE = "candidate_session";