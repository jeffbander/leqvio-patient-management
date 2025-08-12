import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Users, Building2, UserPlus, Settings, Copy, Check } from "lucide-react";

interface OrganizationMember {
  id: number;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  lastLoginAt?: string;
}

interface Organization {
  id: number;
  name: string;
  description?: string;
  createdAt: string;
}

export default function OrganizationManagement() {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [editingOrg, setEditingOrg] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [orgDescription, setOrgDescription] = useState("");
  const [lastInviteResult, setLastInviteResult] = useState<{
    tempPassword?: string;
    user: OrganizationMember;
    isExisting: boolean;
    message: string;
  } | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch organization details
  const { data: organization, isLoading: orgLoading } = useQuery({
    queryKey: ["/api/organization"],
    retry: false,
  });

  // Fetch organization members
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ["/api/organization/members"],
    retry: false,
  });

  // Initialize form values when organization data loads
  React.useEffect(() => {
    if (organization) {
      setOrgName(organization.name || "");
      setOrgDescription(organization.description || "");
    }
  }, [organization]);

  // Invite user mutation
  const inviteUserMutation = useMutation({
    mutationFn: async (userData: { email: string; name: string }) => {
      console.log("Inviting user:", userData);
      const response = await fetch("/api/organization/invite", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const result = await response.json();
      console.log("Invite response:", result);
      return result;
    },
    onSuccess: (data) => {
      console.log("Invite success:", data);
      queryClient.invalidateQueries({ queryKey: ["/api/organization/members"] });
      setInviteEmail("");
      setInviteName("");
      setLastInviteResult(data);
      setCopiedPassword(false);
      toast({
        title: "Success",
        description: data.message,
      });
    },
    onError: (error: any) => {
      console.error("Invite error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to invite user",
        variant: "destructive",
      });
    },
  });

  // Update organization mutation
  const updateOrgMutation = useMutation({
    mutationFn: async (orgData: { name: string; description: string }) => {
      const response = await fetch("/api/organization", {
        method: "PUT",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orgData),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization"] });
      setEditingOrg(false);
      toast({
        title: "Success",
        description: "Organization updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update organization",
        variant: "destructive",
      });
    },
  });

  // Remove user mutation
  const removeUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await fetch(`/api/organization/members/${userId}`, {
        method: "DELETE",
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization/members"] });
      toast({
        title: "Success",
        description: "User removed from organization",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove user",
        variant: "destructive",
      });
    },
  });

  const handleInviteUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteName.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }
    inviteUserMutation.mutate({ email: inviteEmail, name: inviteName });
  };

  const copyPasswordToClipboard = async (password: string) => {
    try {
      await navigator.clipboard.writeText(password);
      setCopiedPassword(true);
      toast({
        title: "Copied!",
        description: "Temporary password copied to clipboard",
      });
      setTimeout(() => setCopiedPassword(false), 2000);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy password",
        variant: "destructive",
      });
    }
  };

  const handleUpdateOrg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) {
      toast({
        title: "Error",
        description: "Organization name is required",
        variant: "destructive",
      });
      return;
    }
    updateOrgMutation.mutate({ name: orgName, description: orgDescription });
  };

  const handleRemoveUser = (userId: number, userName: string) => {
    if (confirm(`Are you sure you want to remove ${userName} from the organization?`)) {
      removeUserMutation.mutate(userId);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner': return 'default';
      case 'admin': return 'secondary';
      case 'user': return 'outline';
      default: return 'outline';
    }
  };

  if (orgLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">Loading organization details...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Building2 className="h-6 w-6" />
        <h1 className="text-3xl font-bold">Organization Management</h1>
      </div>

      {/* Organization Details */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Organization Details
              </CardTitle>
              <CardDescription>
                Manage your organization information
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => setEditingOrg(!editingOrg)}
            >
              {editingOrg ? "Cancel" : "Edit"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {editingOrg ? (
            <form onSubmit={handleUpdateOrg} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organization Name</Label>
                <Input
                  id="orgName"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Enter organization name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orgDescription">Description</Label>
                <Textarea
                  id="orgDescription"
                  value={orgDescription}
                  onChange={(e) => setOrgDescription(e.target.value)}
                  placeholder="Describe your organization"
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={updateOrgMutation.isPending}>
                  {updateOrgMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditingOrg(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Name</Label>
                <p className="text-lg">{organization?.name || "No name set"}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Description</Label>
                <p className="text-gray-600">{organization?.description || "No description provided"}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Created</Label>
                <p className="text-sm text-gray-500">
                  {organization?.createdAt ? new Date(organization.createdAt).toLocaleDateString() : "Unknown"}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite New User */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite New User
          </CardTitle>
          <CardDescription>
            Add a new team member to your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInviteUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="inviteEmail">Email Address</Label>
                <Input
                  id="inviteEmail"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inviteName">Full Name</Label>
                <Input
                  id="inviteName"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="John Doe"
                  required
                />
              </div>
            </div>
            <Button type="submit" disabled={inviteUserMutation.isPending}>
              {inviteUserMutation.isPending ? "Inviting..." : "Send Invitation"}
            </Button>
          </form>
          
          {/* Display temporary password for new users */}
          {lastInviteResult && lastInviteResult.tempPassword && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-yellow-800">
                    {lastInviteResult.isExisting ? "User Added" : "User Created"}
                  </h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Temporary password for {lastInviteResult.user.email}:
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <code className="px-2 py-1 bg-yellow-100 text-yellow-900 rounded font-mono">
                      {lastInviteResult.tempPassword}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyPasswordToClipboard(lastInviteResult.tempPassword!)}
                      disabled={copiedPassword}
                    >
                      {copiedPassword ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      {copiedPassword ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setLastInviteResult(null)}
                >
                  ×
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Organization Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Organization Members ({members.length})
          </CardTitle>
          <CardDescription>
            Manage users in your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="text-center py-4">Loading members...</div>
          ) : members.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No members found. Invite some users to get started!
            </div>
          ) : (
            <div className="space-y-4">
              {members.map((member: OrganizationMember, index: number) => (
                <div key={member.id}>
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div>
                          <h3 className="font-medium">{member.name}</h3>
                          <p className="text-sm text-gray-500">{member.email}</p>
                        </div>
                        <Badge variant={getRoleBadgeVariant(member.role)}>
                          {member.role}
                        </Badge>
                      </div>
                      <div className="mt-2 text-xs text-gray-400">
                        Joined: {new Date(member.createdAt).toLocaleDateString()}
                        {member.lastLoginAt && (
                          <span className="ml-4">
                            Last login: {new Date(member.lastLoginAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    {member.role !== 'owner' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveUser(member.id, member.name)}
                        disabled={removeUserMutation.isPending}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  {index < members.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}