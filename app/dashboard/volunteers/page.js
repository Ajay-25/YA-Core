'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useDashboard } from '@/contexts/DashboardContext'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { FormField, FieldGroup } from '@/components/dashboard/form-fields'
import {
  User,
  Users,
  Search,
  Loader2,
  Save,
  Phone,
  MapPin,
  Package,
  Pencil,
  CircleDot,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  PERSONAL_FIELDS,
  CONTACT_FIELDS,
  ADDRESS_FIELDS,
  SEWA_FIELDS,
  groupBySection,
} from '@/lib/field-configs'

// Detail view sections (grouped for Accordion)
const PERSONAL_CONTACT_FIELDS = [...PERSONAL_FIELDS, ...CONTACT_FIELDS, ...ADDRESS_FIELDS]
const LOGISTICS_FIELDS = [
  { key: 'uniform', label: 'Uniform (Yes/No)', type: 'select', options: ['Yes', 'No'], source: 'data' },
  { key: 'permanent_icard_status', label: 'Permanent I-Card Status', type: 'text', source: 'data' },
  { key: 'type_of_icard', label: 'Type of I-Card', type: 'text', source: 'data' },
  { key: 'icard_remarks', label: 'ID Card Remarks', type: 'text', source: 'data' },
  { key: 'orientation_training', label: 'Orientation/Training', type: 'select', options: ['Yes', 'No'], source: 'data' },
  { key: 'knows_car_driving', label: 'Knows Car Driving', type: 'select', options: ['Yes', 'No'], source: 'data' },
  { key: 'place_of_orientation', label: 'Place of Orientation', type: 'text', source: 'data' },
  { key: 'date_of_joining', label: 'Date of Joining / Orientation', type: 'text', source: 'data' },
]

const PAGE_SIZE = 20
const DEBOUNCE_MS = 300

/**
 * List API response shape (GET /api/admin/volunteers).
 * Each item is profiles_core with nested profiles_data and profiles_sensitive (FK join).
 * @typedef {Object} VolunteerListItem
 * @property {string} user_id
 * @property {string} [full_name]
 * @property {string} [ya_id]
 * @property {string} [photo_url]
 * @property {{ contact_number?: string, sewa_center?: string, [key: string]: unknown } | null} profiles_data
 * @property {Record<string, unknown> | null} [profiles_sensitive]
 */

function useDebouncedValue(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debouncedValue
}

