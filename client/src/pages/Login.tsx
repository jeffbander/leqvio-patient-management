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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-100 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900">
      <div className="w-full max-w-7xl px-6 grid lg:grid-cols-2 gap-12 items-center">
        {/* Login Form */}
        <Card className="w-full max-w-md mx-auto shadow-2xl border-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
          <CardHeader className="space-y-4 pb-6">
            <div className="text-center flex flex-col items-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-red-500 to-pink-500 mb-4 shadow-lg">
                <Heart className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                LEQVIO Platform
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-300 leading-relaxed text-center max-w-sm mx-auto">
                Secure access to comprehensive patient enrollment and clinical management
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="email" className="text-sm font-semibold text-gray-700 dark:text-gray-300">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your professional email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="password" className="text-sm font-semibold text-gray-700 dark:text-gray-300">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your secure password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg shadow-lg transition-all duration-200 transform hover:scale-[1.02]" 
                disabled={isLoginLoading}
              >
                {isLoginLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Signing in...
                  </div>
                ) : (
                  "Sign in to LEQVIO Platform"
                )}
              </Button>
            </form>
            <div className="mt-6 text-center">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Don't have an account?{" "}
                <Link href="/register" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium underline">
                  Request Access
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hero Section */}
        <div className="text-center lg:text-left space-y-8">
          <div className="space-y-6">
            <div className="mb-6">
              <h1 className="text-5xl lg:text-6xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600 bg-clip-text text-transparent">
                LEQVIO
              </h1>
              <div className="text-xl font-medium text-gray-600 dark:text-gray-300 mt-1">
                Patient Management System
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800/50 shadow-lg">
              <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                Advanced patient management for <span className="font-semibold text-blue-600 dark:text-blue-400">LEQVIO® (inclisiran)</span> treatment programs
              </p>
              <div className="bg-white/60 dark:bg-gray-800/60 p-4 rounded-lg border border-blue-200/50 dark:border-blue-700/50">
                <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                  <strong>LEQVIO® (inclisiran)</strong> is indicated as an adjunct to diet and maximally tolerated statin therapy for the treatment of adults with primary hyperlipidemia or mixed dyslipidemia.
                </p>
              </div>
            </div>
          </div>
          
          <div className="grid gap-6">
            <div className="bg-white/50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-sm shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className="flex items-start gap-4">
                <div className="bg-blue-100 dark:bg-blue-900/50 p-3 rounded-lg flex-shrink-0">
                  <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Digital Patient Enrollment
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">
                    Complete e-signature forms with automated PDF generation and secure document management
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white/50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-sm shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className="flex items-start gap-4">
                <div className="bg-green-100 dark:bg-green-900/50 p-3 rounded-lg flex-shrink-0">
                  <Shield className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    AI Insurance Authorization
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">
                    AI-powered insurance processing and authorization tracking with real-time status updates
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white/50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-sm shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className="flex items-start gap-4">
                <div className="bg-purple-100 dark:bg-purple-900/50 p-3 rounded-lg flex-shrink-0">
                  <Heart className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Patient Adherence
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">
                    Reduces missed appointments and ensures timely, coordinated care through automated scheduling and patient engagement
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}