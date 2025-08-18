import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Heart, Shield, FileText } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoginLoading } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login({ email, password });
      toast({
        title: "Success",
        description: "Logged in successfully!",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Login failed",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-6xl px-4 grid lg:grid-cols-2 gap-8 items-center">
        {/* Login Form */}
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2 text-blue-700 dark:text-blue-400">
              <Heart className="h-6 w-6 text-red-500" />
              LEQVIO Patient Management
            </CardTitle>
            <CardDescription className="text-center text-gray-600 dark:text-gray-300">
              Secure access to LEQVIO patient enrollment and management system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={isLoginLoading}>
                {isLoginLoading ? "Signing in..." : "Sign in to LEQVIO"}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm">
              Don't have an account?{" "}
              <Link href="/register" className="text-blue-600 hover:underline">
                Sign up
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Hero Section */}
        <div className="text-center lg:text-left space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-center lg:justify-start gap-3 mb-4">
              <Heart className="h-10 w-10 text-red-500" />
              <h1 className="text-4xl lg:text-5xl font-bold text-blue-700 dark:text-blue-400">
                LEQVIO
              </h1>
            </div>
            <h2 className="text-2xl lg:text-3xl font-semibold text-gray-800 dark:text-gray-200">
              Patient Management System
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Streamlined patient enrollment, insurance verification, and clinical documentation for LEQVIO® (inclisiran) treatment
            </p>
            <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>LEQVIO® (inclisiran)</strong> is indicated as an adjunct to diet and maximally tolerated statin therapy for the treatment of adults with primary hyperlipidemia or mixed dyslipidemia.
              </p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <FileText className="mt-1 h-5 w-5 text-blue-500" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Digital Patient Enrollment
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Complete e-signature forms with automated PDF generation and secure document management
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Shield className="mt-1 h-5 w-5 text-green-500" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Insurance Verification
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  AI-powered insurance card processing and authorization tracking with real-time status updates
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Heart className="mt-1 h-5 w-5 text-red-500" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Clinical Integration
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Seamless integration with EPIC systems and automated workflow management for cardiovascular care
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}