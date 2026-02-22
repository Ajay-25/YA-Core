'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  User,
  QrCode,
  Users,
  Package,
  ClipboardCheck,
  CreditCard,
} from 'lucide-react'
import { useDashboard } from '@/contexts/DashboardContext'

const NAV_ITEMS = [
  {
    label: 'Profile',
    href: '/dashboard/profile',
    icon: User,
    isVisible: () => true,
  },
  {
    label: 'My QR',
    href: '/dashboard/qr',
    icon: QrCode,
    isVisible: () => true,
  },
  {
    label: 'Volunteers',
    href: '/dashboard/volunteers',
    icon: Users,
    isVisible: (role, modules) =>
      role === 'admin' ||
      role === 'coordinator' ||
      (role === 'moderator' && modules.includes('profile_edit')),
  },
  {
    label: 'Stock',
    href: '/dashboard/stock',
    icon: Package,
    isVisible: (role, modules) =>
      role === 'admin' ||
      role === 'coordinator' ||
      (role === 'moderator' && modules.includes('stock_manage')),
  },
  {
    label: 'Attendance',
    href: '/dashboard/attendance',
    icon: ClipboardCheck,
    isVisible: (role, modules) =>
      role === 'admin' ||
      role === 'coordinator' ||
      (role === 'moderator' && modules.includes('attendance_mark')),
  },
  {
    label: 'IDs',
    href: '/dashboard/id-cards',
    icon: CreditCard,
    isVisible: (role, modules) =>
      role === 'admin' ||
      role === 'coordinator' ||
      (role === 'moderator' && modules.includes('id_distribute')),
  },
]

export function BottomNav() {
  const pathname = usePathname()
  const { role, accessibleModules } = useDashboard()

  const visibleItems = useMemo(() => {
    if (!role) return []
    return NAV_ITEMS.filter((item) =>
      item.isVisible(role, accessibleModules ?? [])
    )
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
