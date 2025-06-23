import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Settings, Mail, Link, Folder, Tag, FileText, Plus, Trash2, Send, RotateCcw, Loader2, Info, History, Download, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

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

const CHAIN_OPTIONS = [
  {
    value: "ATTACHMENT PROCESSING (LABS)",
    label: "Attachment Processing (Labs)"
  },
  {
    value: "ATTACHMENT PROCESSING (SLEEP STUDY)",
    label: "Attachment Processing (Sleep Study)"
  },
  {
    value: "ATTACHMENT PROCESSING (RESEARCH STUDY)",
    label: "Attachment Processing (Research Study)"
  }
];

export default function AutomationTrigger() {
  const [variables, setVariables] = useState<Variable[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [responseStatus, setResponseStatus] = useState<'success' | 'error' | null>(null);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [newChainName, setNewChainName] = useState("");
  const [showLogs, setShowLogs] = useState(false);
  const { toast } = useToast();

  // Database queries
  const { data: automationLogs = [], refetch: refetchLogs } = useQuery({
    queryKey: ['/api/automation-logs'],
    queryFn: () => fetch('/api/automation-logs').then(res => res.json()),
    staleTime: 0,
    cacheTime: 0,
  });

  const { data: customChains = [], refetch: refetchChains } = useQuery({
    queryKey: ['/api/custom-chains'],
    queryFn: () => fetch('/api/custom-chains').then(res => res.json()),
  });

  // Mutations
  const createLogMutation = useMutation({
    mutationFn: async (logData: any) => {
      const response = await fetch('/api/automation-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData)
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/automation-logs'] });
    }
  });

  const clearLogsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/automation-logs', { method: 'DELETE' });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/automation-logs'] });
    }
  });

  const createChainMutation = useMutation({
    mutationFn: async (chainData: any) => {
      const response = await fetch('/api/custom-chains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chainData)
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/custom-chains'] });
    }
  });

  const form = useForm<AutomationFormValues>({
    resolver: zodResolver(automationFormSchema),
    defaultValues: {
      run_email: "Mills.reed@mswheart.com",
      chain_to_run: "ATTACHMENT PROCESSING (LABS)",
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

  const addCustomChain = async () => {
    if (newChainName.trim() && !customChains.some((chain: any) => chain.name === newChainName.trim())) {
      try {
        await createChainMutation.mutateAsync({ name: newChainName.trim() });
        form.setValue("chain_to_run", newChainName.trim());
        setNewChainName("");
        setShowCustomInput(false);
        toast({
          title: "Chain Added",
          description: `"${newChainName.trim()}" has been added to your chains`,
          variant: "default",
        });
      } catch (error) {
        console.error('Error adding chain:', error);
        toast({
          title: "Error",
          description: "Failed to add custom chain",
          variant: "destructive",
        });
      }
    }
  };

  const getAllChainOptions = () => {
    const allChains = [
      ...CHAIN_OPTIONS,
      ...customChains.map((chain: any) => ({ value: chain.name, label: chain.name }))
    ];
    return allChains;
  };

  const addLogEntry = async (requestData: any, response: string, status: 'success' | 'error', extractedChainRunId?: string) => {
    try {
      // Use the extracted ChainRun_ID or try to extract from response
      let uniqueId = extractedChainRunId || null;
      
      if (!uniqueId && status === 'success') {
        try {
          const responseObj = JSON.parse(response);
          // Look for ChainRun_ID first
          uniqueId = responseObj.ChainRun_ID;
          
          // Fallback to AppSheet response structure
          if (!uniqueId && responseObj.responses && responseObj.responses[0] && responseObj.responses[0].rows) {
            const firstRow = responseObj.responses[0].rows[0];
            uniqueId = firstRow["Run_ID"] || firstRow["_RowNumber"] || firstRow["ID"] || 
                      firstRow["Run_Auto_Key"] || firstRow["Chain_Run_Key"] || firstRow.id;
          }
          // Other fallbacks
          if (!uniqueId) {
            uniqueId = responseObj.id || responseObj.runId || responseObj.chainRunId || responseObj.uniqueId;
          }
        } catch (e) {
          // If response isn't JSON, try to extract ID with regex
          const idMatch = response.match(/[A-Za-z0-9\-_]{15,}/);
          if (idMatch) {
            uniqueId = idMatch[0];
          }
        }
      }

      await createLogMutation.mutateAsync({
        chainName: requestData.chain_to_run,
        email: requestData.run_email,
        status,
        response,
        requestData,
        uniqueId,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Failed to save log entry:', error);
    }
  };

  const clearLogs = async () => {
    try {
      await clearLogsMutation.mutateAsync();
      toast({
        title: "Logs Cleared",
        description: "All automation logs have been cleared",
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear logs",
        variant: "destructive",
      });
    }
  };

  const exportLogs = () => {
    const logData = JSON.stringify(automationLogs, null, 2);
    const blob = new Blob([logData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `automation-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: "Logs Exported",
      description: "Logs have been downloaded as JSON file",
      variant: "default",
    });
  };

  const onSubmit = async (data: AutomationFormValues) => {
    setIsLoading(true);
    setResponse(null);
    setResponseStatus(null);

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

    try {
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
        
        // Extract ChainRun_ID from the API response
        let chainRunId = '';
        try {
          const chainRunMatch = result.match(/"ChainRun_ID"\s*:\s*"([^"]+)"/);
          if (chainRunMatch) {
            chainRunId = chainRunMatch[1];
          }
        } catch (e) {
          console.log('Could not extract ChainRun_ID from response');
        }
        
        addLogEntry(requestBody, result, 'success', chainRunId);
        toast({
          title: "Success",
          description: "Automation triggered successfully!",
          variant: "default",
        });
      } else {
        setResponseStatus('error');
        addLogEntry(requestBody, result, 'error', '');
        toast({
          title: "Error",
          description: "Failed to trigger automation",
          variant: "destructive",
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      const errorResponse = `Error: ${errorMessage}`;
      setResponse(errorResponse);
      setResponseStatus('error');
      try {
        addLogEntry(requestBody, errorResponse, 'error');
      } catch {
        // If requestBody is not available, create a minimal log entry
        addLogEntry({ run_email: data.run_email, chain_to_run: data.chain_to_run }, errorResponse, 'error');
      }
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
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-primary text-primary-foreground rounded-lg p-2">
                <img src="/assets/aigents-logo.png" alt="AIGENTS" className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">AIGENTS Automations</h1>
                <p className="text-sm text-gray-600">Intelligent Workflow Automation Platform</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLogs(!showLogs)}
                className="flex items-center space-x-2"
              >
                <History className="h-4 w-4" />
                <span>Logs ({automationLogs.length})</span>
              </Button>
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
            <CardTitle className="text-lg">Trigger Automation</CardTitle>
            <CardDescription>
              Fill out the form below to start your AppSheet automation chain
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
                        The email that will trigger the automation
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
                      <FormLabel className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Link className="h-4 w-4" />
                          <span>Chain to Run <span className="text-red-500">*</span></span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowCustomInput(true)}
                          className="text-xs"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Custom
                        </Button>
                      </FormLabel>
                      <FormControl>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a chain to run" />
                          </SelectTrigger>
                          <SelectContent>
                            {getAllChainOptions().map((chain) => (
                              <SelectItem key={chain.value} value={chain.value}>
                                {chain.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormDescription>
                        Choose which automation chain to trigger
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Custom Chain Input */}
                {showCustomInput && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Plus className="h-4 w-4 text-blue-600" />
                      <h4 className="text-sm font-medium text-blue-900">Add Custom Chain</h4>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter chain name..."
                        value={newChainName}
                        onChange={(e) => setNewChainName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addCustomChain()}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        onClick={addCustomChain}
                        size="sm"
                        disabled={!newChainName.trim()}
                      >
                        Add
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowCustomInput(false);
                          setNewChainName("");
                        }}
                        size="sm"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

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
                        Trigger Automation
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

        {/* Email Integration Setup Instructions */}
        <Card className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center space-x-2 text-blue-900">
              <Mail className="h-5 w-5" />
              <span>Automated Email Response Integration</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-3">How It Works:</h4>
              <div className="space-y-3 text-sm text-blue-800">
                <div className="flex items-start space-x-2">
                  <div className="bg-blue-100 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">1</div>
                  <div>
                    <strong>API Trigger:</strong> When you submit an automation, the system automatically extracts the unique ChainRun_ID from the AppSheet API response (e.g., "64abf335").
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="bg-blue-100 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">2</div>
                  <div>
                    <strong>ID Storage:</strong> The ChainRun_ID is immediately saved with your automation log for tracking.
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="bg-blue-100 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">3</div>
                  <div>
                    <strong>AppSheet Processing:</strong> Your automation chain runs in AppSheet and generates results.
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="bg-blue-100 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">4</div>
                  <div>
                    <strong>Agent Processing:</strong> Agents system processes the automation and sends webhook with results.
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="bg-blue-100 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">5</div>
                  <div>
                    <strong>Real-time Results:</strong> Webhook payload shows all variables and outputs in the UI instantly.
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="bg-blue-100 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">6</div>
                  <div>
                    <strong>End-to-End Complete:</strong> No email needed - all results displayed in real-time dashboard.
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Current Configuration:</h4>
              <div className="space-y-2 text-sm text-blue-800">
                <div><strong>Webhook URL:</strong></div>
                <div className="bg-blue-100 p-2 rounded font-mono text-xs break-all">
                  {window.location.origin}/api/email-webhook
                </div>
                <div><strong>Email Destination:</strong> automation-responses@responses.providerloop.com</div>
                <div><strong>Pattern Recognition:</strong> Automatically detects "Output from run (ChainRun_ID)" format</div>
              </div>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <div className="text-sm text-green-800">
                  <strong>Status:</strong> Fully automated - no manual intervention required. Each automation automatically captures its unique ID and links email responses when they arrive.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logs Panel */}
        {showLogs && (
          <Card className="mt-8 shadow-sm">
            <CardHeader className="bg-gray-50 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center space-x-2">
                  <History className="h-5 w-5" />
                  <span>Automation Logs</span>
                </CardTitle>
                <div className="flex items-center space-x-2">
                  {automationLogs.length > 0 && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportLogs}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Export
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearLogs}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Clear
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowLogs(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {automationLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No automation logs yet</p>
                  <p className="text-sm">Trigger an automation to see logs here</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {automationLogs.map((log: any) => (
                    <div
                      key={log.id}
                      className={`border rounded-lg p-4 ${
                        log.status === 'success' 
                          ? 'border-green-200 bg-green-50' 
                          : 'border-red-200 bg-red-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            log.status === 'success' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {log.status}
                          </span>
                          <span className="text-sm font-medium">{log.chainname}</span>
                        </div>
                        <span className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="text-sm text-gray-600 mb-2">
                        Email: {log.email}
                        {log.uniqueid && (
                          <div className="text-xs mt-1">
                            ID: <a 
                              href={`https://aigents-realtime-logs-943506065004.us-central1.run.app/?chainRunId=${log.uniqueid}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                            >
                              {log.uniqueid}
                            </a>
                          </div>
                        )}
                      </div>
                      
                      {log.emailresponse && (
                        <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded">
                          <div className="text-xs font-medium text-blue-800 mb-1">
                            Email Response Received:
                          </div>
                          <div className="text-xs text-blue-700">
                            {new Date(log.emailreceivedat).toLocaleString()}
                          </div>
                          <details className="text-xs mt-1">
                            <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                              View Email Content
                            </summary>
                            <div className="mt-2 p-3 bg-white rounded border text-sm max-h-96 overflow-y-auto">
                              {log.emailresponse?.includes('<') ? (
                                <div dangerouslySetInnerHTML={{ __html: log.emailresponse }} />
                              ) : (
                                <div className="whitespace-pre-wrap font-mono text-xs">
                                  {log.emailresponse}
                                </div>
                              )}
                            </div>
                          </details>
                        </div>
                      )}

                      {log.agentresponse && (
                        <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded">
                          <div className="text-xs font-medium text-green-800 mb-1">
                            Agent Response Received:
                          </div>
                          <div className="text-xs text-green-700 mb-1">
                            From: {log.agentname || 'Unknown Agent'}
                          </div>
                          <div className="text-xs text-green-700">
                            {new Date(log.agentreceivedat).toLocaleString()}
                          </div>
                          <details className="text-xs mt-1">
                            <summary className="cursor-pointer text-green-600 hover:text-green-800">
                              View Agent Response
                            </summary>
                            <div className="mt-2 p-3 bg-white rounded border text-sm max-h-96 overflow-y-auto">
                              <div className="whitespace-pre-wrap font-mono text-xs">
                                {log.agentresponse}
                              </div>
                            </div>
                          </details>
                        </div>
                      )}
                      
                      <details className="text-xs">
                        <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                          View API Response
                        </summary>
                        <div className="mt-2 p-2 bg-gray-100 rounded font-mono text-xs overflow-x-auto">
                          {log.response}
                        </div>
                      </details>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
