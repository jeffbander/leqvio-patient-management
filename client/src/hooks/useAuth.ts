import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    queryFn: async () => {
      const response = await fetch('/api/auth/user');
      if (response.status === 401) {
        // Not authenticated is expected, not an error
        return null;
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}