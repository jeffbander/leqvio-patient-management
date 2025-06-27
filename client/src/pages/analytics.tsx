import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Activity, Clock, AlertTriangle, TrendingUp, Server, Users, Globe, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import providerloopLogo from "@assets/image_1750647678847.png";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState("24h");
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      summaryQuery.refetch();
      endpointsQuery.refetch();
      responseTimesQuery.refetch();
      errorsQuery.refetch();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const summaryQuery = useQuery({
    queryKey: ['/api/analytics/summary', timeRange],
    queryFn: () => fetch(`/api/analytics/summary?timeRange=${timeRange}`).then(res => res.json()),
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const endpointsQuery = useQuery({
    queryKey: ['/api/analytics/endpoints', timeRange],
    queryFn: () => fetch(`/api/analytics/endpoints?timeRange=${timeRange}`).then(res => res.json()),
  });

  const responseTimesQuery = useQuery({
    queryKey: ['/api/analytics/response-times', timeRange],
    queryFn: () => fetch(`/api/analytics/response-times?timeRange=${timeRange}`).then(res => res.json()),
  });

  const errorsQuery = useQuery({
    queryKey: ['/api/analytics/errors', timeRange],
    queryFn: () => fetch(`/api/analytics/errors?timeRange=${timeRange}`).then(res => res.json()),
  });

  const summary = summaryQuery.data || {};
  const endpoints = endpointsQuery.data || [];
  const responseTimes = responseTimesQuery.data || {};
  const errors = errorsQuery.data || {};

  const getTimeRangeLabel = (range: string) => {
    switch (range) {
      case '1h': return 'Last Hour';
      case '24h': return 'Last 24 Hours';
      case '7d': return 'Last 7 Days';
      case '30d': return 'Last 30 Days';
      default: return 'Last 24 Hours';
    }
  };

  const formatResponseTime = (time: number) => {
    if (time < 1000) return `${time}ms`;
    return `${(time / 1000).toFixed(2)}s`;
  };

  // Prepare chart data
  const endpointChartData = endpoints.slice(0, 10).map((endpoint: any) => ({
    name: `${endpoint.method} ${endpoint.endpoint}`,
    requests: endpoint.requests,
    success: endpoint.successfulRequests,
    errors: endpoint.errorRequests,
    avgTime: endpoint.avgResponseTime
  }));

  const responseTimeChartData = [
    { name: 'Min', time: responseTimes.min || 0 },
    { name: 'Avg', time: responseTimes.avg || 0 },
    { name: 'P95', time: responseTimes.p95 || 0 },
    { name: 'P99', time: responseTimes.p99 || 0 },
    { name: 'Max', time: responseTimes.max || 0 }
  ];

  const errorsPieData = Object.entries(errors.errorsByStatus || {}).map(([status, count]) => ({
    name: `HTTP ${status}`,
    value: count as number
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <img src={providerloopLogo} alt="Providerloop" className="h-8 w-auto" />
              <h1 className="text-xl font-semibold text-gray-900">AIGENTS Analytics</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">Last Hour</SelectItem>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
              
              <Button
                variant={autoRefresh ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                <Activity className="h-4 w-4 mr-2" />
                {autoRefresh ? "Live" : "Paused"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalRequests?.toLocaleString() || 0}</div>
              <p className="text-xs text-muted-foreground">
                {getTimeRangeLabel(timeRange)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.successRate || 0}%</div>
              <p className="text-xs text-muted-foreground">
                {summary.successfulRequests || 0} successful requests
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatResponseTime(summary.avgResponseTime || 0)}</div>
              <p className="text-xs text-muted-foreground">
                Average across all endpoints
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Error Requests</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.errorRequests || 0}</div>
              <p className="text-xs text-muted-foreground">
                {summary.uniqueEndpoints || 0} unique endpoints
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Endpoint Usage Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Endpoint Usage</CardTitle>
              <CardDescription>Request volume by endpoint ({getTimeRangeLabel(timeRange)})</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={endpointChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    fontSize={10}
                  />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="requests" fill="#8884d8" name="Total Requests" />
                  <Bar dataKey="success" fill="#82ca9d" name="Successful" />
                  <Bar dataKey="errors" fill="#ff7300" name="Errors" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Response Time Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Response Time Distribution</CardTitle>
              <CardDescription>Performance metrics ({getTimeRangeLabel(timeRange)})</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={responseTimeChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => [formatResponseTime(value as number), 'Response Time']} />
                  <Line type="monotone" dataKey="time" stroke="#8884d8" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Error Analysis and Chain Types */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Error Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Error Distribution</CardTitle>
              <CardDescription>HTTP status codes for failed requests</CardDescription>
            </CardHeader>
            <CardContent>
              {errorsPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={errorsPieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {errorsPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-500">
                  <div className="text-center">
                    <Server className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <p>No errors detected</p>
                    <p className="text-sm">All requests successful!</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Real-time Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Real-time Performance</CardTitle>
              <CardDescription>Current system metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Chain Types</span>
                  <Badge variant="secondary">{summary.chainTypes || 0}</Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Unique Endpoints</span>
                  <Badge variant="secondary">{summary.uniqueEndpoints || 0}</Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Min Response Time</span>
                  <Badge variant="outline">{formatResponseTime(responseTimes.min || 0)}</Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Max Response Time</span>
                  <Badge variant="outline">{formatResponseTime(responseTimes.max || 0)}</Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">P95 Response Time</span>
                  <Badge variant="outline">{formatResponseTime(responseTimes.p95 || 0)}</Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Errors</span>
                  <Badge variant={errors.totalErrors > 0 ? "destructive" : "secondary"}>
                    {errors.totalErrors || 0}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Status Indicator */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-green-100 text-green-800">
            <div className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
            <span className="text-sm font-medium">
              {autoRefresh ? 'Live Analytics' : 'Analytics Paused'} • Last updated: {new Date().toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}