// --------------- Master list ---------------
function VolunteerMasterList({ session, onSelectVolunteer, canEdit }) {
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(0)
  const debouncedSearch = useDebouncedValue(searchInput, DEBOUNCE_MS)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['volunteers', debouncedSearch, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        search: debouncedSearch,
        page: page.toString(),
        pageSize: PAGE_SIZE.toString(),
      })
      const res = await fetch(`/api/admin/volunteers?${params}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch volunteers')
      return res.json()
    },
    enabled: !!session,
  })

  const totalPages = data ? Math.ceil((data.total || 0) / PAGE_SIZE) : 0
  const volunteers = data?.data ?? []
  const showLoading = isLoading || (isFetching && volunteers.length === 0)

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0 bg-background border-b pb-3 pt-1 px-1 -mx-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by Name or YA ID..."
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value); setPage(0) }}
            className="pl-10 h-11"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">{data?.total ?? '—'} volunteers</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pt-3 space-y-2">
        {showLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : volunteers.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No volunteers found</p>
            </CardContent>
          </Card>
        ) : (
          volunteers.map((vol) => (
            <Card
              key={vol.id}
              className="cursor-pointer hover:border-primary/30 active:scale-[0.99] transition-all"
              onClick={() => onSelectVolunteer(vol.user_id ?? vol.id)}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 shrink-0">
                    <AvatarImage src={vol.photo_url} alt={vol.full_name} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {(vol.full_name || 'V').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{vol.full_name || 'Unnamed'}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {vol.ya_id && (
                        <Badge variant="secondary" className="text-[10px] font-mono">
                          {vol.ya_id}
                        </Badge>
                      )}
                      {vol.profiles_data?.contact_number && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                          <Phone className="h-3 w-3" />
                          {vol.profiles_data.contact_number}
                        </span>
                      )}
                      {vol.profiles_data?.sewa_center && (
                        <span className="text-[11px] text-muted-foreground truncate">
                          {vol.profiles_data.sewa_center}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-muted-foreground shrink-0">
                    <span className="sr-only">Open</span>
                    <span className="text-lg leading-none">›</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="shrink-0 bg-background border-t py-3 flex items-center justify-between px-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}

// --------------- Detail Sheet ---------------
function VolunteerDetailSheet({
  userId,
  open,
  onClose,
  session,
  canEdit,
}) {
  const queryClient = useQueryClient()
  const [editMode, setEditMode] = useState(false)
  const [formData, setFormData] = useState({})
  const [saving, setSaving] = useState(false)

  const { data: volunteer, isLoading } = useQuery({
    queryKey: ['volunteer-detail', userId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/volunteer/${userId}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error('Failed to load')
      return res.json()
    },
    enabled: !!userId && open,
  })

  useEffect(() => {
    if (volunteer?.core || volunteer?.data) {
      setFormData({
        ...(volunteer.data || {}),
        ya_id: volunteer.core?.ya_id ?? '',
        first_name: volunteer.core?.first_name ?? '',
        middle_name: volunteer.core?.middle_name ?? '',
        last_name: volunteer.core?.last_name ?? '',
        full_name: volunteer.core?.full_name ?? '',
      })
    }
  }, [volunteer])

  const handleChange = useCallback((key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const {
        ya_id,
        first_name,
        middle_name,
        last_name,
        full_name,
        id,
        user_id,
        created_at,
        updated_at,
        ...dataFields
      } = formData
      const computedFullName =
        [first_name, middle_name, last_name].filter(Boolean).join(' ') || full_name

      const res = await fetch('/api/admin/volunteer-update', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target_user_id: userId,
          core: { ya_id, first_name, middle_name, last_name, full_name: computedFullName },
          data: dataFields,
        }),
      })

      if (res.ok) {
        toast.success('Changes saved')
        queryClient.invalidateQueries({ queryKey: ['volunteer-detail', userId] })
        queryClient.invalidateQueries({ queryKey: ['volunteers'] })
        setEditMode(false)
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Save failed')
      }
    } catch {
      toast.error('Save failed')
    }
    setSaving(false)
  }, [formData, userId, session, queryClient])

  const displayName = volunteer?.core?.full_name || formData.full_name || 'Volunteer'
  const activeStatus = (volunteer?.data?.active_status || formData.active_status || '').trim() || '—'
  const isActive = activeStatus.toLowerCase() === 'active'

  const mergedData = useMemo(() => ({ ...(volunteer?.data || {}), ...formData }), [volunteer, formData])

  const renderFieldValue = (field) => {
    const val = field.source === 'core'
      ? (volunteer?.core?.[field.key] ?? formData[field.key])
      : mergedData[field.key]
    return (val ?? '') === '' ? '—' : String(val)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && editMode) return
        if (!isOpen) onClose()
      }}
    >
      <SheetContent
        side="bottom"
        className="left-1/2 right-auto -translate-x-1/2 w-full max-w-sm h-[90vh] rounded-t-2xl flex flex-col p-0 sheet-slide-from-bottom-center"
        onPointerDownOutside={(e) => editMode && e.preventDefault()}
        onInteractOutside={(e) => editMode && e.preventDefault()}
      >
        <SheetHeader className="px-4 pt-4 pb-2 pr-12 border-b shrink-0 text-left">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-xl truncate">{displayName}</SheetTitle>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {volunteer?.core?.ya_id != null && volunteer.core.ya_id !== '' && (
                  <Badge variant="secondary" className="font-mono text-xs">
                    {volunteer.core.ya_id}
                  </Badge>
                )}
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <CircleDot className={`h-3 w-3 ${isActive ? 'text-green-600' : ''}`} />
                  {activeStatus}
                </span>
              </div>
            </div>
            {canEdit && (
              <Button
                type="button"
                variant={editMode ? 'secondary' : 'ghost'}
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => setEditMode((v) => !v)}
                aria-label={editMode ? 'Exit edit mode' : 'Edit'}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-24">
          {isLoading ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <Accordion type="multiple" defaultValue={['personal', 'sewa', 'logistics']} className="w-full py-2">
              <AccordionItem value="personal">
                <AccordionTrigger className="text-sm font-medium">
                  Personal & Contact
                </AccordionTrigger>
                <AccordionContent>
                  {editMode ? (
                    <div className="grid grid-cols-1 gap-3">
                      {PERSONAL_CONTACT_FIELDS.map((f) => (
                        <FormField
                          key={f.key}
                          field={f}
                          value={formData[f.key]}
                          onChange={handleChange}
                        />
                      ))}
                    </div>
                  ) : (
                    <dl className="space-y-2 text-sm">
                      {PERSONAL_CONTACT_FIELDS.map((f) => (
                        <div key={f.key} className="flex justify-between gap-2">
                          <dt className="text-muted-foreground shrink-0">{f.label}</dt>
                          <dd className="text-right break-words">{renderFieldValue(f)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="sewa">
                <AccordionTrigger className="text-sm font-medium">
                  Sewa Details
                </AccordionTrigger>
                <AccordionContent>
                  {editMode ? (
                    <div className="grid grid-cols-1 gap-3">
                      {SEWA_FIELDS.map((f) => (
                        <FormField
                          key={f.key}
                          field={f}
                          value={formData[f.key]}
                          onChange={handleChange}
                        />
                      ))}
                    </div>
                  ) : (
                    <dl className="space-y-2 text-sm">
                      {SEWA_FIELDS.map((f) => (
                        <div key={f.key} className="flex justify-between gap-2">
                          <dt className="text-muted-foreground shrink-0">{f.label}</dt>
                          <dd className="text-right break-words">{renderFieldValue(f)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="logistics">
                <AccordionTrigger className="text-sm font-medium">
                  Logistics & Uniform
                </AccordionTrigger>
                <AccordionContent>
                  {editMode ? (
                    <div className="grid grid-cols-1 gap-3">
                      {LOGISTICS_FIELDS.map((f) => (
                        <FormField
                          key={f.key}
                          field={f}
                          value={formData[f.key]}
                          onChange={handleChange}
                        />
                      ))}
                    </div>
                  ) : (
                    <dl className="space-y-2 text-sm">
                      {LOGISTICS_FIELDS.map((f) => (
                        <div key={f.key} className="flex justify-between gap-2">
                          <dt className="text-muted-foreground shrink-0">{f.label}</dt>
                          <dd className="text-right break-words">{renderFieldValue(f)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </div>

        {canEdit && editMode && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-background/95 border-t">
            <Button
              className="w-full h-12 font-medium"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

// --------------- Page ---------------
export default function VolunteersPage() {
  const { session, role, accessibleModules } = useDashboard()
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const canEdit = role === 'admin' || (Array.isArray(accessibleModules) && accessibleModules.includes('profile_edit'))

  const handleSelect = useCallback((userId) => {
    setSelectedUserId(userId)
    setSheetOpen(true)
  }, [])

  const handleCloseSheet = useCallback(() => {
    setSheetOpen(false)
    setSelectedUserId(null)
  }, [])

  return (
    <div className="p-4 pb-6 flex flex-col">
      <div className="shrink-0 mb-3">
        <h2 className="text-lg font-bold">Volunteers</h2>
        <p className="text-xs text-muted-foreground">
          Search and view volunteer profiles
        </p>
      </div>

      <div className="flex flex-col max-h-[calc(100vh-14rem)] min-h-[320px]">
        <VolunteerMasterList
        session={session}
        onSelectVolunteer={handleSelect}
        canEdit={canEdit}
        />
      </div>

      <VolunteerDetailSheet
        userId={selectedUserId}
        open={sheetOpen}
        onClose={handleCloseSheet}
        session={session}
        canEdit={canEdit}
      />
    </div>
  )
}
