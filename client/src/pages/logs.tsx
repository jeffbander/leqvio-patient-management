import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { History, Download, Trash2, Filter, Search, Calendar, User, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export default function LogsPage() {
  const [sortBy, setSortBy] = useState<string>("timestamp");
  const [filterChain, setFilterChain] = useState<string>("all");
  const [searchSourceId, setSearchSourceId] = useState<string>("");
  const { toast } = useToast();

  // Fetch automation logs
  const { data: automationLogs = [], isLoading } = useQuery({
    queryKey: ['/api/automation-logs'],
    queryFn: () => fetch('/api/automation-logs').then(res => res.json()),
    staleTime: 0,
    cacheTime: 0,
  });

  // Clear logs mutation
  const clearLogsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/automation-logs', { method: 'DELETE' });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/automation-logs'] });
      toast({
        title: "Logs Cleared",
        description: "All automation logs have been cleared",
        variant: "default",
      });
    }
  });

  // Get unique chains for filter dropdown
  const uniqueChains = [...new Set(automationLogs.map((log: any) => log.chainname))];

  // Filter and sort logs
  const filteredAndSortedLogs = automationLogs
    .filter((log: any) => {
      const chainMatch = filterChain === "all" || log.chainname === filterChain;
      const sourceIdMatch = !searchSourceId || (log.requestdata?.source_id || "").toLowerCase().includes(searchSourceId.toLowerCase());
      return chainMatch && sourceIdMatch;
    })
    .sort((a: any, b: any) => {
      switch (sortBy) {
        case "sourceId":
          const sourceIdA = a.requestdata?.source_id || "";
          const sourceIdB = b.requestdata?.source_id || "";
          return sourceIdA.localeCompare(sourceIdB);
        case "chain":
          return a.chainname.localeCompare(b.chainname);
        case "status":
          return a.status.localeCompare(b.status);
        case "timestamp":
        default:
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      }
    });

  const exportLogs = () => {
    const logData = JSON.stringify(filteredAndSortedLogs, null, 2);
    const blob = new Blob([logData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `providerloop-logs-${new Date().toISOString().split('T')[0]}.json`;
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

  const clearLogs = async () => {
    if (confirm("Are you sure you want to clear all logs? This action cannot be undone.")) {
      await clearLogsMutation.mutateAsync();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <History className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Processing Logs</h1>
                <p className="text-sm text-gray-600">View and manage patient data processing history</p>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              {filteredAndSortedLogs.length} of {automationLogs.length} logs
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters and Controls */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center space-x-2">
              <Filter className="h-5 w-5" />
              <span>Filter & Sort</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search by Source ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Source ID
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Enter Source ID..."
                    value={searchSourceId}
                    onChange={(e) => setSearchSourceId(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Filter by Chain */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by Chain
                </label>
                <Select value={filterChain} onValueChange={setFilterChain}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select chain" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Chains</SelectItem>
                    {uniqueChains.map((chain) => (
                      <SelectItem key={chain} value={chain}>
                        {chain}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sort By */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sort By
                </label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="timestamp">Latest First</SelectItem>
                    <SelectItem value="sourceId">Source ID</SelectItem>
                    <SelectItem value="chain">Chain Name</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Actions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Actions
                </label>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportLogs}
                    disabled={filteredAndSortedLogs.length === 0}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Export
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearLogs}
                    disabled={automationLogs.length === 0}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logs Display */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Processing History</CardTitle>
            <CardDescription>
              Patient data processing logs with detailed information
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">
                Loading logs...
              </div>
            ) : filteredAndSortedLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                {automationLogs.length === 0 ? (
                  <>
                    <p>No processing logs yet</p>
                    <p className="text-sm">Process patient data to see logs here</p>
                  </>
                ) : (
                  <>
                    <p>No logs match your filters</p>
                    <p className="text-sm">Try adjusting your search criteria</p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {filteredAndSortedLogs.map((log: any) => (
                  <div
                    key={log.id}
                    className={`border rounded-lg p-4 ${
                      log.status === 'success' 
                        ? 'border-green-200 bg-green-50' 
                        : 'border-red-200 bg-red-50'
                    }`}
                  >
                    {/* Log Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          log.status === 'success' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {log.status}
                        </span>
                        <span className="text-sm font-medium text-gray-900">{log.chainname}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                      {log.uniqueid && (
                        <div className="text-xs text-gray-500 font-mono">
                          ID: {log.uniqueid}
                        </div>
                      )}
                    </div>

                    {/* Patient/Source Info */}
                    {log.requestdata?.source_id && (
                      <div className="mb-3 p-3 bg-white border border-gray-200 rounded">
                        <div className="flex items-center space-x-2 mb-2">
                          <User className="h-4 w-4 text-gray-600" />
                          <span className="text-sm font-medium text-gray-700">Patient Information</span>
                        </div>
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Source ID:</span> {log.requestdata.source_id}
                        </div>
                        {log.requestdata.first_step_user_input && (
                          <div className="text-sm text-gray-600 mt-1">
                            <span className="font-medium">Notes:</span> {log.requestdata.first_step_user_input}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Webhook/Agent Response */}
                    {(log.webhookpayload || log.emailresponse) && (
                      <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded">
                        <div className="flex items-center space-x-2 mb-2">
                          <Link2 className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-800">
                            {log.webhookpayload ? 'API Response Received' : 'Email Response Received'}
                          </span>
                        </div>
                        <div className="text-xs text-blue-700 mb-2">
                          {log.webhookpayload ? 
                            (log.agentreceivedat ? new Date(log.agentreceivedat).toLocaleString() : 'Recent') :
                            (log.emailreceivedat ? new Date(log.emailreceivedat).toLocaleString() : 'Recent')
                          }
                        </div>
                        <details className="text-xs">
                          <summary className="cursor-pointer text-blue-600 hover:text-blue-800 mb-2">
                            {log.webhookpayload ? 'View API Payload' : 'View Email Content'}
                          </summary>
                          <div className="mt-2 p-3 bg-white rounded border text-sm max-h-64 overflow-y-auto">
                            {log.webhookpayload ? (
                              <div className="space-y-2">
                                {Object.entries(log.webhookpayload).map(([key, value]) => (
                                  <div key={key} className="border-b border-gray-100 pb-1">
                                    <div className="font-medium text-blue-800 text-xs">{key}:</div>
                                    <div className="text-blue-600 text-xs whitespace-pre-wrap break-words">
                                      {String(value)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="whitespace-pre-wrap font-mono text-xs">
                                {log.emailresponse}
                              </div>
                            )}
                          </div>
                        </details>
                      </div>
                    )}

                    {/* Agent Response */}
                    {log.agentresponse && (
                      <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded">
                        <div className="flex items-center space-x-2 mb-2">
                          <Calendar className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-green-800">Agent Response</span>
                        </div>
                        <div className="text-xs text-green-700 mb-2">
                          From: {log.agentname || 'Unknown Agent'} • {new Date(log.agentreceivedat).toLocaleString()}
                        </div>
                        <details className="text-xs">
                          <summary className="cursor-pointer text-green-600 hover:text-green-800 mb-2">
                            View Agent Response
                          </summary>
                          <div className="mt-2 p-3 bg-white rounded border text-sm max-h-64 overflow-y-auto">
                            <div className="whitespace-pre-wrap font-mono text-xs">
                              {log.agentresponse}
                            </div>
                          </div>
                        </details>
                      </div>
                    )}
                    
                    {/* API Response */}
                    <details className="text-xs">
                      <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                        View Raw API Response
                      </summary>
                      <div className="mt-2 p-3 bg-gray-100 rounded font-mono text-xs overflow-x-auto max-h-32 overflow-y-auto">
                        {log.response}
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}