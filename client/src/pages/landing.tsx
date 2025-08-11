import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Stethoscope, Mail } from "lucide-react";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Landing() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: "Email Required",
        description: "Please enter your email address",
        variant: "destructive"
      });
      return;
    }

    if (email !== "notifications@providerloop.com") {
      toast({
        title: "Access Restricted",
        description: "Currently only notifications@providerloop.com is authorized",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      await apiRequest('/api/auth/magic-link', {
        method: 'POST',
        body: JSON.stringify({ email }),
        headers: { 'Content-Type': 'application/json' }
      });
      
      toast({
        title: "Magic Link Sent",
        description: "Check your email for the sign-in link",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send magic link. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Stethoscope className="h-8 w-8 text-blue-600" />
              <h1 className="ml-2 text-2xl font-bold text-gray-900">Providerloop Chains</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex items-center justify-center min-h-[calc(100vh-88px)] p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Mail className="h-12 w-12 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold">Sign In</CardTitle>
            <CardDescription>
              Enter your email to receive a secure sign-in link
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSendMagicLink} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="notifications@providerloop.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? "Sending..." : "Send Magic Link"}
              </Button>
              
              <div className="text-center text-sm text-gray-500">
                A secure sign-in link will be sent to your email
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}