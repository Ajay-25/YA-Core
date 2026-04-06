'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useDashboard } from '@/contexts/DashboardContext'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'
import {
  Search,
  Shield,
  ShieldCheck,
  Users,
  UserPlus,
  Package,
  ClipboardCheck,
  Eye,
  Pencil,
  QrCode,
  Loader2,
  Save,
  ArrowLeft,
  Settings,
  BookOpen,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Helpers ────────────────────────────────────────────────

function getInitials(name) {
  if (!name || typeof name !== 'string') return '?'
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?'
}

function useSheetSide() {
  const [side, setSide] = useState('right')
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    setSide(mq.matches ? 'bottom' : 'right')
    const fn = () => setSide(mq.matches ? 'bottom' : 'right')
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return side
}

function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function formatRoleLabel(role) {
  if (!role) return 'Volunteer'
  return role
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// ─── Role Presets & Permission Definitions ──────────────────

const ROLE_PRESETS = {
  admin: [
    'stock:manage', 'stock:issue',
    'directory:view', 'directory:edit',
    'attendance:mark', 'attendance_log:view', 'attendance_log:manage',
    'system:manage_access',
  ],
  operations_manager: [
    'stock:manage', 'stock:issue',
    'directory:edit', 'directory:view',
    'attendance_log:manage', 'attendance_log:view',
    'attendance:mark',
  ],
  desk_moderator: ['stock:issue', 'directory:view', 'attendance:mark'],
  attendance_scanner: ['attendance:mark'],
  volunteer: [],
}

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'operations_manager', label: 'Operations Manager' },
  { value: 'desk_moderator', label: 'Desk Moderator' },
  { value: 'attendance_scanner', label: 'Attendance Scanner' },
  { value: 'custom', label: 'Custom' },
  { value: 'volunteer', label: 'Volunteer (Revoke Access)' },
]

const ROLE_COLORS = {
  admin: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  operations_manager: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  desk_moderator: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  attendance_scanner: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400',
  custom: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  volunteer: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
}

const PERMISSION_GROUPS = [
  {
    category: 'Stock',
    icon: Package,
    permissions: [
      { key: 'stock:manage', label: 'Manage Stock', description: 'Add, adjust, and audit inventory levels' },
      { key: 'stock:issue', label: 'Issue Items', description: 'Issue items to volunteers from inventory' },
    ],
  },
  {
    category: 'Directory',
    icon: Users,
    permissions: [
      { key: 'directory:view', label: 'View Directory', description: 'Browse and search volunteer profiles' },
      { key: 'directory:edit', label: 'Edit Profiles', description: 'Edit volunteer profile information' },
    ],
  },
  {
    category: 'Attendance',
    icon: ClipboardCheck,
    permissions: [
      { key: 'attendance:mark', label: 'Mark Attendance', description: 'Scan QR or mark volunteers present' },
      { key: 'attendance_log:view', label: 'View Logs', description: 'View attendance history and reports' },
      { key: 'attendance_log:manage', label: 'Manage Logs', description: 'Edit or delete attendance records' },
    ],
  },
  {
    category: 'System',
    icon: Settings,
    permissions: [
      { key: 'system:manage_access', label: 'Manage Access', description: 'Grant or revoke roles and permissions' },
    ],
  },
]

const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.key)
)

/** Determine which preset matches a given module set, or 'custom'. */
function detectRole(modules) {
  const sorted = [...modules].sort()
  for (const [role, preset] of Object.entries(ROLE_PRESETS)) {
    if (role === 'volunteer' || role === 'custom') continue
    const presetSorted = [...preset].sort()
    if (
      sorted.length === presetSorted.length &&
      sorted.every((m, i) => m === presetSorted[i])
    ) {
      return role
    }
  }
  if (sorted.length === 0) return 'volunteer'
  return 'custom'
}

// ─── Promote Volunteer Dialog ───────────────────────────────

