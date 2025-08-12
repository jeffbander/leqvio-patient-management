import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Building2, ChevronDown } from "lucide-react";

interface Organization {
  id: number;
  name: string;
  description?: string;
}

interface OrganizationMembership {
  organization: Organization;
  role: string;
  isActive: boolean;
}

interface UserOrganizationsData {
  organizations: OrganizationMembership[];
  currentOrganization: {
    organization: Organization;
    role: string;
  } | null;
}

export function OrganizationSwitcher() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  const { data: orgData, isLoading } = useQuery<UserOrganizationsData>({
    queryKey: ["/api/user/organizations"],
    retry: false,
  });

  const switchOrganizationMutation = useMutation({
    mutationFn: async (organizationId: number) => {
      const response = await fetch("/api/user/switch-organization", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ organizationId }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      return await response.json();
    },
    onSuccess: () => {
      // Invalidate all organization-related queries
      queryClient.invalidateQueries({ queryKey: ["/api/user/organizations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organization"] });
      // Refresh the page to update all components
      window.location.reload();
    },
    onError: (error) => {
      console.error("Failed to switch organization:", error);
    },
  });

  const handleOrganizationSwitch = (organizationId: string) => {
    const numericId = parseInt(organizationId);
    if (numericId && numericId !== orgData?.currentOrganization?.organization.id) {
      switchOrganizationMutation.mutate(numericId);
    }
    setIsOpen(false);
  };

  if (isLoading || !orgData) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-500">
        <Building2 className="h-4 w-4" />
        <span>Loading...</span>
      </div>
    );
  }

  const activeOrganizations = orgData.organizations.filter(org => org.isActive);
  const currentOrg = orgData.currentOrganization;

  if (activeOrganizations.length === 0) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-500">
        <Building2 className="h-4 w-4" />
        <span>No organizations</span>
      </div>
    );
  }

  if (activeOrganizations.length === 1) {
    // Only one organization, show it without dropdown
    return (
      <div className="flex items-center space-x-2 px-3 py-2">
        <Building2 className="h-4 w-4 text-blue-600" />
        <span className="font-medium text-sm">{currentOrg?.organization.name}</span>
        <Badge variant="secondary" className="text-xs">
          {currentOrg?.role}
        </Badge>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <Building2 className="h-4 w-4 text-blue-600" />
      <Select
        value={currentOrg?.organization.id?.toString() || ""}
        onValueChange={handleOrganizationSwitch}
        disabled={switchOrganizationMutation.isPending}
      >
        <SelectTrigger className="w-[200px] h-8 text-sm">
          <SelectValue placeholder="Select organization">
            <div className="flex items-center justify-between w-full">
              <span className="truncate">{currentOrg?.organization.name}</span>
              <Badge variant="secondary" className="text-xs ml-2">
                {currentOrg?.role}
              </Badge>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {activeOrganizations.map((orgMembership) => (
            <SelectItem
              key={orgMembership.organization.id}
              value={orgMembership.organization.id.toString()}
            >
              <div className="flex items-center justify-between w-full">
                <span className="truncate">{orgMembership.organization.name}</span>
                <Badge variant="outline" className="text-xs ml-2">
                  {orgMembership.role}
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {switchOrganizationMutation.isPending && (
        <div className="text-xs text-gray-500">Switching...</div>
      )}
    </div>
  );
}