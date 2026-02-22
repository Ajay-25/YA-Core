'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  User,
  Users,
  Package,
  ClipboardCheck,
  CreditCard,
  ShieldCheck,
} from 'lucide-react'
import { useDashboard } from '@/contexts/DashboardContext'
import { hasAnyPermission, PERMISSIONS } from '@/lib/permissions'

const NAV_ITEMS = [
  {
    label: 'Profile',
    href: '/dashboard/profile',
    icon: User,
    requiredPermissions: null,
  },
  {
    label: 'Volunteers',
    href: '/dashboard/volunteers',
    icon: Users,
    requiredPermissions: [PERMISSIONS.DIRECTORY_VIEW],
  },
  {
    label: 'Stock',
    href: '/dashboard/stock',
    icon: Package,
    requiredPermissions: [PERMISSIONS.STOCK_ISSUE, PERMISSIONS.STOCK_MANAGE],
  },
  {
    label: 'Attendance',
    href: '/dashboard/attendance',
    icon: ClipboardCheck,
    requiredPermissions: [PERMISSIONS.ATTENDANCE_MARK],
  },
  {
    label: 'IDs',
    href: '/dashboard/id-cards',
    icon: CreditCard,
    requiredPermissions: [PERMISSIONS.DIRECTORY_VIEW],
  },
  {
    label: 'Access',
    href: '/dashboard/admin/access',
    icon: ShieldCheck,
    requiredPermissions: [PERMISSIONS.SYSTEM_MANAGE_ACCESS],
  },
]

export function BottomNav() {
  const pathname = usePathname()
  const { role, accessibleModules } = useDashboard()

  const visibleItems = useMemo(() => {
    if (!role) return []
    const userCtx = { role, accessibleModules }
    return NAV_ITEMS.filter((item) => {
      if (!item.requiredPermissions) return true
      return hasAnyPermission(userCtx, item.requiredPermissions)
    })
  }, [role, accessibleModules])

  if (visibleItems.length === 0) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t">
      <div className="max-w-2xl mx-auto">
        <div className="flex overflow-x-auto no-scrollbar">
          {visibleItems.map((item) => {
            const Icon = item.icon
            const isActive =
              pathname === item.href ||
              pathname.startsWith(item.href + '/')

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 min-w-[4.5rem] flex-1 transition-colors ${
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                <span className="text-[10px] font-medium leading-none">
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
