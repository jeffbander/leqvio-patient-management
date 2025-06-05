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
import { Mail, CheckCircle } from "lucide-react";
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
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
                    className="w-full"
                  >
                    Login to AIGENTS Automations
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-6xl px-4 grid lg:grid-cols-2 gap-8 items-center">
        {/* Login Form */}
        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <img src="/assets/aigents-logo.png" alt="AIGENTS" className="h-6 w-6" />
              Login to AIGENTS Automations
            </CardTitle>
            <CardDescription>
              Enter your email to receive a secure login link
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
                  className="w-full"
                  disabled={sendMagicLinkMutation.isPending}
                >
                  {sendMagicLinkMutation.isPending ? "Sending..." : "Send Magic Link"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Hero Section */}
        <div className="text-center lg:text-left space-y-6">
          <div className="space-y-4">
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white">
              AIGENTS Automations
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Intelligent automation platform for streamlined workflow integrations and real-time tracking
            </p>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-blue-500"></div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Real-time Automation Tracking
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Monitor your automation chains with unique ID-based tracking and live logs
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-green-500"></div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Email Response Integration
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Automatically capture and link email responses to your automation workflows
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-purple-500"></div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Secure Access
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Magic link authentication ensures secure, passwordless access to your automations
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}