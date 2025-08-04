import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Link } from 'wouter'
import { Badge } from '@/components/ui/badge'
import { UserPlus, Search, Eye, FileSpreadsheet } from 'lucide-react'
import { format } from 'date-fns'
import { queryClient } from '@/lib/queryClient'

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

export default function PatientList() {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')

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

  const filteredPatients = patients.filter(patient => {
    const search = searchTerm.toLowerCase()
    return (
      patient.firstName.toLowerCase().includes(search) ||
      patient.lastName.toLowerCase().includes(search) ||
      patient.orderingMD.toLowerCase().includes(search)
    )
  })

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
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
              placeholder="Search patients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex gap-2">
          {sheetsStatus?.configured && (
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
      ) : filteredPatients.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">
              {searchTerm ? 'No patients found matching your search.' : 'No patients found. Create your first patient to get started.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredPatients.map((patient) => (
            <Card key={patient.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <h3 className="text-xl font-semibold">
                        {patient.lastName}, {patient.firstName}
                      </h3>
                      <Badge className={getStatusColor(patient.status)}>
                        {patient.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">DOB:</span> {patient.dateOfBirth}
                      </div>
                      <div>
                        <span className="font-medium">Provider:</span> {patient.orderingMD}
                      </div>
                      <div>
                        <span className="font-medium">Diagnosis:</span> {patient.diagnosis}
                      </div>
                      <div>
                        <span className="font-medium">Created:</span> {format(new Date(patient.createdAt), 'MM/dd/yyyy')}
                      </div>
                    </div>
                  </div>
                  <Link href={`/patient/${patient.id}`}>
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      View
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}