function PromoteDialog({ open, onOpenChange, session, onSelect }) {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)

  const { data, isFetching } = useQuery({
    queryKey: ['access-search', debouncedSearch],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/access?type=search&q=${encodeURIComponent(debouncedSearch)}`,
        { credentials: 'same-origin' }
      )
      if (!res.ok) throw new Error('Search failed')
      return res.json()
    },
    enabled: !!session && debouncedSearch.length >= 2,
  })

  const results = data?.data ?? []

  useEffect(() => {
    if (!open) setSearch('')
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-lg">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4" />
            Grant Access / Promote Volunteer
          </DialogTitle>
        </DialogHeader>
        <Command className="border-t" shouldFilter={false}>
          <CommandInput
            placeholder="Search by name or YA ID..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-72">
            {debouncedSearch.length < 2 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Type at least 2 characters to search
              </div>
            ) : isFetching ? (
              <div className="p-6 text-center">
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : (
              <>
                <CommandEmpty>No volunteers found.</CommandEmpty>
                <CommandGroup>
                  {results.map((u) => (
                    <CommandItem
                      key={u.id}
                      value={u.id}
                      onSelect={() => {
                        onSelect(u)
                        onOpenChange(false)
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
                    >
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarImage src={u.photo_url} alt={u.full_name} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {getInitials(u.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{u.full_name || 'Unnamed'}</p>
                        <p className="text-xs text-muted-foreground">
                          {u.ya_id || 'No YA ID'}
                          {u.role && u.role !== 'volunteer' && (
                            <span className="ml-1.5"> &middot; {formatRoleLabel(u.role)}</span>
                          )}
                        </p>
                      </div>
                      {u.role && u.role !== 'volunteer' && (
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          Staff
                        </Badge>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}

// ─── Staff Master List ──────────────────────────────────────

function StaffMasterList({ users, isLoading, onSelectUser }) {
  const [searchInput, setSearchInput] = useState('')

  const filtered = useMemo(() => {
    if (!searchInput.trim()) return users
    const q = searchInput.toLowerCase()
    return users.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(q) ||
        u.ya_id?.toLowerCase().includes(q)
    )
  }, [users, searchInput])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0 bg-background border-b pb-3 pt-1 px-1 -mx-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter staff by name or YA ID..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10 h-11"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          {filtered.length} active staff member{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pt-3 space-y-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="p-3">
              <CardContent className="p-0">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-11 w-11 rounded-full shrink-0" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex justify-between gap-2">
                      <Skeleton className="h-4 flex-1 max-w-32" />
                      <Skeleton className="h-5 w-14 shrink-0" />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Skeleton className="h-5 w-24 rounded-md" />
                      <Skeleton className="h-5 w-16 rounded-md" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No active staff found</p>
              <p className="text-xs mt-1">Use &quot;Grant Access&quot; to promote a volunteer</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((u) => {
            const role = u.role || 'volunteer'
            const modules = u.accessible_modules || []
            const moduleCount = modules.length
            const pillClass = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-[11px] font-medium'
            return (
              <Card
                key={u.id}
                className="p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => onSelectUser(u)}
              >
                <CardContent className="p-0">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-11 w-11 shrink-0">
                      <AvatarImage src={u.photo_url} alt={u.full_name} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {getInitials(u.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <span className="font-semibold text-[15px] truncate">
                          {u.full_name || 'Unnamed'}
                        </span>
                        {u.ya_id && (
                          <Badge variant="secondary" className="flex-shrink-0 text-[10px] font-mono">
                            {u.ya_id}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${ROLE_COLORS[role] || ROLE_COLORS.custom}`}>
                          <Shield className="h-3 w-3 shrink-0" />
                          {formatRoleLabel(role)}
                        </span>
                        {moduleCount > 0 && (
                          <span className={pillClass}>
                            <ShieldCheck className="h-3 w-3 shrink-0" />
                            {moduleCount} permission{moduleCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── Access Control Sheet ───────────────────────────────────

function AccessControlSheet({
  selectedUser,
  open,
  onClose,
  session,
  queryClient,
}) {
  const sheetSide = useSheetSide()
  const [selectedRole, setSelectedRole] = useState('volunteer')
  const [selectedModules, setSelectedModules] = useState([])
  const [saving, setSaving] = useState(false)
  const suppressAutoDetectRef = useRef(false)

  useEffect(() => {
    if (selectedUser) {
      const modules = selectedUser.accessible_modules || []
      setSelectedModules(modules)
      const detected = detectRole(modules)
      // If the stored role is a known preset, use it; otherwise use detected
      const storedRole = selectedUser.role || 'volunteer'
      if (ROLE_PRESETS[storedRole] !== undefined) {
        setSelectedRole(storedRole)
      } else {
        setSelectedRole(detected)
      }
      suppressAutoDetectRef.current = false
    }
  }, [selectedUser])

  const handleRoleChange = useCallback((newRole) => {
    setSelectedRole(newRole)
    if (ROLE_PRESETS[newRole] !== undefined) {
      setSelectedModules([...ROLE_PRESETS[newRole]])
      suppressAutoDetectRef.current = true
    }
  }, [])

  const handleTogglePermission = useCallback((key) => {
    setSelectedModules((prev) => {
      const next = prev.includes(key)
        ? prev.filter((m) => m !== key)
        : [...prev, key]
      // Any manual toggle → set role to 'custom'
      setSelectedRole('custom')
      suppressAutoDetectRef.current = false
      return next
    })
  }, [])

  const isDirty = useMemo(() => {
    if (!selectedUser) return false
    const origRole = selectedUser.role || 'volunteer'
    const origModules = selectedUser.accessible_modules || []
    if (selectedRole !== origRole) return true
    if (selectedModules.length !== origModules.length) return true
    const sorted = [...selectedModules].sort()
    const origSorted = [...origModules].sort()
    return sorted.some((m, i) => m !== origSorted[i])
  }, [selectedUser, selectedRole, selectedModules])

  const isRevoke = selectedRole === 'volunteer' || selectedModules.length === 0

  const handleSave = useCallback(async () => {
    if (!selectedUser) return
    setSaving(true)

    const effectiveRole = selectedModules.length === 0 ? 'volunteer' : selectedRole
    const effectiveModules = effectiveRole === 'volunteer' ? [] : [...selectedModules]

    // Optimistic: update staff list cache
    queryClient.setQueriesData({ queryKey: ['access-staff'] }, (old) => {
      if (!old?.data) return old
      if (effectiveRole === 'volunteer') {
        // Remove from staff list
        return { ...old, data: old.data.filter((u) => u.user_id !== selectedUser.user_id) }
      }
      // Update in list
      return {
        ...old,
        data: old.data.map((u) =>
          u.user_id === selectedUser.user_id
            ? { ...u, role: effectiveRole, accessible_modules: effectiveModules }
            : u
        ),
      }
    })

    // If promoting (not already in the list), add optimistically
    if (effectiveRole !== 'volunteer') {
      queryClient.setQueriesData({ queryKey: ['access-staff'] }, (old) => {
        if (!old?.data) return old
        const exists = old.data.some((u) => u.user_id === selectedUser.user_id)
        if (!exists) {
          return {
            ...old,
            data: [
              ...old.data,
              { ...selectedUser, role: effectiveRole, accessible_modules: effectiveModules },
            ].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '')),
          }
        }
        return old
      })
    }

    onClose()

    try {
      const res = await fetch('/api/admin/access', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target_user_id: selectedUser.user_id,
          role: effectiveRole,
          accessible_modules: effectiveModules,
        }),
      })
      if (res.ok) {
        const verb = effectiveRole === 'volunteer' ? 'Access revoked for' : 'Permissions updated for'
        toast.success(`${verb} ${selectedUser.full_name || 'user'}`)
        queryClient.invalidateQueries({ queryKey: ['access-staff'] })
      } else {
        const err = await res.json().catch(() => ({}))
        queryClient.invalidateQueries({ queryKey: ['access-staff'] })
        toast.error(err.error || 'Failed to save changes')
      }
    } catch {
      queryClient.invalidateQueries({ queryKey: ['access-staff'] })
      toast.error('Failed to save changes')
    }
    setSaving(false)
  }, [selectedUser, selectedRole, selectedModules, session, queryClient, onClose])

  const displayName = selectedUser?.full_name || 'User'

  const sheetContentClass =
    sheetSide === 'bottom'
      ? 'h-[90vh] overflow-hidden flex flex-col rounded-t-2xl p-0'
      : 'w-full max-w-lg overflow-hidden flex flex-col sm:max-w-xl p-0'

  return (
    <Sheet
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <SheetContent
        side={sheetSide}
        className={`${sheetContentClass} [&>button.absolute]:hidden`}
      >
        {selectedUser ? (
          <>
            {/* Header */}
            <SheetHeader className="px-4 pt-4 pb-3 border-b shrink-0 text-left">
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14 shrink-0 border-2 border-background shadow">
                  <AvatarImage src={selectedUser.photo_url} alt={displayName} />
                  <AvatarFallback className="bg-primary/15 text-primary text-lg font-semibold">
                    {getInitials(displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-xl font-bold text-foreground truncate">
                    {displayName}
                  </SheetTitle>
                  {selectedUser.ya_id && (
                    <Badge variant="outline" className="mt-1 font-mono text-xs">
                      {selectedUser.ya_id}
                    </Badge>
                  )}
                </div>
              </div>
            </SheetHeader>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0 space-y-6 pb-28">
              {/* Role Template */}
              <section>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Role Template
                </p>
                <Select value={selectedRole} onValueChange={handleRoleChange}>
                  <SelectTrigger className="w-full h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className="flex items-center gap-2">
                          <Shield className="h-3.5 w-3.5" />
                          {opt.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${ROLE_COLORS[selectedRole] || ROLE_COLORS.custom}`}>
                    {formatRoleLabel(selectedRole)}
                  </span>
                  {isRevoke && selectedRole === 'volunteer' && (
                    <span className="text-[11px] text-destructive font-medium">
                      Saving will revoke all access
                    </span>
                  )}
                </div>
              </section>

              {/* Granular Permissions */}
              <section>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Granular Permissions
                </p>
                <div className="space-y-4">
                  {PERMISSION_GROUPS.map((group) => {
                    const GroupIcon = group.icon
                    return (
                      <div key={group.category}>
                        <div className="flex items-center gap-2 mb-2">
                          <GroupIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            {group.category}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {group.permissions.map((perm) => {
                            const isChecked = selectedModules.includes(perm.key)
                            return (
                              <div
                                key={perm.key}
                                className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium leading-tight">{perm.label}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">{perm.description}</p>
                                </div>
                                <Switch
                                  checked={isChecked}
                                  onCheckedChange={() => handleTogglePermission(perm.key)}
                                />
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-12 flex-1 font-medium"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                className="h-12 flex-1 font-medium"
                variant={isRevoke ? 'destructive' : 'default'}
                disabled={!isDirty || saving}
                onClick={handleSave}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : (
                  <Save className="h-4 w-4 mr-1.5" />
                )}
                {isRevoke ? 'Revoke Access' : 'Save Access Levels'}
              </Button>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

// ─── Page ───────────────────────────────────────────────────

export default function AccessManagementPage() {
  const { session, role } = useDashboard()
  const queryClient = useQueryClient()
  const [selectedUser, setSelectedUser] = useState(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [isPromoteOpen, setIsPromoteOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['access-staff'],
    queryFn: async () => {
      const res = await fetch('/api/admin/access?type=staff', {
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error('Failed to fetch staff')
      return res.json()
    },
    enabled: !!session && role === 'admin',
  })

  const staff = data?.data ?? []

  const handleSelectUser = useCallback((user) => {
    setSelectedUser(user)
    setIsSheetOpen(true)
  }, [])

  const handleCloseSheet = useCallback(() => {
    setIsSheetOpen(false)
    setSelectedUser(null)
  }, [])

  const handlePromoteSelect = useCallback((user) => {
    setSelectedUser(user)
    setIsSheetOpen(true)
  }, [])

  if (role && role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-center px-4">
        <div>
          <Shield className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-40" />
          <h2 className="text-lg font-semibold mb-1">Access Denied</h2>
          <p className="text-sm text-muted-foreground">
            Only administrators can manage access permissions.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto w-full px-4 pb-20">
      <div className="shrink-0 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Access Management</h1>
          </div>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setIsPromoteOpen(true)}
          >
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Grant Access</span>
            <span className="sm:hidden">Promote</span>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Active staff with elevated roles and permissions
        </p>
      </div>

      <StaffMasterList
        users={staff}
        isLoading={isLoading}
        onSelectUser={handleSelectUser}
      />

      <PromoteDialog
        open={isPromoteOpen}
        onOpenChange={setIsPromoteOpen}
        session={session}
        onSelect={handlePromoteSelect}
      />

      <AccessControlSheet
        selectedUser={selectedUser}
        open={isSheetOpen}
        onClose={handleCloseSheet}
        session={session}
        queryClient={queryClient}
      />
    </div>
  )
}
