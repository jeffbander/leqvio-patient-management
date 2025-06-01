import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Settings, Mail, Link, Folder, Tag, FileText, Plus, Trash2, Send, RotateCcw, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const automationFormSchema = z.object({
  run_email: z.string().email("Please enter a valid email address"),
  chain_to_run: z.string().min(1, "Chain to run is required"),
  folder_id: z.string().optional(),
  source_name: z.string().optional(),
  source_id: z.string().optional(),
  first_step_user_input: z.string().optional(),
});

type AutomationFormValues = z.infer<typeof automationFormSchema>;

interface Variable {
  key: string;
  value: string;
}

export default function AutomationTrigger() {
  const [variables, setVariables] = useState<Variable[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [responseStatus, setResponseStatus] = useState<'success' | 'error' | null>(null);
  const { toast } = useToast();

  const form = useForm<AutomationFormValues>({
    resolver: zodResolver(automationFormSchema),
    defaultValues: {
      run_email: "Mills.reed@mswheart.com",
      chain_to_run: "research study",
      folder_id: "",
      source_name: "",
      source_id: "",
      first_step_user_input: "",
    },
  });

  const addVariable = () => {
    setVariables([...variables, { key: "", value: "" }]);
  };

  const removeVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index));
  };

  const updateVariable = (index: number, field: keyof Variable, value: string) => {
    const updated = variables.map((variable, i) =>
      i === index ? { ...variable, [field]: value } : variable
    );
    setVariables(updated);
  };

  const onSubmit = async (data: AutomationFormValues) => {
    setIsLoading(true);
    setResponse(null);
    setResponseStatus(null);

    try {
      // Collect starting variables
      const starting_variables: Record<string, string> = {};
      variables.forEach(variable => {
        if (variable.key.trim() && variable.value.trim()) {
          starting_variables[variable.key.trim()] = variable.value.trim();
        }
      });

      // Prepare the request body
      const requestBody = {
        run_email: data.run_email,
        chain_to_run: data.chain_to_run,
        ...(data.folder_id && { folder_id: data.folder_id }),
        ...(data.source_name && { source_name: data.source_name }),
        ...(data.source_id && { source_id: data.source_id }),
        ...(data.first_step_user_input && { first_step_user_input: data.first_step_user_input }),
        starting_variables,
      };

      // Remove empty optional fields
      Object.keys(requestBody).forEach(key => {
        if (requestBody[key as keyof typeof requestBody] === "") {
          delete requestBody[key as keyof typeof requestBody];
        }
      });

      const response = await fetch("https://start-chain-run-943506065004.us-central1.run.app", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.text();
      setResponse(result);

      if (response.ok) {
        setResponseStatus('success');
        toast({
          title: "Success",
          description: "Research study triggered successfully!",
          variant: "default",
        });
      } else {
        setResponseStatus('error');
        toast({
          title: "Error",
          description: "Failed to trigger research study",
          variant: "destructive",
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      setResponse(`Error: ${errorMessage}`);
      setResponseStatus('error');
      toast({
        title: "Network Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    if (confirm("Are you sure you want to reset the form? All data will be lost.")) {
      form.reset();
      setVariables([]);
      setResponse(null);
      setResponseStatus(null);
      toast({
        title: "Form Reset",
        description: "Form has been reset",
        variant: "default",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-3">
            <div className="bg-primary text-primary-foreground rounded-lg p-2">
              <Settings className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Research Study Trigger</h1>
              <p className="text-sm text-gray-600">AppSheet Research Study Automation</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* API Endpoint Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
          <div className="flex items-center space-x-2 mb-2">
            <Info className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-blue-900">API Endpoint</h3>
          </div>
          <div className="text-sm text-blue-800">
            <span className="font-mono bg-blue-100 px-2 py-1 rounded">POST</span>
            <span className="ml-2">https://start-chain-run-943506065004.us-central1.run.app</span>
          </div>
        </div>

        {/* Automation Form */}
        <Card className="shadow-sm">
          <CardHeader className="bg-gray-50 border-b">
            <CardTitle className="text-lg">Trigger Research Study</CardTitle>
            <CardDescription>
              Fill out the form below to start your research study automation
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Email Field */}
                <FormField
                  control={form.control}
                  name="run_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center space-x-2">
                        <Mail className="h-4 w-4" />
                        <span>Run Email <span className="text-red-500">*</span></span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="Enter email address"
                          className="pl-10"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        The email that will trigger the research study
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Chain Selection */}
                <FormField
                  control={form.control}
                  name="chain_to_run"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center space-x-2">
                        <Link className="h-4 w-4" />
                        <span>Chain to Run <span className="text-red-500">*</span></span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., research study"
                          className="pl-10"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Optional Fields Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="folder_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center space-x-2">
                          <Folder className="h-4 w-4" />
                          <span>Folder ID <span className="text-gray-400">(Optional)</span></span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Optional folder identifier"
                            className="pl-10"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="source_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center space-x-2">
                          <Tag className="h-4 w-4" />
                          <span>Source ID</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="ID of triggering record"
                            className="pl-10"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Source Name Field */}
                <FormField
                  control={form.control}
                  name="source_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center space-x-2">
                        <FileText className="h-4 w-4" />
                        <span>Source Name</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Human readable trigger source reminder"
                          className="pl-10"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* First Step Input */}
                <FormField
                  control={form.control}
                  name="first_step_user_input"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Step User Input</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={4}
                          placeholder="Content for step 1 user input..."
                          className="resize-vertical"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Starting Variables */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <FormLabel>Starting Variables</FormLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addVariable}
                      className="text-primary border-primary hover:bg-blue-50"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Variable
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    {variables.map((variable, index) => (
                      <div key={index} className="flex gap-3 items-center">
                        <div className="flex-1">
                          <Input
                            placeholder="Variable key (e.g., var_1)"
                            value={variable.key}
                            onChange={(e) => updateVariable(index, "key", e.target.value)}
                            className="text-sm"
                          />
                        </div>
                        <div className="flex-1">
                          <Input
                            placeholder="Variable value"
                            value={variable.value}
                            onChange={(e) => updateVariable(index, "value", e.target.value)}
                            className="text-sm"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeVariable(index)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  
                  <FormDescription className="mt-2">
                    Add key-value pairs for variables that will be passed to the automation
                  </FormDescription>
                </div>

                {/* Form Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-200">
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 sm:flex-none"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Triggering...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Trigger Research Study
                      </>
                    )}
                  </Button>
                  
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetForm}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset Form
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Response Display */}
        {response && (
          <Card className="mt-8 shadow-sm">
            <CardHeader className="bg-gray-50 border-b">
              <CardTitle className="text-lg">Response</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div
                className={`font-mono text-sm rounded-lg p-4 overflow-x-auto ${
                  responseStatus === 'success'
                    ? 'bg-green-50 text-green-800'
                    : 'bg-red-50 text-red-800'
                }`}
              >
                {response}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
