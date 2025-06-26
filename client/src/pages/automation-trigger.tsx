import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { User, Calendar, Link as LinkIcon, Plus, Trash2, Send, RotateCcw, Loader2, History } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import providerloopLogo from "@assets/image_1750647678847.png";

const automationFormSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  dob: z.string().min(1, "Date of birth is required"),
  chain_to_run: z.string().min(1, "Chain to run is required"),
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
  const { toast } = useToast();

  // Database queries
  const { data: automationLogs = [], isLoading: isLoadingLogs } = useQuery({
    queryKey: ['/api/automation-logs'],
    queryFn: () => fetch('/api/automation-logs').then(res => res.json()),
    staleTime: 0,
    cacheTime: 0,
  });

  const { data: customChains = [] } = useQuery({
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

  const createChainMutation = useMutation({
    mutationFn: async (chainData: any) => {
      const response = await fetch('/api/custom-chains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chainData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to create chain');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/custom-chains'] });
    },
    onError: (error) => {
      console.error('Chain creation error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add custom chain",
        variant: "destructive",
      });
    }
  });

  const form = useForm<AutomationFormValues>({
    resolver: zodResolver(automationFormSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      dob: "",
      chain_to_run: "ATTACHMENT PROCESSING (LABS)",
      source_id: "",
      first_step_user_input: "",
    },
  });

  // Auto-generate Source ID when patient info changes
  useEffect(() => {
    const firstName = form.watch("first_name");
    const lastName = form.watch("last_name");
    const dob = form.watch("dob");

    if (firstName && lastName && dob) {
      // Convert names to use underscores for spaces
      const formattedFirstName = firstName.trim().replace(/\s+/g, '_');
      const formattedLastName = lastName.trim().replace(/\s+/g, '_');
      
      // Format DOB from YYYY-MM-DD to MM_DD_YYYY
      const dobFormatted = dob.split('-').length === 3 
        ? `${dob.split('-')[1]}_${dob.split('-')[2]}_${dob.split('-')[0]}`
        : dob.replace(/\//g, '_');
      
      const sourceId = `${formattedLastName}_${formattedFirstName}__${dobFormatted}`;
      form.setValue("source_id", sourceId);
    }
  }, [form.watch("first_name"), form.watch("last_name"), form.watch("dob")]);

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
    const trimmedName = newChainName.trim();
    
    if (!trimmedName) {
      toast({
        title: "Invalid Input",
        description: "Chain name cannot be empty",
        variant: "destructive",
      });
      return;
    }
    
    if (customChains.some((chain: any) => chain.name === trimmedName)) {
      toast({
        title: "Chain Already Exists",
        description: `"${trimmedName}" already exists in your chains`,
        variant: "destructive",
      });
      return;
    }
    
    try {
      await createChainMutation.mutateAsync({ name: trimmedName });
      form.setValue("chain_to_run", trimmedName);
      setNewChainName("");
      setShowCustomInput(false);
      toast({
        title: "Chain Added",
        description: `"${trimmedName}" has been added to your chains`,
        variant: "default",
      });
    } catch (error) {
      // Error handling is now in the mutation's onError
      console.error('Error adding chain:', error);
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
      run_email: "jeffrey.Bander@providerloop.com", // Fixed email for patient data processing
      chain_to_run: data.chain_to_run,
      human_readable_record: "external app",
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
        addLogEntry({ run_email: "jeffrey.Bander@providerloop.com", chain_to_run: data.chain_to_run }, errorResponse, 'error');
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
              <div className="bg-white rounded-lg p-2 shadow-sm">
                <img src={providerloopLogo} alt="Providerloop" className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Providerloop Chains</h1>
                <p className="text-sm text-gray-600">Patient Data Chain Processing</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Link href="/logs">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center space-x-2"
                  disabled={isLoadingLogs}
                >
                  {isLoadingLogs ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <History className="h-4 w-4" />
                  )}
                  <span>
                    View Logs {isLoadingLogs ? '' : `(${automationLogs.length})`}
                  </span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Patient Data Form */}
        <Card className="shadow-sm">
          <CardHeader className="bg-gray-50 border-b">
            <CardTitle className="text-lg">Patient Information</CardTitle>
            <CardDescription>
              Enter patient details to process data through automation chains
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Patient Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Last Name */}
                  <FormField
                    control={form.control}
                    name="last_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center space-x-2">
                          <User className="h-4 w-4" />
                          <span>Last Name <span className="text-red-500">*</span></span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter last name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* First Name */}
                  <FormField
                    control={form.control}
                    name="first_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center space-x-2">
                          <User className="h-4 w-4" />
                          <span>First Name <span className="text-red-500">*</span></span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter first name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Date of Birth */}
                  <FormField
                    control={form.control}
                    name="dob"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4" />
                          <span>Date of Birth <span className="text-red-500">*</span></span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Source ID - Auto-generated */}
                <FormField
                  control={form.control}
                  name="source_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Generated Source ID</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          readOnly
                          className="bg-gray-50 text-gray-700"
                          placeholder="Source ID will be auto-generated from patient info"
                        />
                      </FormControl>
                      <FormDescription>
                        Format: LAST_FIRST__MM_DD_YYYY (auto-generated from patient information)
                      </FormDescription>
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
                          <LinkIcon className="h-4 w-4" />
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
                        disabled={!newChainName.trim() || createChainMutation.isPending}
                      >
                        {createChainMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Add"
                        )}
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

        {/* Real-Time Processing Status */}
        <Card className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg text-blue-900">
              <span>Real-Time Processing Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-3">Integration Details:</h4>
              <div className="space-y-2 text-sm text-blue-800">
                <div><strong>Agent Webhook URL:</strong></div>
                <div className="bg-blue-100 p-2 rounded font-mono text-xs break-all">
                  {window.location.origin}/webhook/agents
                </div>
                <div><strong>Response Format:</strong> JSON payload with all chain variables</div>
                <div><strong>Display:</strong> Real-time API Response with webhook payload data</div>
              </div>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <div className="text-sm text-green-800">
                  <strong>Status:</strong> Real-time webhook integration active. API responses appear instantly with complete payload data - no email processing needed.
                </div>
              </div>
            </div>
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