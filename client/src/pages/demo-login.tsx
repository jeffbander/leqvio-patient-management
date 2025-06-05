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
import { Mail, CheckCircle, Key } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const demoLoginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  demoCode: z.string().min(1, "Demo code is required"),
});

type DemoLoginValues = z.infer<typeof demoLoginSchema>;

export default function DemoLoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<DemoLoginValues>({
    resolver: zodResolver(demoLoginSchema),
    defaultValues: {
      email: "",
      demoCode: "",
    },
  });

  const demoLoginMutation = useMutation({
    mutationFn: async (data: DemoLoginValues) => {
      const res = await apiRequest("POST", "/api/auth/demo-login", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/");
      toast({
        title: "Welcome to AIGENTS Automations",
        description: "You're now logged in and ready to trigger automations",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: DemoLoginValues) => {
    demoLoginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-6xl px-4 grid lg:grid-cols-2 gap-8 items-center">
        {/* Demo Login Form */}
        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <img src="/assets/aigents-logo.png" alt="AIGENTS" className="h-6 w-6" />
              Demo Access - AIGENTS Automations
            </CardTitle>
            <CardDescription>
              Enter your email and demo code to access the platform
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
                <FormField
                  control={form.control}
                  name="demoCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Demo Code</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="Enter demo code"
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
                  disabled={demoLoginMutation.isPending}
                >
                  {demoLoginMutation.isPending ? "Logging in..." : "Access Platform"}
                </Button>
              </form>
            </Form>
            
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="flex items-start gap-2">
                <Key className="h-4 w-4 mt-0.5 text-blue-600 dark:text-blue-400" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900 dark:text-blue-100">Demo Code: "demo123"</p>
                  <p className="text-blue-700 dark:text-blue-300">Use any valid email address with this demo code to access the platform</p>
                </div>
              </div>
            </div>
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
                  Demo Access Available
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Test the full platform functionality with our demo authentication system
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}