import { useState, useMemo } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Link } from 'wouter'
import { Badge } from '@/components/ui/badge'
import { UserPlus, Search, Eye, FileSpreadsheet, Download, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { format } from 'date-fns'
import { queryClient } from '@/lib/queryClient'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Patient {
  id: number
  firstName: string
  lastName: string
  dateOfBirth: string
  orderingMD: string
  diagnosis: string
  status: string
  createdAt: string
}

type SortField = 'firstName' | 'lastName' | 'dateOfBirth' | 'orderingMD' | 'diagnosis' | 'status' | 'createdAt'
type SortDirection = 'asc' | 'desc'

export default function PatientList() {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const { data: patients = [], isLoading } = useQuery<Patient[]>({
    queryKey: ['/api/patients'],
  })

  const { data: sheetsStatus } = useQuery({
    queryKey: ['/api/google-sheets/status'],
  })

  const syncToSheetsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/patients/sync-to-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to sync to Google Sheets')
      }
      return response.json()
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message || "Patients synced to Google Sheets successfully"
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      })
    }
  })

  const handleDownloadCSV = async () => {
    try {
      const response = await fetch('/api/patients/export/csv')
      if (!response.ok) {
        throw new Error('Failed to download CSV')
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `patients_export_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast({
        title: "Success",
        description: "Patient data exported successfully"
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export patient data",
        variant: "destructive"
      })
    }
  }

  const filteredAndSortedPatients = useMemo(() => {
    let filtered = patients.filter(patient => {
      const search = searchTerm.toLowerCase()
      const matchesSearch = (
        patient.firstName.toLowerCase().includes(search) ||
        patient.lastName.toLowerCase().includes(search) ||
        patient.orderingMD.toLowerCase().includes(search) ||
        patient.diagnosis.toLowerCase().includes(search)
      )
      const matchesStatus = statusFilter === 'all' || patient.status === statusFilter
      return matchesSearch && matchesStatus
    })

    // Sort the filtered results
    filtered.sort((a, b) => {
      let aValue: any = a[sortField]
      let bValue: any = b[sortField]

      // Handle date sorting
      if (sortField === 'createdAt' || sortField === 'dateOfBirth') {
        aValue = new Date(aValue).getTime()
        bValue = new Date(bValue).getTime()
      } else {
        aValue = aValue?.toString().toLowerCase() || ''
        bValue = bValue?.toString().toLowerCase() || ''
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    return filtered
  }, [patients, searchTerm, statusFilter, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />
    }
    return sortDirection === 'asc' ? 
      <ArrowUp className="ml-2 h-4 w-4" /> : 
      <ArrowDown className="ml-2 h-4 w-4" />
  }

  const uniqueStatuses = Array.from(new Set(patients.map(p => p.status)))

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending auth':
        return 'bg-orange-100 text-orange-800'
      case 'started':
        return 'bg-blue-100 text-blue-800'
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">LEQVIO Patient Management</h1>
        <p className="text-gray-600">View and manage all LEQVIO patients</p>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Search patients, providers, or diagnosis..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="w-48">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {uniqueStatuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleDownloadCSV}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          {(sheetsStatus as any)?.configured && (
            <Button 
              onClick={() => syncToSheetsMutation.mutate()}
              disabled={syncToSheetsMutation.isPending}
              variant="outline"
              className="flex items-center gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {syncToSheetsMutation.isPending ? 'Syncing...' : 'Sync to Sheets'}
            </Button>
          )}
          <Link href="/patient/new">
            <Button className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              New Patient
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">Loading patients...</p>
          </CardContent>
        </Card>
      ) : filteredAndSortedPatients.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">
              {searchTerm || statusFilter !== 'all' ? 'No patients found matching your filters.' : 'No patients found. Create your first patient to get started.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('lastName')}
                  >
                    <div className="flex items-center">
                      Patient Name
                      {getSortIcon('lastName')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('dateOfBirth')}
                  >
                    <div className="flex items-center">
                      Date of Birth
                      {getSortIcon('dateOfBirth')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('orderingMD')}
                  >
                    <div className="flex items-center">
                      Provider
                      {getSortIcon('orderingMD')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('diagnosis')}
                  >
                    <div className="flex items-center">
                      Diagnosis
                      {getSortIcon('diagnosis')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center">
                      Status
                      {getSortIcon('status')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('createdAt')}
                  >
                    <div className="flex items-center">
                      Created
                      {getSortIcon('createdAt')}
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedPatients.map((patient) => (
                  <TableRow key={patient.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">
                      {patient.lastName}, {patient.firstName}
                    </TableCell>
                    <TableCell>{patient.dateOfBirth}</TableCell>
                    <TableCell>{patient.orderingMD}</TableCell>
                    <TableCell>{patient.diagnosis}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(patient.status)}>
                        {patient.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(patient.createdAt), 'MM/dd/yyyy')}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/patient/${patient.id}`}>
                        <Button variant="outline" size="sm" className="flex items-center gap-2">
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}