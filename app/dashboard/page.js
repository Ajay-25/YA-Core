'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogTrigger, DialogFooter
} from '@/components/ui/dialog'
import {
  User, QrCode, Users, LogOut, Loader2, Save,
  Search, ChevronRight, Package, CheckCircle2,
  Shield, Phone, MapPin, Heart, Briefcase, FileText,
  AlertTriangle, ArrowLeft, UserCog, Plus, Minus,
  Box, History, Send, Trash2, Edit2, BarChart3
} from 'lucide-react'
import {
  PERSONAL_FIELDS, CONTACT_FIELDS, ADDRESS_FIELDS, SEWA_FIELDS,
  EDUCATION_FIELDS, YA_STATUS_FIELDS, SENSITIVE_FIELDS,
  PROFILE_TABS, groupBySection
} from '@/lib/field-configs'

// ============================================================
// FORM FIELD COMPONENT
// ============================================================
function FormField({ field, value, onChange, disabled }) {
  const val = value ?? ''

  if (field.type === 'select') {
    return (
      <div className="space-y-1">
        <Label className="text-xs font-medium text-muted-foreground">{field.label}</Label>
        <select
          value={val}
          onChange={(e) => onChange(field.key, e.target.value)}
          disabled={disabled}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">Select...</option>
          {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
    )
  }

  if (field.type === 'textarea') {
    return (
      <div className="space-y-1 sm:col-span-2">
        <Label className="text-xs font-medium text-muted-foreground">{field.label}</Label>
        <textarea
          value={val}
          onChange={(e) => onChange(field.key, e.target.value)}
          disabled={disabled}
          rows={2}
          className="flex min-h-[56px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-muted-foreground">{field.label}</Label>
      <Input
        type={field.type || 'text'}
        value={val}
        onChange={(e) => onChange(field.key, e.target.value)}
        disabled={disabled}
        className="h-9"
      />
    </div>
  )
}

function FieldGroup({ title, icon, fields, formData, onChange, disabled }) {
  return (
    <div className="space-y-2">
      {title && (
        <div className="flex items-center gap-2 pt-2 pb-1">
          {icon}
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {fields.map(f => (
          <FormField key={f.key} field={f} value={formData[f.key]} onChange={onChange} disabled={disabled} />
        ))}
      </div>
    </div>
  )
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 rounded-lg transition-colors ${
        active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  )
}

// ============================================================
// PROFILE VIEW
// ============================================================
function ProfileView({ user, userRole, formData, setFormData, onSave, saving, isAdmin }) {
  const handleChange = useCallback((key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }, [setFormData])

  const sectionIcons = {
    'Permanent Address': <MapPin className="h-3.5 w-3.5 text-orange-500" />,
    'Communication Address': <MapPin className="h-3.5 w-3.5 text-blue-500" />,
    'Center & Zone': <Shield className="h-3.5 w-3.5 text-teal-500" />,
    'Initiation': <Heart className="h-3.5 w-3.5 text-red-500" />,
    'Sewa Areas - Permanent': <MapPin className="h-3.5 w-3.5 text-green-500" />,
    'Sewa Areas - Current': <MapPin className="h-3.5 w-3.5 text-cyan-500" />,
    'Qualification': <FileText className="h-3.5 w-3.5 text-indigo-500" />,
    'Profession': <Briefcase className="h-3.5 w-3.5 text-amber-500" />,
    'I-Card & Uniform': <Package className="h-3.5 w-3.5 text-purple-500" />,
    'Orientation': <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
    'Status': <BarChart3 className="h-3.5 w-3.5 text-blue-500" />,
    'Digital & Apps': <Phone className="h-3.5 w-3.5 text-pink-500" />,
    'Preferences': <Heart className="h-3.5 w-3.5 text-rose-500" />,
    'Data Metadata': <FileText className="h-3.5 w-3.5 text-gray-500" />,
    'ID Proof': <FileText className="h-3.5 w-3.5 text-blue-500" />,
    'Admin': <UserCog className="h-3.5 w-3.5 text-red-500" />,
  }

  return (
    <div className="p-4 pb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold">My Profile</h2>
          <p className="text-xs text-muted-foreground">Manage your information across all sections</p>
        </div>
        <Button onClick={onSave} disabled={saving} size="sm" className="gap-1.5">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save
        </Button>
      </div>

      <Tabs defaultValue="personal" className="w-full">
        <div className="overflow-x-auto -mx-4 px-4 pb-1">
          <TabsList className="inline-flex w-auto min-w-full sm:w-full h-9">
            {PROFILE_TABS.map(tab => (
              <TabsTrigger key={tab.id} value={tab.id} className="text-[11px] px-2.5 whitespace-nowrap">
                {tab.label}
              </TabsTrigger>
            ))}
            {isAdmin && (
              <TabsTrigger value="sensitive" className="text-[11px] px-2.5 whitespace-nowrap">
                Admin
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {PROFILE_TABS.map(tab => {
          const sections = groupBySection(tab.fields)
          const hasSections = Object.keys(sections).some(s => s !== 'General')

          return (
            <TabsContent key={tab.id} value={tab.id} className="mt-3">
              <Card>
                <CardContent className="pt-4 space-y-3 pb-4">
                  {hasSections ? (
                    Object.entries(sections).map(([section, fields]) => (
                      <FieldGroup
                        key={section}
                        title={section}
                        icon={sectionIcons[section] || null}
                        fields={fields}
                        formData={formData}
                        onChange={handleChange}
                      />
                    ))
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {tab.fields.map(f => (
                        <FormField key={f.key} field={f} value={formData[f.key]} onChange={handleChange} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )
        })}

        {isAdmin && (
          <TabsContent value="sensitive" className="mt-3">
            <Card>
              <CardContent className="py-8 text-center">
                <Shield className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Sensitive data is view-only from your own profile.<br/>Use the Volunteers list to manage sensitive fields.</p>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

// ============================================================
// QR CODE VIEW
// ============================================================
function QRCodeView({ user, coreData }) {
  const [QRCode, setQRCode] = useState(null)
  useEffect(() => {
    import('react-qr-code').then(mod => setQRCode(() => mod.default || mod))
  }, [])

  return (
    <div className="p-4 flex flex-col items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-lg">My QR Code</CardTitle>
          <CardDescription>Show this for identification</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4 pb-6">
          <div className="bg-white p-4 rounded-xl shadow-inner">
            {QRCode && user?.id ? (
              <QRCode value={user.id} size={200} level="H" />
            ) : (
              <div className="w-[200px] h-[200px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="text-center">
            <p className="font-semibold text-lg">{coreData?.full_name || 'Volunteer'}</p>
            {coreData?.ya_id && <Badge variant="secondary" className="mt-1">{coreData.ya_id}</Badge>}
            <p className="text-xs text-muted-foreground font-mono mt-2">{user?.id}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// STOCK MANAGEMENT VIEW (replaces Scanner)
// ============================================================
function StockManagementView({ session }) {
  const [activeTab, setActiveTab] = useState('inventory')
  const queryClient = useQueryClient()

  // Fetch stock items
  const { data: stockData, isLoading: stockLoading } = useQuery({
    queryKey: ['stock-items'],
    queryFn: async () => {
      const res = await fetch('/api/admin/stock', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      if (!res.ok) throw new Error('Failed to fetch stock')
      return res.json()
    },
    enabled: !!session
  })

  return (
    <div className="p-4 pb-6">
      <div className="mb-4">
        <h2 className="text-lg font-bold">Stock Management</h2>
        <p className="text-xs text-muted-foreground">Manage inventory & issue stock to volunteers</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="inventory" className="text-xs gap-1"><Box className="h-3.5 w-3.5" />Inventory</TabsTrigger>
          <TabsTrigger value="issue" className="text-xs gap-1"><Send className="h-3.5 w-3.5" />Issue</TabsTrigger>
          <TabsTrigger value="history" className="text-xs gap-1"><History className="h-3.5 w-3.5" />History</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="mt-0">
          <InventoryTab session={session} stockData={stockData} stockLoading={stockLoading} />
        </TabsContent>

        <TabsContent value="issue" className="mt-0">
          <IssueStockTab session={session} stockItems={stockData?.data || []} />
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <IssuanceHistoryTab session={session} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// -- INVENTORY TAB --
function InventoryTab({ session, stockData, stockLoading }) {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ name: '', category: 'General', description: '', total_quantity: 0, unit: 'pcs', min_stock_level: 0 })
  const [saving, setSaving] = useState(false)
  const queryClient = useQueryClient()

  const items = stockData?.data || []

  const handleSave = async () => {
    setSaving(true)
    try {
      const url = editItem ? '/api/admin/stock/update' : '/api/admin/stock'
      const body = editItem ? { id: editItem.id, ...form } : form

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (res.ok) {
        toast.success(editItem ? 'Item updated!' : 'Item added!')
        queryClient.invalidateQueries({ queryKey: ['stock-items'] })
        setShowAddDialog(false)
        setEditItem(null)
        setForm({ name: '', category: 'General', description: '', total_quantity: 0, unit: 'pcs', min_stock_level: 0 })
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed')
      }
    } catch { toast.error('Network error') }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this item?')) return
    const res = await fetch('/api/admin/stock/delete', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    if (res.ok) {
      toast.success('Item deleted')
      queryClient.invalidateQueries({ queryKey: ['stock-items'] })
    }
  }

  const openEdit = (item) => {
    setEditItem(item)
    setForm({
      name: item.name,
      category: item.category || 'General',
      description: item.description || '',
      total_quantity: item.total_quantity,
      unit: item.unit || 'pcs',
      min_stock_level: item.min_stock_level || 0
    })
    setShowAddDialog(true)
  }

  const categories = [...new Set(items.map(i => i.category || 'General'))]

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm font-medium">{items.length} items in inventory</p>
        <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) { setEditItem(null); setForm({ name: '', category: 'General', description: '', total_quantity: 0, unit: 'pcs', min_stock_level: 0 }) } }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Add Item</Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{editItem ? 'Edit Item' : 'Add Stock Item'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1"><Label className="text-xs">Item Name *</Label><Input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} placeholder="e.g. Kit Bag, T-Shirt M" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-xs">Category</Label><Input value={form.category} onChange={e => setForm(p => ({...p, category: e.target.value}))} placeholder="General" /></div>
                <div className="space-y-1"><Label className="text-xs">Unit</Label><Input value={form.unit} onChange={e => setForm(p => ({...p, unit: e.target.value}))} placeholder="pcs" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-xs">Total Quantity</Label><Input type="number" value={form.total_quantity} onChange={e => setForm(p => ({...p, total_quantity: parseInt(e.target.value) || 0}))} /></div>
                <div className="space-y-1"><Label className="text-xs">Min Stock Level</Label><Input type="number" value={form.min_stock_level} onChange={e => setForm(p => ({...p, min_stock_level: parseInt(e.target.value) || 0}))} /></div>
              </div>
              <div className="space-y-1"><Label className="text-xs">Description</Label><Input value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} /></div>
            </div>
            <DialogFooter>
              <Button onClick={handleSave} disabled={saving || !form.name} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {editItem ? 'Update' : 'Add Item'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {stockLoading ? (
        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Box className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <h3 className="font-semibold mb-1">No items yet</h3>
            <p className="text-sm text-muted-foreground">Add stock items to start tracking inventory</p>
          </CardContent>
        </Card>
      ) : (
        categories.map(cat => (
          <div key={cat}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{cat}</h3>
            <div className="space-y-2">
              {items.filter(i => (i.category || 'General') === cat).map(item => {
                const available = item.total_quantity - (item.issued_quantity || 0)
                const pct = item.total_quantity > 0 ? (available / item.total_quantity) * 100 : 0
                const isLow = available <= (item.min_stock_level || 0) && item.total_quantity > 0

                return (
                  <Card key={item.id} className={isLow ? 'border-amber-300 bg-amber-50/50' : ''}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-sm">{item.name}</h4>
                            {isLow && <Badge variant="outline" className="text-[9px] border-amber-500 text-amber-700">LOW</Badge>}
                          </div>
                          {item.description && <p className="text-[11px] text-muted-foreground">{item.description}</p>}
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(item.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <Progress value={pct} className="h-2" />
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="text-sm font-bold">{available}</span>
                          <span className="text-xs text-muted-foreground">/{item.total_quantity} {item.unit}</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">Issued: {item.issued_quantity || 0}</p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// -- ISSUE STOCK TAB --
function IssueStockTab({ session, stockItems }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedVolunteer, setSelectedVolunteer] = useState(null)
  const [selectedItem, setSelectedItem] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')
  const [issuing, setIssuing] = useState(false)
  const queryClient = useQueryClient()

  // Search volunteers
  const { data: searchResults, isLoading: searching } = useQuery({
    queryKey: ['search-volunteers', searchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/admin/stock/search-volunteers?q=${encodeURIComponent(searchQuery)}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      if (!res.ok) throw new Error('Search failed')
      return res.json()
    },
    enabled: searchQuery.length >= 2
  })

  const handleIssue = async () => {
    if (!selectedVolunteer || !selectedItem || quantity < 1) {
      toast.error('Please fill all fields')
      return
    }
    setIssuing(true)
    try {
      const res = await fetch('/api/admin/stock/issue', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_user_id: selectedVolunteer.user_id,
          stock_item_id: selectedItem,
          quantity,
          notes,
          year: new Date().getFullYear()
        })
      })

      if (res.ok) {
        toast.success(`Issued to ${selectedVolunteer.full_name}!`)
        queryClient.invalidateQueries({ queryKey: ['stock-items'] })
        queryClient.invalidateQueries({ queryKey: ['stock-history'] })
        setSelectedVolunteer(null)
        setSelectedItem('')
        setQuantity(1)
        setNotes('')
        setSearchQuery('')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to issue')
      }
    } catch { toast.error('Network error') }
    setIssuing(false)
  }

  const selectedStockItem = stockItems.find(i => i.id === selectedItem)
  const available = selectedStockItem ? selectedStockItem.total_quantity - (selectedStockItem.issued_quantity || 0) : 0

  return (
    <div className="space-y-4">
      {/* Step 1: Select Volunteer */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <div className="w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-[10px] font-bold">1</div>
            Select Volunteer
          </h3>
          {selectedVolunteer ? (
            <div className="flex items-center justify-between bg-muted/50 p-2.5 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{selectedVolunteer.full_name}</p>
                  {selectedVolunteer.ya_id && <p className="text-[10px] text-muted-foreground">{selectedVolunteer.ya_id}</p>}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setSelectedVolunteer(null); setSearchQuery('') }}>
                Change
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or YA ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-9"
                />
              </div>
              {searching && <div className="flex items-center justify-center p-3"><Loader2 className="h-4 w-4 animate-spin" /></div>}
              {searchResults?.data?.length > 0 && (
                <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                  {searchResults.data.map(vol => (
                    <button
                      key={vol.user_id}
                      onClick={() => { setSelectedVolunteer(vol); setSearchQuery('') }}
                      className="w-full text-left p-2.5 hover:bg-muted/50 transition-colors flex items-center gap-2"
                    >
                      <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{vol.full_name}</p>
                        <p className="text-[10px] text-muted-foreground">{vol.ya_id || vol.role}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Select Item & Quantity */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <div className="w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-[10px] font-bold">2</div>
            Select Item & Quantity
          </h3>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Stock Item</Label>
              <select
                value={selectedItem}
                onChange={(e) => setSelectedItem(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Select an item...</option>
                {stockItems.map(item => {
                  const avail = item.total_quantity - (item.issued_quantity || 0)
                  return (
                    <option key={item.id} value={item.id} disabled={avail <= 0}>
                      {item.name} ({avail} available)
                    </option>
                  )
                })}
              </select>
            </div>

            {selectedStockItem && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Available:</span>
                <span className={`font-bold ${available <= 0 ? 'text-destructive' : 'text-green-600'}`}>
                  {available} {selectedStockItem.unit}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Quantity</Label>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setQuantity(q => Math.max(1, q - 1))}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <Input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="h-9 text-center"
                    min={1}
                    max={available}
                  />
                  <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setQuantity(q => Math.min(available, q + 1))}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notes (optional)</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes..." className="h-9" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Issue Button */}
      <Button
        onClick={handleIssue}
        disabled={!selectedVolunteer || !selectedItem || quantity < 1 || available < quantity || issuing}
        className="w-full h-12 text-base font-semibold gap-2"
      >
        {issuing ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Send className="h-5 w-5" />
        )}
        Issue Stock
      </Button>
    </div>
  )
}

// -- ISSUANCE HISTORY TAB --
function IssuanceHistoryTab({ session }) {
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['stock-history', page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: page.toString(), pageSize: '30', search })
      const res = await fetch(`/api/admin/stock/history?${params}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    enabled: !!session
  })

  const totalPages = data ? Math.ceil(data.total / 30) : 0

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by item name..." value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} className="pl-10 h-9" />
      </div>

      {isLoading ? (
        Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
      ) : !data?.data?.length ? (
        <Card>
          <CardContent className="py-8 text-center">
            <History className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No issuance records yet</p>
          </CardContent>
        </Card>
      ) : (
        data.data.map(log => (
          <Card key={log.id}>
            <CardContent className="p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium">{log.item_name || log.stock_items?.name || 'Unknown Item'}</p>
                  <p className="text-xs text-muted-foreground">
                    To: <strong>{log.profiles_core?.full_name || 'Unknown'}</strong>
                    {log.profiles_core?.ya_id && <span className="ml-1 opacity-60">({log.profiles_core.ya_id})</span>}
                  </p>
                  {log.notes && <p className="text-[10px] text-muted-foreground mt-0.5">{log.notes}</p>}
                </div>
                <div className="text-right">
                  <Badge variant="secondary" className="text-[10px]">x{log.quantity}</Badge>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(log.issued_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</Button>
          <span className="text-xs text-muted-foreground">Page {page + 1}/{totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  )
}

// ============================================================
// VOLUNTEER LIST VIEW (Admin)
// ============================================================
function VolunteerListView({ session, onSelectVolunteer }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const { data, isLoading } = useQuery({
    queryKey: ['volunteers', search, page],
    queryFn: async () => {
      const params = new URLSearchParams({ search, page: page.toString(), pageSize: '20' })
      const res = await fetch(`/api/admin/volunteers?${params}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    enabled: !!session
  })

  const totalPages = data ? Math.ceil(data.total / 20) : 0

  return (
    <div className="p-4">
      <div className="mb-4">
        <h2 className="text-lg font-bold">Volunteers</h2>
        <p className="text-xs text-muted-foreground">{data?.total || 0} total</p>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name or YA ID..." value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} className="pl-10 h-10" />
      </div>

      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}><CardContent className="p-3"><div className="flex items-center gap-3"><Skeleton className="w-10 h-10 rounded-full" /><div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div></div></CardContent></Card>
          ))
        ) : !data?.data?.length ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground"><Users className="h-10 w-10 mx-auto mb-2 opacity-40" /><p className="text-sm">No volunteers found</p></CardContent></Card>
        ) : (
          data.data.map(vol => (
            <Card key={vol.user_id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => onSelectVolunteer(vol.user_id)}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{vol.full_name || 'Unnamed'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {vol.ya_id && <span className="text-[10px] text-muted-foreground font-mono">{vol.ya_id}</span>}
                      {vol.profiles_data?.contact_number && <span className="text-[10px] text-muted-foreground">{vol.profiles_data.contact_number}</span>}
                      {vol.profiles_data?.sewa_center && <span className="text-[10px] text-muted-foreground">{vol.profiles_data.sewa_center}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={vol.role === 'admin' ? 'default' : 'secondary'} className="text-[10px]">{vol.role}</Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="text-xs text-muted-foreground">Page {page + 1}/{totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  )
}

// ============================================================
// VOLUNTEER DETAIL VIEW (Admin)
// ============================================================
function VolunteerDetailView({ session, userId, onBack, currentUserId }) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({})
  const [sensitiveData, setSensitiveData] = useState({})
  const [saving, setSaving] = useState(false)
  const [changingRole, setChangingRole] = useState(false)

  const { data: volunteer, isLoading } = useQuery({
    queryKey: ['volunteer-detail', userId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/volunteer/${userId}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    enabled: !!userId
  })

  useEffect(() => {
    if (volunteer) {
      setFormData({ ...(volunteer.data || {}), ya_id: volunteer.core?.ya_id || '', first_name: volunteer.core?.first_name || '', middle_name: volunteer.core?.middle_name || '', last_name: volunteer.core?.last_name || '', full_name: volunteer.core?.full_name || '' })
      setSensitiveData(volunteer.sensitive || {})
    }
  }, [volunteer])

  const handleChange = useCallback((key, value) => setFormData(prev => ({ ...prev, [key]: value })), [])
  const handleSensitiveChange = useCallback((key, value) => setSensitiveData(prev => ({ ...prev, [key]: value })), [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const { ya_id, first_name, middle_name, last_name, full_name, id, user_id, created_at, updated_at, ...dataFields } = formData
      const computedFullName = [first_name, middle_name, last_name].filter(Boolean).join(' ') || full_name

      // Update core + data via admin API
      const coreRes = await fetch('/api/admin/sensitive/update', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_user_id: userId, ...(() => { const { id: sId, user_id: sUid, created_at: sCa, updated_at: sUa, ...sensitiveFields } = sensitiveData; return sensitiveFields })() })
      })

      // Use the volunteer update endpoint
      const updateRes = await fetch('/api/admin/volunteer-update', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_user_id: userId,
          core: { ya_id, first_name, middle_name, last_name, full_name: computedFullName },
          data: dataFields
        })
      })

      if (updateRes.ok) {
        toast.success('Profile updated!')
        queryClient.invalidateQueries({ queryKey: ['volunteer-detail', userId] })
        queryClient.invalidateQueries({ queryKey: ['volunteers'] })
      } else {
        toast.error('Some fields may not have saved')
      }
    } catch { toast.error('Save failed') }
    setSaving(false)
  }

  const handleRoleChange = async (newRole) => {
    setChangingRole(true)
    try {
      const res = await fetch('/api/admin/set-role', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_user_id: userId, role: newRole })
      })
      if (res.ok) { toast.success(`Role changed to ${newRole}`); queryClient.invalidateQueries({ queryKey: ['volunteer-detail', userId] }); queryClient.invalidateQueries({ queryKey: ['volunteers'] }) }
      else toast.error('Failed to change role')
    } catch { toast.error('Network error') }
    setChangingRole(false)
  }

  if (isLoading) return <div className="p-4 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>

  const sectionIcons = {
    'Permanent Address': <MapPin className="h-3.5 w-3.5 text-orange-500" />,
    'Communication Address': <MapPin className="h-3.5 w-3.5 text-blue-500" />,
    'Center & Zone': <Shield className="h-3.5 w-3.5 text-teal-500" />,
    'Initiation': <Heart className="h-3.5 w-3.5 text-red-500" />,
    'Sewa Areas - Permanent': <MapPin className="h-3.5 w-3.5 text-green-500" />,
    'Sewa Areas - Current': <MapPin className="h-3.5 w-3.5 text-cyan-500" />,
    'Qualification': <FileText className="h-3.5 w-3.5 text-indigo-500" />,
    'Profession': <Briefcase className="h-3.5 w-3.5 text-amber-500" />,
    'I-Card & Uniform': <Package className="h-3.5 w-3.5 text-purple-500" />,
    'Orientation': <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
    'Status': <BarChart3 className="h-3.5 w-3.5 text-blue-500" />,
    'Digital & Apps': <Phone className="h-3.5 w-3.5 text-pink-500" />,
    'Preferences': <Heart className="h-3.5 w-3.5 text-rose-500" />,
    'Data Metadata': <FileText className="h-3.5 w-3.5 text-gray-500" />,
    'ID Proof': <FileText className="h-3.5 w-3.5 text-blue-500" />,
    'Admin': <UserCog className="h-3.5 w-3.5 text-red-500" />,
  }

  return (
    <div className="p-4 pb-6">
      <div className="flex items-center gap-2 mb-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 -ml-2"><ArrowLeft className="h-4 w-4" />Back</Button>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold">{formData.full_name || 'Volunteer'}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={volunteer?.core?.role === 'admin' ? 'default' : 'secondary'}>{volunteer?.core?.role}</Badge>
            {volunteer?.core?.ya_id && <Badge variant="outline" className="text-[10px] font-mono">{volunteer.core.ya_id}</Badge>}
            {volunteer?.core?.role !== 'admin' ? (
              <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => handleRoleChange('admin')} disabled={changingRole}>Promote Admin</Button>
            ) : userId !== currentUserId ? (
              <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => handleRoleChange('volunteer')} disabled={changingRole}>Demote</Button>
            ) : null}
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Save
        </Button>
      </div>

      <Tabs defaultValue="personal">
        <div className="overflow-x-auto -mx-4 px-4 pb-1">
          <TabsList className="inline-flex w-auto min-w-full h-9">
            {PROFILE_TABS.map(tab => (
              <TabsTrigger key={tab.id} value={tab.id} className="text-[11px] px-2.5 whitespace-nowrap">{tab.label}</TabsTrigger>
            ))}
            <TabsTrigger value="sensitive" className="text-[11px] px-2.5 whitespace-nowrap">Sensitive</TabsTrigger>
            <TabsTrigger value="issued" className="text-[11px] px-2.5 whitespace-nowrap">Issued Items</TabsTrigger>
          </TabsList>
        </div>

        {PROFILE_TABS.map(tab => {
          const sections = groupBySection(tab.fields)
          const hasSections = Object.keys(sections).some(s => s !== 'General')
          return (
            <TabsContent key={tab.id} value={tab.id} className="mt-3">
              <Card><CardContent className="pt-4 space-y-3 pb-4">
                {hasSections ? Object.entries(sections).map(([section, fields]) => (
                  <FieldGroup key={section} title={section} icon={sectionIcons[section]} fields={fields} formData={formData} onChange={handleChange} />
                )) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {tab.fields.map(f => <FormField key={f.key} field={f} value={formData[f.key]} onChange={handleChange} />)}
                  </div>
                )}
              </CardContent></Card>
            </TabsContent>
          )
        })}

        <TabsContent value="sensitive" className="mt-3">
          <Card><CardContent className="pt-4 space-y-3 pb-4">
            {Object.entries(groupBySection(SENSITIVE_FIELDS)).map(([section, fields]) => (
              <FieldGroup key={section} title={section} icon={sectionIcons[section]} fields={fields} formData={sensitiveData} onChange={handleSensitiveChange} />
            ))}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="issued" className="mt-3">
          <Card><CardContent className="pt-4 pb-4">
            {volunteer?.inventory?.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">No items issued yet</p>
            ) : (
              <div className="space-y-2">
                {(volunteer?.inventory || []).map(log => (
                  <div key={log.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">{log.item_name || log.stock_items?.name || 'Item'}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleDateString()} {log.notes && `- ${log.notes}`}</p>
                    </div>
                    <Badge variant="secondary">x{log.quantity}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================================
// SETUP VIEW
// ============================================================
function SetupView({ onRetry }) {
  const [copied, setCopied] = useState(false)
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const copySQL = async () => {
    try {
      const res = await fetch('/supabase-setup.sql')
      const sql = await res.text()
      await navigator.clipboard.writeText(sql)
      setCopied(true)
      toast.success('SQL copied!')
      setTimeout(() => setCopied(false), 3000)
    } catch { toast.error('Failed to copy') }
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mb-2"><AlertTriangle className="h-7 w-7 text-amber-600" /></div>
          <CardTitle>Database Setup Required</CardTitle>
          <CardDescription>Complete these steps to get started</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2"><div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">1</div><h3 className="font-semibold text-sm">Run SQL Setup Script</h3></div>
            <p className="text-xs text-muted-foreground ml-8">Go to <strong>Supabase Dashboard &gt; SQL Editor</strong> and run the setup script.</p>
            <div className="ml-8"><Button onClick={copySQL} variant="outline" size="sm" className="gap-1.5">{copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}{copied ? 'Copied!' : 'Copy SQL Script'}</Button></div>
          </div>
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center gap-2"><div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">2</div><h3 className="font-semibold text-sm">Configure Auth Redirect URLs</h3></div>
            <div className="text-xs text-muted-foreground ml-8 space-y-1">
              <p>Go to <strong>Authentication &gt; URL Configuration</strong></p>
              <p>Set <strong>Site URL</strong>:</p>
              <code className="block bg-muted p-2 rounded text-[11px] font-mono break-all">{siteUrl}</code>
              <p>Add to <strong>Redirect URLs</strong>:</p>
              <code className="block bg-muted p-2 rounded text-[11px] font-mono break-all">{siteUrl}/auth/callback</code>
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center gap-2"><div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">3</div><h3 className="font-semibold text-sm">Set First Admin</h3></div>
            <p className="text-xs text-muted-foreground ml-8">After signing up, run in SQL Editor:</p>
            <code className="block bg-muted p-2 rounded text-[10px] font-mono ml-8 break-all">UPDATE profiles_core SET role = 'admin' WHERE user_id = 'YOUR_USER_ID_HERE';</code>
          </div>
          <Button onClick={onRetry} className="w-full mt-4">I've completed the setup — Retry</Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// MAIN DASHBOARD
// ============================================================
function App() {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [currentView, setCurrentView] = useState('profile')
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [formData, setFormData] = useState({})
  const [saving, setSaving] = useState(false)
  const [selectedVolunteer, setSelectedVolunteer] = useState(null)
  const router = useRouter()
  const queryClient = useQueryClient()

  const isAdmin = userRole === 'admin'

  useEffect(() => {
    const init = async () => {
      const { data: { session: s } } = await supabase.auth.getSession()
      if (!s) { router.push('/'); return }
      setUser(s.user)
      setSession(s)

      // Use API endpoint (service role) to bypass RLS issues
      try {
        const ensureRes = await fetch('/api/profile/ensure', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${s.access_token}`, 'Content-Type': 'application/json' }
        })
        if (ensureRes.ok) {
          const ensureData = await ensureRes.json()
          if (ensureData.profile) {
            setUserRole(ensureData.profile.role || 'volunteer')
            setLoading(false)
            return
          }
        }
        // Fallback: try API /profile/me
        const meRes = await fetch('/api/profile/me', {
          headers: { 'Authorization': `Bearer ${s.access_token}` }
        })
        if (meRes.ok) {
          const meData = await meRes.json()
          if (meData.core) {
            setUserRole(meData.core.role || 'volunteer')
            setLoading(false)
            return
          }
        }
      } catch (e) { console.error('Profile fetch error:', e) }

      setNeedsSetup(true)
      setLoading(false)
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'SIGNED_OUT' || !newSession) router.push('/')
      if (newSession) { setSession(newSession); setUser(newSession.user) }
    })
    return () => subscription.unsubscribe()
  }, [router])

  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ['my-profile', user?.id],
    queryFn: async () => {
      // Use API to bypass RLS
      const res = await fetch('/api/profile/me', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      if (!res.ok) throw new Error('Failed to fetch profile')
      return res.json()
    },
    enabled: !!user?.id && !!session && !needsSetup && !loading
  })

  useEffect(() => {
    if (profileData && currentView === 'profile' && !selectedVolunteer) {
      setFormData({
        ...(profileData.data || {}),
        ya_id: profileData.core?.ya_id || '',
        first_name: profileData.core?.first_name || '',
        middle_name: profileData.core?.middle_name || '',
        last_name: profileData.core?.last_name || '',
        full_name: profileData.core?.full_name || '',
      })
    }
  }, [profileData, currentView, selectedVolunteer])

  const handleSave = async () => {
    setSaving(true)
    try {
      const { ya_id, first_name, middle_name, last_name, full_name, id, user_id, created_at, updated_at, ...dataFields } = formData
      const computedFullName = [first_name, middle_name, last_name].filter(Boolean).join(' ') || full_name

      // Use service role API for profile updates to bypass RLS
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          core: { ya_id, first_name, middle_name, last_name, full_name: computedFullName },
          data: dataFields
        })
      })

      if (res.ok) {
        toast.success('Profile saved!')
        queryClient.invalidateQueries({ queryKey: ['my-profile'] })
      } else {
        toast.error('Failed to save')
      }
    } catch { toast.error('Failed to save') }
    setSaving(false)
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/') }

  const handleRetrySetup = async () => {
    setNeedsSetup(false); setLoading(true)
    const { data: { session: s } } = await supabase.auth.getSession()
    if (s) {
      try {
        const ensureRes = await fetch('/api/profile/ensure', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${s.access_token}`, 'Content-Type': 'application/json' }
        })
        if (ensureRes.ok) {
          const ensureData = await ensureRes.json()
          if (ensureData.profile) {
            setUserRole(ensureData.profile.role || 'volunteer')
            setNeedsSetup(false)
            setLoading(false)
            return
          }
        }
      } catch (e) { console.error(e) }
      setNeedsSetup(true)
    }
    setLoading(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-3"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /><p className="text-sm text-muted-foreground">Loading...</p></div>
    </div>
  )

  if (needsSetup) return <SetupView onRetry={handleRetrySetup} />

  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-4 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-none">YA Core</h1>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5">{profileData?.core?.full_name || user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isAdmin ? 'default' : 'secondary'} className="text-[10px]">{userRole}</Badge>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleLogout}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        {selectedVolunteer ? (
          <VolunteerDetailView session={session} userId={selectedVolunteer} onBack={() => { setSelectedVolunteer(null); setCurrentView('volunteers') }} currentUserId={user?.id} />
        ) : currentView === 'profile' ? (
          profileLoading ? <div className="p-4 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>
          : <ProfileView user={user} userRole={userRole} formData={formData} setFormData={setFormData} onSave={handleSave} saving={saving} isAdmin={isAdmin} />
        ) : currentView === 'qrcode' ? (
          <QRCodeView user={user} coreData={profileData?.core} />
        ) : currentView === 'stock' && isAdmin ? (
          <StockManagementView session={session} />
        ) : currentView === 'volunteers' && isAdmin ? (
          <VolunteerListView session={session} onSelectVolunteer={(id) => { setSelectedVolunteer(id); setCurrentView('volunteers') }} />
        ) : null}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t z-50">
        <div className="max-w-2xl mx-auto flex justify-around py-1.5 px-2">
          <NavItem icon={<User className="h-5 w-5" />} label="Profile" active={currentView === 'profile' && !selectedVolunteer} onClick={() => { setCurrentView('profile'); setSelectedVolunteer(null) }} />
          <NavItem icon={<QrCode className="h-5 w-5" />} label="My QR" active={currentView === 'qrcode'} onClick={() => { setCurrentView('qrcode'); setSelectedVolunteer(null) }} />
          {isAdmin && (
            <>
              <NavItem icon={<Package className="h-5 w-5" />} label="Stock" active={currentView === 'stock'} onClick={() => { setCurrentView('stock'); setSelectedVolunteer(null) }} />
              <NavItem icon={<Users className="h-5 w-5" />} label="Volunteers" active={currentView === 'volunteers' || !!selectedVolunteer} onClick={() => { setCurrentView('volunteers'); setSelectedVolunteer(null) }} />
            </>
          )}
        </div>
      </nav>
    </div>
  )
}

export default App;
