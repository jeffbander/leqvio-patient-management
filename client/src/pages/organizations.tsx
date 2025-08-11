import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Users, Crown, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";

interface Organization {
  id: number;
  name: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

interface Member {
  id: number;
  organizationId: number;
  userId: string;
  role: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    profileImageUrl: string;
  };
}

export default function Organizations() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: organizations, isLoading: orgsLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    select: (data: any) => data?.organizations || [],
    enabled: isAuthenticated,
  });

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ["/api/organizations", selectedOrg?.id, "members"],
    enabled: !!selectedOrg,
  });

  const createOrgMutation = useMutation({
    mutationFn: async (name: string) => {
      return await apiRequest(`/api/organizations`, {
        method: "POST",
        body: JSON.stringify({ name }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Organization created successfully",
      });
      setShowCreateDialog(false);
      setOrgName("");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to create organization",
        variant: "destructive",
      });
    },
  });

  const inviteMemberMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      return await apiRequest(`/api/organizations/${selectedOrg!.id}/members`, {
        method: "POST",
        body: JSON.stringify({ email, role }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Invite sent successfully",
      });
      setShowInviteDialog(false);
      setInviteEmail("");
      setInviteRole("member");
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", selectedOrg!.id, "members"] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to send invite",
        variant: "destructive",
      });
    },
  });

  if (authLoading || !isAuthenticated) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Organizations</h1>
          <p className="text-gray-600">Manage your organizations and team members</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Organization
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Organization</DialogTitle>
              <DialogDescription>
                Create a new organization to manage patients and team members
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="orgName">Organization Name</Label>
                <Input
                  id="orgName"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Enter organization name"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => createOrgMutation.mutate(orgName)}
                disabled={!orgName.trim() || createOrgMutation.isPending}
              >
                {createOrgMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Organizations List */}
        <Card>
          <CardHeader>
            <CardTitle>Your Organizations</CardTitle>
            <CardDescription>Organizations you belong to</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {orgsLoading ? (
              <div>Loading organizations...</div>
            ) : organizations?.length > 0 ? (
              organizations.map((org: Organization) => (
                <div
                  key={org.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedOrg?.id === org.id 
                      ? "border-blue-500 bg-blue-50" 
                      : "hover:border-gray-300"
                  }`}
                  onClick={() => setSelectedOrg(org)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{org.name}</h3>
                      <p className="text-sm text-gray-600">
                        Created {new Date(org.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant={org.role === "admin" ? "default" : "secondary"}>
                      {org.role === "admin" ? (
                        <>
                          <Crown className="h-3 w-3 mr-1" />
                          Admin
                        </>
                      ) : (
                        <>
                          <User className="h-3 w-3 mr-1" />
                          Member
                        </>
                      )}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500">No organizations found</p>
            )}
          </CardContent>
        </Card>

        {/* Organization Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>
                {selectedOrg ? (
                  <>
                    <Users className="h-5 w-5 mr-2 inline" />
                    {selectedOrg.name} Members
                  </>
                ) : (
                  "Select an Organization"
                )}
              </span>
              {selectedOrg && selectedOrg.role === "admin" && (
                <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Invite Member
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Invite Team Member</DialogTitle>
                      <DialogDescription>
                        Invite a new member to {selectedOrg.name}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                          id="email"
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="Enter email address"
                        />
                      </div>
                      <div>
                        <Label htmlFor="role">Role</Label>
                        <Select value={inviteRole} onValueChange={setInviteRole}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setShowInviteDialog(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => inviteMemberMutation.mutate({ email: inviteEmail, role: inviteRole })}
                        disabled={!inviteEmail.trim() || inviteMemberMutation.isPending}
                      >
                        {inviteMemberMutation.isPending ? "Sending..." : "Send Invite"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedOrg ? (
              <div className="space-y-3">
                {membersLoading ? (
                  <div>Loading members...</div>
                ) : members?.length > 0 ? (
                  members.map((member: Member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        {member.user.profileImageUrl ? (
                          <img
                            src={member.user.profileImageUrl}
                            alt={`${member.user.firstName} ${member.user.lastName}`}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                            <User className="h-4 w-4" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">
                            {member.user.firstName} {member.user.lastName}
                          </p>
                          <p className="text-sm text-gray-600">{member.user.email}</p>
                        </div>
                      </div>
                      <Badge variant={member.role === "admin" ? "default" : "secondary"}>
                        {member.role === "admin" ? (
                          <>
                            <Crown className="h-3 w-3 mr-1" />
                            Admin
                          </>
                        ) : (
                          <>
                            <User className="h-3 w-3 mr-1" />
                            Member
                          </>
                        )}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500">No members found</p>
                )}
              </div>
            ) : (
              <p className="text-gray-500">Select an organization to view members</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}