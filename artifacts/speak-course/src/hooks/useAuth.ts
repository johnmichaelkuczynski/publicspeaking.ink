import { useQuery } from "@tanstack/react-query";

export interface AuthUser {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

const base = import.meta.env.BASE_URL;

async function fetchMe(): Promise<AuthUser | null> {
  const res = await fetch(`${base}api/auth/me`);
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(`Auth check failed with status ${res.status}`);
  }
  const data = (await res.json()) as { user: AuthUser };
  return data.user;
}

export function useAuth() {
  const query = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
    isAuthenticated: !!query.data,
  };
}

export function signInUrl(): string {
  return `${base}api/auth/google`;
}

export async function logout(): Promise<void> {
  await fetch(`${base}api/auth/logout`, { method: "POST" });
  window.location.href = base;
}
