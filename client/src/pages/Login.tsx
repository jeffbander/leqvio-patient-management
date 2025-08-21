import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, CheckCircle, Heart, Shield, FileText } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const loginFormSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [emailSent, setEmailSent] = useState(false);
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
    },
  });

  const sendMagicLinkMutation = useMutation({
    mutationFn: async (data: LoginFormValues) => {
      const res = await apiRequest("POST", "/api/auth/send-magic-link", data);
      return res.json();
    },
    onSuccess: (data) => {
      setEmailSent(true);
      setMagicLink(data.magicLink);
      toast({
        title: "Magic link created",
        description: "Click the link below to log in",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create magic link",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    sendMagicLinkMutation.mutate(data);
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle>Check your email</CardTitle>
            <CardDescription>
              Magic link created for {form.getValues("email")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              {magicLink ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Click the button below to log in:
                  </p>
                  <Button
                    onClick={() => window.location.href = magicLink}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    Login to LEQVIO Patient Management
                  </Button>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Link expires in 15 minutes
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Generating your login link...
                </p>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  setEmailSent(false);
                  setMagicLink(null);
                }}
                className="w-full"
              >
                Generate another link
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-6xl px-4 grid lg:grid-cols-2 gap-8 items-center">
        {/* Login Form */}
        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
              <Heart className="h-6 w-6 text-red-500" />
              LEQVIO Patient Management
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-300">
              Secure access to LEQVIO patient enrollment and management system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="your.email@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={sendMagicLinkMutation.isPending}
                >
                  {sendMagicLinkMutation.isPending ? "Sending..." : "Send Secure Login Link"}
                </Button>
              </form>
            </Form>
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