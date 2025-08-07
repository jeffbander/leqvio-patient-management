import { useState, useMemo } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Link } from 'wouter'
import { Badge } from '@/components/ui/badge'
import { UserPlus, Search, Eye, FileSpreadsheet, Download, ArrowUpDown, ArrowUp, ArrowDown, Mic, Calendar } from 'lucide-react'
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
  mrn?: string
  authNumber?: string
  refNumber?: string
  startDate?: string
  endDate?: string
  authStatus?: string
  scheduleStatus?: string
  doseNumber?: number
  notes?: string
  lastVoicemailAt?: string
  createdAt: string
}

type SortField = 'firstName' | 'lastName' | 'dateOfBirth' | 'orderingMD' | 'diagnosis' | 'status' | 'createdAt'
type SortDirection = 'asc' | 'desc'

interface PatientRowProps {
  patient: Patient
  onAuthStatusChange: (patientId: number, newStatus: string) => void
  onScheduleStatusChange: (patientId: number, newStatus: string) => void
  onDoseNumberChange: (patientId: number, newDose: number) => void
  onRecordVoicemail: () => void
  onAppointmentStatusChange: (appointmentId: number, status: string, patientId: number) => void
}

// Helper functions for status styling
const getAuthStatusColor = (status: string) => {
  switch (status) {
    case 'Approved':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'No PA Required':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'Denied':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'Pending Review':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'Pending More Info':
      return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'Needs Renewal':
      return 'bg-purple-100 text-purple-800 border-purple-200'
    case 'APT SCHEDULED W/O AUTH':
      return 'bg-red-100 text-red-800 border-red-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

const getScheduleStatusColor = (status: string) => {
  switch (status) {
    case 'Scheduled':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'Needs Scheduling':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'Needs Scheduling–High Priority':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'Needs Rescheduling':
      return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'Pending Auth':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

const getAppointmentStatusColor = (status: string) => {
  switch (status) {
    case 'Completed':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'Scheduled':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'Cancelled':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'No Show':
      return 'bg-orange-100 text-orange-800 border-orange-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

const PatientRow = ({ patient, onAuthStatusChange, onScheduleStatusChange, onDoseNumberChange, onRecordVoicemail, onAppointmentStatusChange }: PatientRowProps) => {
  // Get appointments for this patient
  const { data: appointments = [] } = useQuery({
    queryKey: ['/api/appointments', patient.id],
    queryFn: async () => {
      const response = await fetch(`/api/patients/${patient.id}/appointments`)
      if (!response.ok) throw new Error('Failed to fetch appointments')
      return response.json()
    }
  })

  // Get documents for this patient to show real documentation status
  const { data: documents = [] } = useQuery({
    queryKey: ['/api/patients', patient.id, 'documents'],
    queryFn: async () => {
      const response = await fetch(`/api/patients/${patient.id}/documents`)
      if (!response.ok) return []
      return response.json()
    }
  })

  const getLastAppointment = () => {
    const today = new Date()
    const pastAppointments = appointments
      .filter((apt: any) => new Date(apt.appointmentDate) <= today)
      .sort((a: any, b: any) => new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime())
    return pastAppointments[0] || null
  }

  const getNextAppointment = () => {
    const today = new Date()
    const futureAppointments = appointments
      .filter((apt: any) => new Date(apt.appointmentDate) > today)
      .sort((a: any, b: any) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime())
    return futureAppointments[0] || null
  }

  const lastAppointment = getLastAppointment()
  const nextAppointment = getNextAppointment()
  
  // Check if row should be flagged (light red background)
  const isRowFlagged = patient.authStatus === 'APT SCHEDULED W/O AUTH'
  
  // Get notes preview (first 3 lines of last paragraph)
  const getNotesPreview = () => {
    if (!patient.notes) return ''
    const paragraphs = patient.notes.split('\n\n')
    const lastParagraph = paragraphs[paragraphs.length - 1]
    const lines = lastParagraph.split('\n')
    return lines.slice(0, 3).join('\n')
  }

  const authStatusOptions = [
    'Pending Review',
    'No PA Required',
    'Approved', 
    'Denied',
    'Pending More Info',
    'Needs Renewal',
    'APT SCHEDULED W/O AUTH'
  ]

  const scheduleStatusOptions = [
    'Pending Auth',
    'Scheduled',
    'Needs Scheduling',
    'Needs Scheduling–High Priority',
    'Needs Rescheduling'
  ]

  return (
    <TableRow 
      className={`hover:bg-gray-50 ${isRowFlagged ? 'bg-red-50' : ''}`}
    >
      {/* Patient Info */}
      <TableCell className="font-medium">
        <div>
          <div className="font-semibold">{patient.lastName}, {patient.firstName}</div>
          {patient.mrn && <div className="text-sm text-gray-600">MRN: {patient.mrn}</div>}
          <div className="text-sm text-gray-600">DOB: {patient.dateOfBirth}</div>
        </div>
      </TableCell>

      {/* Auth Status */}
      <TableCell>
        <Select 
          value={patient.authStatus || 'Pending Review'} 
          onValueChange={(value) => onAuthStatusChange(patient.id, value)}
        >
          <SelectTrigger className="w-full border-none bg-transparent p-0 h-auto hover:bg-transparent">
            <SelectValue>
              <Badge className={`${getAuthStatusColor(patient.authStatus || 'Pending Review')} border text-xs cursor-pointer hover:opacity-80`}>
                {patient.authStatus || 'Pending Review'}
              </Badge>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {authStatusOptions.map(option => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      {/* Auth Info */}
      <TableCell className="text-sm">
        <div className="space-y-1">
          <div>Start: {patient.startDate || 'Not set'}</div>
          <div>End: {patient.endDate || 'Not set'}</div>
          <div>Auth #: {patient.authNumber || 'Not set'}</div>
          <div>Ref #: {patient.refNumber || 'Not set'}</div>
        </div>
      </TableCell>

      {/* Schedule Status */}
      <TableCell>
        <Select 
          value={patient.scheduleStatus || 'Pending Auth'} 
          onValueChange={(value) => onScheduleStatusChange(patient.id, value)}
        >
          <SelectTrigger className="w-full border-none bg-transparent p-0 h-auto hover:bg-transparent">
            <SelectValue>
              <Badge className={`${getScheduleStatusColor(patient.scheduleStatus || 'Pending Auth')} border text-xs cursor-pointer hover:opacity-80`}>
                {patient.scheduleStatus || 'Pending Auth'}
              </Badge>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {scheduleStatusOptions.map(option => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      {/* Dose # */}
      <TableCell>
        <Select 
          value={String(patient.doseNumber || 1)}
          onValueChange={(value) => onDoseNumberChange(patient.id, parseInt(value))}
        >
          <SelectTrigger className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5, 6].map(dose => (
              <SelectItem key={dose} value={String(dose)}>{dose}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      {/* Last Apt */}
      <TableCell className="text-sm">
        {lastAppointment ? (
          <div className="space-y-1">
            <div className="font-medium">{lastAppointment.appointmentDate}</div>
            <Select 
              value={lastAppointment.status || 'Scheduled'}
              onValueChange={(status) => onAppointmentStatusChange(lastAppointment.id, status, patient.id)}
            >
              <SelectTrigger className="w-full border-none bg-transparent p-0 h-auto hover:bg-transparent">
                <SelectValue>
                  <Badge className={`${getAppointmentStatusColor(lastAppointment.status || 'Scheduled')} border text-xs cursor-pointer hover:opacity-80`}>
                    {lastAppointment.status || 'Scheduled'}
                  </Badge>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Scheduled">Scheduled</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
                <SelectItem value="No Show">No Show</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="text-gray-400">No past appointments</div>
        )}
      </TableCell>

      {/* Next Apt */}
      <TableCell className="text-sm">
        {nextAppointment ? (
          <div>{nextAppointment.appointmentDate}</div>
        ) : (
          <div className="text-gray-400">No upcoming appointments</div>
        )}
      </TableCell>

      {/* Notes */}
      <TableCell className="text-sm">
        <div className="space-y-2 max-w-lg">
          {patient.notes && (
            <div className="whitespace-pre-line text-gray-700 text-sm leading-relaxed">
              {getNotesPreview()}
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-gray-500 flex-1">
              {patient.lastVoicemailAt && `Voicemail Left: ${format(new Date(patient.lastVoicemailAt), 'MM/dd/yyyy HH:mm')}`}
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={onRecordVoicemail}
              className="flex items-center gap-1 text-xs whitespace-nowrap"
            >
              <Mic className="h-3 w-3" />
              Record Voicemail
            </Button>
          </div>
        </div>
      </TableCell>

      {/* Actions */}
      <TableCell>
        <Link href={`/patient/${patient.id}`}>
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            View
          </Button>
        </Link>
      </TableCell>
    </TableRow>
  )
}

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

  // Helper functions for business logic
  const applyBusinessLogic = (patient: Patient, appointments: any[] = []) => {
    const updates: any = {}
    
    // Auto-update schedule status based on auth status changes
    if (patient.authStatus === 'Approved' || patient.authStatus === 'No PA Required') {
      if (patient.scheduleStatus !== 'Needs Scheduling') {
        updates.scheduleStatus = 'Needs Scheduling'
      }
    } else if (patient.authStatus === 'Needs Renewal' || patient.authStatus === 'APT SCHEDULED W/O AUTH') {
      if (patient.scheduleStatus !== 'Pending Auth') {
        updates.scheduleStatus = 'Pending Auth'
      }
    }
    
    // Set Schedule Status to "Needs Scheduling–High Priority" if Dose # = 2
    if (patient.doseNumber === 2 && patient.scheduleStatus !== 'Pending Auth') {
      updates.scheduleStatus = 'Needs Scheduling–High Priority'
    }
    
    return updates
  }

  // Check if appointments are outside authorization dates
  const checkAuthDateCompliance = (patient: Patient, appointments: any[]) => {
    if (!patient.startDate || !patient.endDate) return null
    
    const authStartDate = new Date(patient.startDate)
    const authEndDate = new Date(patient.endDate)
    const today = new Date()
    
    const futureAppointments = appointments.filter(apt => new Date(apt.appointmentDate) > today)
    
    for (const appointment of futureAppointments) {
      const appointmentDate = new Date(appointment.appointmentDate)
      if (appointmentDate < authStartDate || appointmentDate > authEndDate) {
        return 'APT SCHEDULED W/O AUTH'
      }
    }
    
    return null
  }

  const getLastAppointment = (appointments: any[]) => {
    const today = new Date()
    const pastAppointments = appointments
      .filter(apt => new Date(apt.appointmentDate) <= today)
      .sort((a, b) => new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime())
    return pastAppointments[0] || null
  }

  const getNextAppointment = (appointments: any[]) => {
    const today = new Date()
    const futureAppointments = appointments
      .filter(apt => new Date(apt.appointmentDate) > today)
      .sort((a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime())
    return futureAppointments[0] || null
  }

  const handleAuthStatusChange = (patientId: number, newAuthStatus: string) => {
    const patient = patients.find(p => p.id === patientId)
    if (!patient) return

    const updates = { authStatus: newAuthStatus }
    const businessLogicUpdates = applyBusinessLogic({ ...patient, authStatus: newAuthStatus })
    
    updatePatientMutation.mutate({
      patientId,
      updates: { ...updates, ...businessLogicUpdates }
    })
  }

  const handleScheduleStatusChange = (patientId: number, newScheduleStatus: string) => {
    updatePatientMutation.mutate({
      patientId,
      updates: { scheduleStatus: newScheduleStatus }
    })
  }

  const handleDoseNumberChange = (patientId: number, newDoseNumber: number) => {
    const patient = patients.find(p => p.id === patientId)
    if (!patient) return

    const updates = { doseNumber: newDoseNumber }
    const businessLogicUpdates = applyBusinessLogic({ ...patient, doseNumber: newDoseNumber })
    
    updatePatientMutation.mutate({
      patientId,
      updates: { ...updates, ...businessLogicUpdates }
    })
  }

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

  const updatePatientMutation = useMutation({
    mutationFn: async ({ patientId, updates }: { patientId: number, updates: any }) => {
      const response = await fetch(`/api/patients/${patientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      if (!response.ok) throw new Error('Failed to update patient')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/patients'] })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      })
    }
  })

  const recordVoicemailMutation = useMutation({
    mutationFn: async (patientId: number) => {
      const response = await fetch(`/api/patients/${patientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastVoicemailAt: new Date().toISOString() })
      })
      if (!response.ok) throw new Error('Failed to record voicemail')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/patients'] })
      toast({
        title: "Success",
        description: "Voicemail timestamp recorded"
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

  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ appointmentId, status, patientId }: { appointmentId: number, status: string, patientId: number }) => {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      if (!response.ok) throw new Error('Failed to update appointment')
      
      // If appointment is marked as "Completed", trigger business logic
      if (status === 'Completed') {
        const patient = patients.find(p => p.id === patientId)
        if (patient) {
          const newDoseNumber = (patient.doseNumber || 1) + 1
          const updates: any = { doseNumber: newDoseNumber }
          
          // If not "Pending Auth", change to "Needs Scheduling"
          if (patient.scheduleStatus !== 'Pending Auth') {
            updates.scheduleStatus = 'Needs Scheduling'
          }
          
          // Update patient with new dose number and schedule status
          await fetch(`/api/patients/${patientId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
          })
        }
      }
      
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/patients'] })
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] })
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
            <div className="overflow-x-auto">
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-64 min-w-64">Patient Info</TableHead>
                    <TableHead className="w-40 min-w-40">Auth Status</TableHead>
                    <TableHead className="w-48 min-w-48">Auth Info</TableHead>
                    <TableHead className="w-40 min-w-40">Schedule Status</TableHead>
                    <TableHead className="w-20 min-w-20">Dose #</TableHead>
                    <TableHead className="w-32 min-w-32">Last Apt</TableHead>
                    <TableHead className="w-32 min-w-32">Next Apt</TableHead>
                    <TableHead className="w-80 min-w-80">Notes</TableHead>
                    <TableHead className="w-24 min-w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {filteredAndSortedPatients.map((patient) => (
                  <PatientRow 
                    key={patient.id}
                    patient={patient}
                    onAuthStatusChange={handleAuthStatusChange}
                    onScheduleStatusChange={handleScheduleStatusChange}
                    onDoseNumberChange={handleDoseNumberChange}
                    onRecordVoicemail={() => recordVoicemailMutation.mutate(patient.id)}
                    onAppointmentStatusChange={(appointmentId, status, patientId) => 
                      updateAppointmentMutation.mutate({ appointmentId, status, patientId })
                    }
                  />
                ))}
              </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}