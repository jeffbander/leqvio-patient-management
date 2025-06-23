import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  // Check if error indicates Replit environment is required
  const isReplitRequired = error && 
    typeof error === 'object' && 
    'message' in error && 
    error.message?.includes('isReplitRequired');

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isReplitRequired: !!isReplitRequired,
  };
}