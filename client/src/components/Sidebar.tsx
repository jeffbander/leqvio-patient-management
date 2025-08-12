import { Link, useLocation } from 'wouter'
import { cn } from '@/lib/utils'
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  UserPlus,
  Building2,
  Menu,
  X,
  LogOut
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

interface SidebarProps {
  className?: string
}

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Patients',
    href: '/patients',
    icon: Users,
  },
  {
    name: 'New Patient',
    href: '/patient/new',
    icon: UserPlus,
  },
  {
    name: 'Extraction',
    href: '/extraction',
    icon: FileText,
  },
  {
    name: 'Organization',
    href: '/organization',
    icon: Building2,
  },
]

export function Sidebar({ className }: SidebarProps) {
  const [location] = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { user, logout } = useAuth()

  return (
    <>
      {/* Mobile menu button */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="bg-white shadow-md"
        >
          {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed left-0 top-0 z-40 h-full w-64 transform bg-white border-r border-gray-200 transition-transform duration-200 ease-in-out",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        "md:translate-x-0 md:static md:inset-0",
        className
      )}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <img 
                  src="/assets/aigents-logo.png" 
                  alt="Providerloop" 
                  className="h-8 w-auto"
                  onError={(e) => {
                    // Fallback to text if image doesn't load
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    target.parentElement!.innerHTML = '<span class="font-bold text-lg text-blue-600">Providerloop</span>'
                  }}
                />
              </div>
            </div>
            {/* Close button for mobile */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigation.map((item) => {
              const isActive = location === item.href || 
                (item.href === '/patients' && location.startsWith('/patient/') && location !== '/patient/new')
              
              return (
                <Link key={item.name} href={item.href}>
                  <div
                    className={cn(
                      "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer",
                      isActive
                        ? "bg-blue-100 text-blue-700 border border-blue-200"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <item.icon className={cn(
                      "mr-3 h-4 w-4",
                      isActive ? "text-blue-700" : "text-gray-400"
                    )} />
                    {item.name}
                  </div>
                </Link>
              )
            })}
          </nav>

          {/* User Info & Logout */}
          <div className="p-4 border-t border-gray-200 space-y-3">
            {user && (
              <div className="text-sm text-gray-600">
                Logged in as: <span className="font-medium">{user.email}</span>
              </div>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => logout()}
              className="w-full"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
            <div className="text-xs text-gray-500 text-center">
              Providerloop Chains v1.0
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 md:ml-0 overflow-auto">
        <div className="min-h-full">
          {children}
        </div>
      </main>
    </div>
  )
}