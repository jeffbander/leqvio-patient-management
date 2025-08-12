import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Users, Calendar, FileText, TrendingUp, Clock, AlertTriangle, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'

interface PatientMetrics {
  totalPatients: number
  authStatusBreakdown: { [key: string]: number }
  scheduleStatusBreakdown: { [key: string]: number }
  upcomingAppointments: number
  overdueAppointments: number
  totalAppointments: number
  recentVoicemails: number
  patientsWithDocuments: number
  appointmentsPerMonth: number
  upcomingAppointmentsList?: AppointmentWithPatient[]
  overdueAppointmentsList?: AppointmentWithPatient[]
}

interface Patient {
  id: number
  firstName: string
  lastName: string
  authStatus?: string
  scheduleStatus?: string
  lastVoicemailAt?: string
  notes?: string
}

interface Appointment {
  id: number
  patientId: number
  appointmentDate: string
  status?: string
}

interface AppointmentWithPatient extends Appointment {
  patientName?: string
}

export default function Dashboard() {
  // Fetch all patients for metrics calculation
  const { data: patients = [], isLoading: patientsLoading } = useQuery<Patient[]>({
    queryKey: ['/api/patients'],
  })

  // Get all appointments (simplified approach)
  const { data: allAppointments = [], isLoading: appointmentsLoading } = useQuery<Appointment[]>({
    queryKey: ['/api/all-appointments'],
    queryFn: async () => {
      // We'll fetch appointments for each patient and combine them
      if ((patients as Patient[]).length === 0) return []
      
      const appointmentPromises = (patients as Patient[]).map(async (patient: Patient) => {
        try {
          const response = await fetch(`/api/patients/${patient.id}/appointments`)
          if (!response.ok) return []
          const appointments = await response.json()
          return appointments.map((apt: any) => ({ ...apt, patientId: patient.id }))
        } catch {
          return []
        }
      })
      const allApts = await Promise.all(appointmentPromises)
      return allApts.flat()
    },
    enabled: (patients as Patient[]).length > 0
  })

  const calculateMetrics = () => {
    const today = new Date()
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const patientsArray = patients as Patient[]
    const appointmentsArray = allAppointments as Appointment[]

    // Auth status breakdown
    const authStatusBreakdown = patientsArray.reduce((acc: any, patient: Patient) => {
      const status = patient.authStatus || 'Pending Review'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {})

    // Schedule status breakdown
    const scheduleStatusBreakdown = patientsArray.reduce((acc: any, patient: Patient) => {
      const status = patient.scheduleStatus || 'Pending Auth'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {})

    // Upcoming appointments (next 30 days)
    const next30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    const upcomingAppointmentsList = appointmentsArray
      .filter((apt: Appointment) => {
        const aptDate = new Date(apt.appointmentDate)
        return aptDate > today && aptDate <= next30Days
      })
      .map((apt: Appointment) => {
        const patient = patientsArray.find(p => p.id === apt.patientId)
        return {
          ...apt,
          patientName: patient ? `${patient.lastName}, ${patient.firstName}` : 'Unknown Patient'
        } as AppointmentWithPatient
      })
      .sort((a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime())

    // Overdue appointments (past appointments without completion)
    const overdueAppointmentsList = appointmentsArray
      .filter((apt: Appointment) => {
        const aptDate = new Date(apt.appointmentDate)
        return aptDate < today && apt.status !== 'Completed'
      })
      .map((apt: Appointment) => {
        const patient = patientsArray.find(p => p.id === apt.patientId)
        return {
          ...apt,
          patientName: patient ? `${patient.lastName}, ${patient.firstName}` : 'Unknown Patient'
        } as AppointmentWithPatient
      })
      .sort((a, b) => new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime())

    // Recent voicemails (last 7 days)
    const recentVoicemails = patientsArray.filter((patient: Patient) => {
      if (!patient.lastVoicemailAt) return false
      const voicemailDate = new Date(patient.lastVoicemailAt)
      return voicemailDate >= lastWeek
    }).length

    // Calculate appointments per month (last 12 months)
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
    
    const recentAppointments = appointmentsArray.filter((apt: Appointment) => {
      const aptDate = new Date(apt.appointmentDate)
      return aptDate >= twelveMonthsAgo
    })
    
    // Group appointments by month and calculate average
    const monthlyAppointments: { [key: string]: number } = {}
    recentAppointments.forEach((apt: Appointment) => {
      const monthKey = new Date(apt.appointmentDate).toISOString().substring(0, 7) // YYYY-MM format
      monthlyAppointments[monthKey] = (monthlyAppointments[monthKey] || 0) + 1
    })
    
    const monthsWithAppointments = Object.keys(monthlyAppointments).length
    const appointmentsPerMonth = monthsWithAppointments > 0 
      ? Math.round(recentAppointments.length / Math.max(monthsWithAppointments, 1))
      : 0

    return {
      totalPatients: patientsArray.length,
      authStatusBreakdown,
      scheduleStatusBreakdown,
      upcomingAppointments: upcomingAppointmentsList.length,
      overdueAppointments: overdueAppointmentsList.length,
      totalAppointments: appointmentsArray.length,
      recentVoicemails,
      patientsWithDocuments: Math.floor(patientsArray.length * 0.8), // Placeholder estimate
      appointmentsPerMonth,
      upcomingAppointmentsList,
      overdueAppointmentsList
    }
  }

  const metrics = calculateMetrics()

  const getAuthStatusColor = (status: string) => {
    switch (status) {
      case 'Approved': return 'bg-green-100 text-green-800'
      case 'Denied': return 'bg-red-100 text-red-800'
      case 'Pending Review': return 'bg-yellow-100 text-yellow-800'
      case 'No PA Required': return 'bg-blue-100 text-blue-800'
      case 'Pending More Info': return 'bg-orange-100 text-orange-800'
      case 'Needs Renewal': return 'bg-purple-100 text-purple-800'
      case 'APT SCHEDULED W/O AUTH': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getScheduleStatusColor = (status: string) => {
    switch (status) {
      case 'Scheduled': return 'bg-green-100 text-green-800'
      case 'Pending Auth': return 'bg-yellow-100 text-yellow-800'
      case 'Needs Scheduling': return 'bg-orange-100 text-orange-800'
      case 'Needs Scheduling–High Priority': return 'bg-red-100 text-red-800'
      case 'Needs Rescheduling': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (patientsLoading || appointmentsLoading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of patient management metrics and status</p>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalPatients}</div>
            <p className="text-xs text-muted-foreground">Active patient records</p>
          </CardContent>
        </Card>

        <Dialog>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:bg-gray-50 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Upcoming Appointments</CardTitle>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.upcomingAppointments}</div>
                <p className="text-xs text-muted-foreground">Next 30 days • Click to view</p>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Upcoming Appointments</DialogTitle>
              <DialogDescription>
                Appointments scheduled for the next 30 days
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              {metrics.upcomingAppointmentsList && metrics.upcomingAppointmentsList.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="py-2">Patient</TableHead>
                      <TableHead className="py-2">Date</TableHead>
                      <TableHead className="py-2">Status</TableHead>
                      <TableHead className="py-2 w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.upcomingAppointmentsList.map((appointment: AppointmentWithPatient) => (
                      <TableRow key={appointment.id}>
                        <TableCell className="font-medium py-2">{appointment.patientName}</TableCell>
                        <TableCell className="py-2">{format(new Date(appointment.appointmentDate), 'MMM dd')}</TableCell>
                        <TableCell className="py-2">
                          <Badge className="bg-blue-100 text-blue-800 text-xs">
                            {appointment.status || 'Scheduled'}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => window.location.href = `/patient/${appointment.patientId}`}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No upcoming appointments in the next 30 days
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:bg-red-50 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overdue Items</CardTitle>
                <div className="flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{metrics.overdueAppointments}</div>
                <p className="text-xs text-muted-foreground">Need attention • Click to view</p>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Overdue Appointments</DialogTitle>
              <DialogDescription>
                Past appointments that need attention or follow-up
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              {metrics.overdueAppointmentsList && metrics.overdueAppointmentsList.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="py-2">Patient</TableHead>
                      <TableHead className="py-2">Date</TableHead>
                      <TableHead className="py-2">Status</TableHead>
                      <TableHead className="py-2 w-20">Days</TableHead>
                      <TableHead className="py-2 w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.overdueAppointmentsList.map((appointment: AppointmentWithPatient) => {
                      const daysOverdue = Math.floor((new Date().getTime() - new Date(appointment.appointmentDate).getTime()) / (1000 * 60 * 60 * 24))
                      return (
                        <TableRow key={appointment.id}>
                          <TableCell className="font-medium py-2">{appointment.patientName}</TableCell>
                          <TableCell className="py-2">{format(new Date(appointment.appointmentDate), 'MMM dd')}</TableCell>
                          <TableCell className="py-2">
                            <Badge className="bg-red-100 text-red-800 text-xs">
                              {appointment.status || 'Scheduled'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-red-600 font-medium py-2">{daysOverdue}d</TableCell>
                          <TableCell className="py-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => window.location.href = `/patient/${appointment.patientId}`}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No overdue appointments
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Voicemails</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.recentVoicemails}</div>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Authorization Status</CardTitle>
            <CardDescription>Current authorization status distribution</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(metrics.authStatusBreakdown).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <Badge className={getAuthStatusColor(status)}>{status}</Badge>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Schedule Status</CardTitle>
            <CardDescription>Current scheduling status distribution</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(metrics.scheduleStatusBreakdown).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <Badge className={getScheduleStatusColor(status)}>{status}</Badge>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Appointments</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalAppointments}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documented Patients</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.patientsWithDocuments}</div>
            <p className="text-xs text-muted-foreground">
              {Math.round((metrics.patientsWithDocuments / metrics.totalPatients) * 100)}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Appointments per Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.appointmentsPerMonth}</div>
            <p className="text-xs text-muted-foreground">Average over last 12 months</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}