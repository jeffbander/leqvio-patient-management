import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { History, Search, Filter, Download, Trash2, ArrowUpDown, Calendar, User, Link as LinkIcon, Loader2, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import providerloopLogo from "@assets/image_1750647678847.png";

export default function LogsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [chainFilter, setChainFilter] = useState("all");
  const [dateRange, setDateRange] = useState("3days");
  const [sortBy, setSortBy] = useState("timestamp-desc");
  const { toast } = useToast();

  // Database queries with date range filtering
  const { 
    data: automationLogs = [], 
    refetch: refetchLogs,
    isLoading: isLoadingLogs,
    isFetching: isFetchingLogs 
  } = useQuery({
    queryKey: ['/api/automation-logs', dateRange],
    queryFn: () => {
      const params = new URLSearchParams();
      if (dateRange !== 'all') {
        params.set('dateRange', dateRange);
      }
      return fetch(`/api/automation-logs?${params.toString()}`).then(res => res.json());
    },
    staleTime: 0,
    cacheTime: 0,
  });

  const { data: customChains = [] } = useQuery({
    queryKey: ['/api/custom-chains'],
    queryFn: () => fetch('/api/custom-chains').then(res => res.json()),
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
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to clear logs",
        variant: "destructive",
      });
    }
  });

  // Get unique chains for filter
  const uniqueChains = useMemo(() => {
    const chains = automationLogs.map((log: any) => log.chainname || log.chainName).filter(Boolean);
    return [...new Set(chains)];
  }, [automationLogs]);

  // Filter and sort logs
  const filteredAndSortedLogs = useMemo(() => {
    let filtered = automationLogs.filter((log: any) => {
      const matchesSearch = searchTerm === "" || 
        (log.uniqueid && log.uniqueid.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.chainname && log.chainname.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesChain = chainFilter === "all" || log.chainname === chainFilter;
      
      // Date filtering is now handled server-side
      return matchesSearch && matchesChain;
    });

    // Sort the filtered logs
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "timestamp-desc":
          return new Date(b.timestamp || b.createdAt).getTime() - new Date(a.timestamp || a.createdAt).getTime();
        case "timestamp-asc":
          return new Date(a.timestamp || a.createdAt).getTime() - new Date(b.timestamp || b.createdAt).getTime();
        case "sourceid-asc":
          return (a.uniqueid || "").localeCompare(b.uniqueid || "");
        case "sourceid-desc":
          return (b.uniqueid || "").localeCompare(a.uniqueid || "");
        case "chain-asc":
          return (a.chainname || "").localeCompare(b.chainname || "");
        case "chain-desc":
          return (b.chainname || "").localeCompare(a.chainname || "");
        case "status-success":
          return a.status === "success" ? -1 : b.status === "success" ? 1 : 0;
        case "status-error":
          return a.status === "error" ? -1 : b.status === "error" ? 1 : 0;
        default:
          return 0;
      }
    });

    return sorted;
  }, [automationLogs, searchTerm, chainFilter, sortBy]);

  const exportLogs = () => {
    const logData = JSON.stringify(filteredAndSortedLogs, null, 2);
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
              <div className="bg-white rounded-lg p-2 shadow-sm">
                <img src={providerloopLogo} alt="Providerloop" className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Processing Logs</h1>
                <p className="text-sm text-gray-600">View and manage patient data processing history</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                {filteredAndSortedLogs.length} of {automationLogs.length} logs
              </div>
              <Link href="/">
                <Button variant="outline" size="sm">
                  ← Back to Main
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters and Controls */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Filter className="h-5 w-5" />
                <span className="text-lg font-semibold">Filter & Sort Options</span>
              </div>
              <div className="flex items-center space-x-2">
                {automationLogs.length > 0 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportLogs}
                      disabled={isLoadingLogs}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Export JSON
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearLogs}
                      disabled={clearLogsMutation.isPending}
                    >
                      {clearLogsMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-1" />
                      )}
                      Clear All
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchLogs()}
                  disabled={isFetchingLogs}
                >
                  {isFetchingLogs ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1" />
                  )}
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              {/* Search Input */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search by Source ID or Chain name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Date Range Filter */}
              <div className="sm:w-40">
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger>
                    <Calendar className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Date range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1day">Last Day</SelectItem>
                    <SelectItem value="3days">Last 3 Days</SelectItem>
                    <SelectItem value="week">Last Week</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Chain Filter */}
              <div className="sm:w-48">
                <Select value={chainFilter} onValueChange={setChainFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by chain" />
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

              {/* Sort Options */}
              <div className="sm:w-48">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <ArrowUpDown className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="timestamp-desc">Newest First</SelectItem>
                    <SelectItem value="timestamp-asc">Oldest First</SelectItem>
                    <SelectItem value="sourceid-asc">Source ID A-Z</SelectItem>
                    <SelectItem value="sourceid-desc">Source ID Z-A</SelectItem>
                    <SelectItem value="chain-asc">Chain Name A-Z</SelectItem>
                    <SelectItem value="chain-desc">Chain Name Z-A</SelectItem>
                    <SelectItem value="status-success">Success First</SelectItem>
                    <SelectItem value="status-error">Errors First</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logs Display */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <History className="h-5 w-5" />
              <span className="text-lg font-semibold">Automation Logs</span>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {isLoadingLogs ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 mb-4">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  <span className="text-sm text-gray-600">Loading automation logs...</span>
                </div>
                {/* Loading skeletons */}
                {[1, 2, 3].map((i) => (
                  <div key={i} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Skeleton className="h-6 w-16" />
                        <Skeleton className="h-6 w-32" />
                      </div>
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ))}
              </div>
            ) : filteredAndSortedLogs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <History className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <h3 className="text-lg font-medium mb-2">No automation logs found</h3>
                <p className="text-sm">
                  {searchTerm || chainFilter || dateRange !== 'all' ? 
                    "Try adjusting your search criteria or filters" : 
                    "Trigger an automation to see logs here"
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {isFetchingLogs && (
                  <div className="flex items-center justify-center py-2 bg-blue-50 rounded-lg border border-blue-200">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500 mr-2" />
                    <span className="text-sm text-blue-700">Refreshing logs...</span>
                  </div>
                )}
                {filteredAndSortedLogs.map((log: any) => (
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
                    
                    {log.uniqueid && (
                      <div className="mb-2 text-xs text-gray-600">
                        <span className="font-medium">Chain Run ID:</span>
                        <div className="inline-block ml-2">
                          <a 
                            href={`https://aigents-realtime-logs-943506065004.us-central1.run.app/?chainRunId=${log.uniqueid}`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline font-mono"
                          >
                            {log.uniqueid}
                          </a>
                        </div>
                      </div>
                    )}
                    
                    {(log.webhookpayload || log.emailresponse) && (
                      <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded">
                        <div className="text-xs font-medium text-blue-800 mb-1">
                          {log.webhookpayload ? 'API Response Received:' : 'Email Response Received:'}
                        </div>
                        <div className="text-xs text-blue-700">
                          {log.webhookpayload ? 
                            (log.agentreceivedat ? new Date(log.agentreceivedat).toLocaleString() : 'Recent') :
                            (log.emailreceivedat ? new Date(log.emailreceivedat).toLocaleString() : 'Recent')
                          }
                        </div>
                        <details className="text-xs mt-1">
                          <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                            {log.webhookpayload ? 'View API Payload' : 'View Email Content'}
                          </summary>
                          <div className="mt-2 p-3 bg-white rounded border text-sm max-h-96 overflow-y-auto">
                            {log.webhookpayload ? (
                              <div className="space-y-3">
                                {Object.entries(log.webhookpayload).map(([key, value]) => (
                                  <div key={key} className="border-b border-gray-100 pb-2">
                                    <div className="font-medium text-blue-800 text-xs mb-1">{key}:</div>
                                    <div className="text-blue-600 text-xs whitespace-pre-wrap break-words bg-blue-25 p-2 rounded">
                                      {String(value)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : log.emailresponse?.includes('<') ? (
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
      </main>
    </div>
  );
}