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
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  User, QrCode, ScanLine, Users, LogOut, Loader2, Save,
  Search, ChevronRight, Package, CheckCircle2, XCircle,
  Shield, Phone, MapPin, Heart, Briefcase, FileText,
  AlertTriangle, Camera, KeyboardIcon, ArrowLeft, UserCog
} from 'lucide-react'

// ============================================================
// FIELD CONFIGURATIONS
// ============================================================
const IDENTITY_FIELDS = [
  { key: 'full_name', label: 'Full Name', type: 'text', source: 'core', section: 'Personal' },
  { key: 'date_of_birth', label: 'Date of Birth', type: 'date', source: 'data', section: 'Personal' },
  { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other', 'Prefer not to say'], source: 'data', section: 'Personal' },
  { key: 'nationality', label: 'Nationality', type: 'text', source: 'data', section: 'Personal' },
  { key: 'blood_type', label: 'Blood Type', type: 'select', options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'], source: 'data', section: 'Personal' },
  { key: 'phone', label: 'Phone', type: 'tel', source: 'data', section: 'Contact' },
  { key: 'alt_phone', label: 'Alt Phone', type: 'tel', source: 'data', section: 'Contact' },
  { key: 'email_secondary', label: 'Secondary Email', type: 'email', source: 'data', section: 'Contact' },
  { key: 'address_line1', label: 'Address Line 1', type: 'text', source: 'data', section: 'Address' },
  { key: 'address_line2', label: 'Address Line 2', type: 'text', source: 'data', section: 'Address' },
  { key: 'city', label: 'City', type: 'text', source: 'data', section: 'Address' },
  { key: 'state', label: 'State', type: 'text', source: 'data', section: 'Address' },
  { key: 'zip_code', label: 'ZIP Code', type: 'text', source: 'data', section: 'Address' },
  { key: 'country', label: 'Country', type: 'text', source: 'data', section: 'Address' },
  { key: 'emergency_contact_name', label: 'Emergency Contact', type: 'text', source: 'data', section: 'Emergency' },
  { key: 'emergency_contact_phone', label: 'Emergency Phone', type: 'tel', source: 'data', section: 'Emergency' },
  { key: 'emergency_contact_relation', label: 'Relationship', type: 'text', source: 'data', section: 'Emergency' },
]

const LOGISTICS_FIELDS = [
  { key: 'uniform_size', label: 'Uniform Size', type: 'select', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'], source: 'data', section: 'Sizing' },
  { key: 't_shirt_size', label: 'T-Shirt Size', type: 'select', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'], source: 'data', section: 'Sizing' },
  { key: 'shoe_size', label: 'Shoe Size', type: 'text', source: 'data', section: 'Sizing' },
  { key: 'cap_size', label: 'Cap Size', type: 'text', source: 'data', section: 'Sizing' },
  { key: 'skills', label: 'Skills', type: 'text', source: 'data', section: 'Skills & Languages' },
  { key: 'languages', label: 'Languages', type: 'text', source: 'data', section: 'Skills & Languages' },
  { key: 'certifications', label: 'Certifications', type: 'text', source: 'data', section: 'Skills & Languages' },
  { key: 'specializations', label: 'Specializations', type: 'text', source: 'data', section: 'Skills & Languages' },
  { key: 'dietary_reqs', label: 'Dietary Requirements', type: 'text', source: 'data', section: 'Health' },
  { key: 'allergies', label: 'Allergies', type: 'text', source: 'data', section: 'Health' },
  { key: 'medical_conditions', label: 'Medical Conditions', type: 'text', source: 'data', section: 'Health' },
  { key: 'medications', label: 'Medications', type: 'text', source: 'data', section: 'Health' },
  { key: 'availability', label: 'Availability', type: 'text', source: 'data', section: 'Assignment' },
  { key: 'preferred_location', label: 'Preferred Location', type: 'text', source: 'data', section: 'Assignment' },
  { key: 'preferred_shift', label: 'Preferred Shift', type: 'text', source: 'data', section: 'Assignment' },
  { key: 'zone_assigned', label: 'Zone Assigned', type: 'text', source: 'data', section: 'Assignment' },
  { key: 'team_assigned', label: 'Team Assigned', type: 'text', source: 'data', section: 'Assignment' },
  { key: 'transportation', label: 'Transportation', type: 'text', source: 'data', section: 'Travel' },
  { key: 'has_vehicle', label: 'Has Vehicle', type: 'switch', source: 'data', section: 'Travel' },
  { key: 'vehicle_type', label: 'Vehicle Type', type: 'text', source: 'data', section: 'Travel' },
  { key: 'travel_mode', label: 'Travel Mode', type: 'text', source: 'data', section: 'Travel' },
  { key: 'accommodation_needed', label: 'Accommodation Needed', type: 'switch', source: 'data', section: 'Travel' },
  { key: 'accommodation_details', label: 'Accommodation Details', type: 'text', source: 'data', section: 'Travel' },
  { key: 'arrival_date', label: 'Arrival Date', type: 'date', source: 'data', section: 'Travel' },
  { key: 'departure_date', label: 'Departure Date', type: 'date', source: 'data', section: 'Travel' },
  { key: 'education', label: 'Education', type: 'text', source: 'data', section: 'Professional' },
  { key: 'occupation', label: 'Occupation', type: 'text', source: 'data', section: 'Professional' },
  { key: 'organization', label: 'Organization', type: 'text', source: 'data', section: 'Professional' },
  { key: 'department', label: 'Department', type: 'text', source: 'data', section: 'Professional' },
  { key: 'designation', label: 'Designation', type: 'text', source: 'data', section: 'Professional' },
  { key: 'years_of_experience', label: 'Years of Experience', type: 'number', source: 'data', section: 'Professional' },
  { key: 'volunteer_id_number', label: 'Volunteer ID', type: 'text', source: 'data', section: 'Other' },
  { key: 'reference_name', label: 'Reference Name', type: 'text', source: 'data', section: 'Other' },
  { key: 'reference_phone', label: 'Reference Phone', type: 'tel', source: 'data', section: 'Other' },
  { key: 'social_media', label: 'Social Media', type: 'text', source: 'data', section: 'Other' },
  { key: 'special_needs', label: 'Special Needs', type: 'text', source: 'data', section: 'Other' },
  { key: 'notes', label: 'Notes', type: 'textarea', source: 'data', section: 'Other' },
]

const SENSITIVE_FIELDS = [
  { key: 'id_proof_type', label: 'ID Proof Type', type: 'select', options: ['Passport', 'Drivers License', 'National ID', 'Aadhaar', 'Other'], section: 'Documents' },
  { key: 'id_proof_number', label: 'ID Proof Number', type: 'text', section: 'Documents' },
  { key: 'id_proof_url', label: 'ID Proof URL', type: 'text', section: 'Documents' },
  { key: 'background_check_status', label: 'Background Check', type: 'select', options: ['pending', 'in_progress', 'cleared', 'flagged', 'rejected'], section: 'Verification' },
  { key: 'background_check_notes', label: 'Check Notes', type: 'textarea', section: 'Verification' },
  { key: 'admin_notes', label: 'Admin Notes', type: 'textarea', section: 'Admin' },
  { key: 'flag_status', label: 'Flag Status', type: 'select', options: ['none', 'watch', 'restricted', 'blocked'], section: 'Admin' },
]

// ============================================================
// HELPER COMPONENTS
// ============================================================

function FormField({ field, value, onChange, disabled }) {
  const val = value ?? ''

  if (field.type === 'switch') {
    return (
      <div className="flex items-center justify-between py-2">
        <Label className="text-sm">{field.label}</Label>
        <Switch
          checked={!!val}
          onCheckedChange={(checked) => onChange(field.key, checked)}
          disabled={disabled}
        />
      </div>
    )
  }

  if (field.type === 'select') {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">{field.label}</Label>
        <select
          value={val}
          onChange={(e) => onChange(field.key, e.target.value)}
          disabled={disabled}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">Select...</option>
          {(field.options || []).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    )
  }

  if (field.type === 'textarea') {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">{field.label}</Label>
        <textarea
          value={val}
          onChange={(e) => onChange(field.key, e.target.value)}
          disabled={disabled}
          rows={3}
          className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{field.label}</Label>
      <Input
        type={field.type || 'text'}
        value={val}
        onChange={(e) => onChange(field.key, field.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value)}
        disabled={disabled}
        className="h-9"
      />
    </div>
  )
}

function FieldSection({ title, icon, fields, formData, onChange, disabled }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pt-2">
        {icon}
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map(field => (
          <FormField
            key={field.key}
            field={field}
            value={formData[field.key]}
            onChange={onChange}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  )
}

function NavItem({ icon, label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 rounded-lg transition-colors relative ${
        active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
      {badge && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  )
}

// ============================================================
// PROFILE VIEW
// ============================================================
function ProfileView({ user, userRole, formData, setFormData, onSave, saving, isAdmin, targetUserId }) {
  const handleChange = useCallback((key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }, [setFormData])

  const isViewingOwnProfile = !targetUserId || targetUserId === user?.id
  const sectionIcons = {
    'Personal': <User className="h-4 w-4 text-blue-500" />,
    'Contact': <Phone className="h-4 w-4 text-green-500" />,
    'Address': <MapPin className="h-4 w-4 text-orange-500" />,
    'Emergency': <Heart className="h-4 w-4 text-red-500" />,
    'Sizing': <Package className="h-4 w-4 text-purple-500" />,
    'Skills & Languages': <Briefcase className="h-4 w-4 text-indigo-500" />,
    'Health': <Heart className="h-4 w-4 text-pink-500" />,
    'Assignment': <MapPin className="h-4 w-4 text-teal-500" />,
    'Travel': <MapPin className="h-4 w-4 text-cyan-500" />,
    'Professional': <Briefcase className="h-4 w-4 text-amber-500" />,
    'Other': <FileText className="h-4 w-4 text-gray-500" />,
    'Documents': <FileText className="h-4 w-4 text-blue-500" />,
    'Verification': <Shield className="h-4 w-4 text-green-500" />,
    'Admin': <UserCog className="h-4 w-4 text-red-500" />,
  }

  const groupBySection = (fields) => {
    const groups = {}
    fields.forEach(f => {
      if (!groups[f.section]) groups[f.section] = []
      groups[f.section].push(f)
    })
    return groups
  }

  const identitySections = groupBySection(IDENTITY_FIELDS)
  const logisticsSections = groupBySection(LOGISTICS_FIELDS)
  const sensitiveSections = groupBySection(SENSITIVE_FIELDS)

  return (
    <div className="p-4 pb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold">
            {isViewingOwnProfile ? 'My Profile' : formData.full_name || 'Volunteer Profile'}
          </h2>
          <p className="text-xs text-muted-foreground">
            {isViewingOwnProfile ? 'Manage your information' : `User ID: ${targetUserId}`}
          </p>
        </div>
        <Button onClick={onSave} disabled={saving} size="sm" className="gap-1.5">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save
        </Button>
      </div>

      <Tabs defaultValue="identity" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="identity" className="text-xs">Identity</TabsTrigger>
          <TabsTrigger value="logistics" className="text-xs">Logistics</TabsTrigger>
          <TabsTrigger value="docs" className="text-xs">Docs</TabsTrigger>
        </TabsList>

        <TabsContent value="identity" className="mt-0">
          <Card>
            <CardContent className="pt-4 space-y-4">
              {Object.entries(identitySections).map(([section, fields]) => (
                <FieldSection
                  key={section}
                  title={section}
                  icon={sectionIcons[section]}
                  fields={fields}
                  formData={formData}
                  onChange={handleChange}
                />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logistics" className="mt-0">
          <Card>
            <CardContent className="pt-4 space-y-4">
              {Object.entries(logisticsSections).map(([section, fields]) => (
                <FieldSection
                  key={section}
                  title={section}
                  icon={sectionIcons[section]}
                  fields={fields}
                  formData={formData}
                  onChange={handleChange}
                />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docs" className="mt-0">
          {isAdmin ? (
            <Card>
              <CardContent className="pt-4 space-y-4">
                {Object.entries(sensitiveSections).map(([section, fields]) => (
                  <FieldSection
                    key={section}
                    title={section}
                    icon={sectionIcons[section]}
                    fields={fields}
                    formData={formData}
                    onChange={handleChange}
                  />
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Shield className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                <h3 className="font-semibold text-base mb-1">Restricted Access</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Document information is managed by administrators. Contact your coordinator for any updates.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================================
// QR CODE VIEW
// ============================================================
function QRCodeView({ user, userName }) {
  const [QRCode, setQRCode] = useState(null)

  useEffect(() => {
    import('react-qr-code').then(mod => {
      setQRCode(() => mod.default || mod)
    })
  }, [])

  return (
    <div className="p-4 flex flex-col items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-lg">My QR Code</CardTitle>
          <CardDescription>Show this to admins for kit collection</CardDescription>
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
            <p className="font-semibold text-lg">{userName || 'Volunteer'}</p>
            <p className="text-xs text-muted-foreground font-mono mt-1">{user?.id}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// ADMIN SCANNER VIEW
// ============================================================
function ScannerView({ user, session }) {
  const [mode, setMode] = useState('idle') // idle, scanning, manual, result
  const [scanResult, setScanResult] = useState(null)
  const [volunteerInfo, setVolunteerInfo] = useState(null)
  const [kitStatus, setKitStatus] = useState(null)
  const [issuing, setIssuing] = useState(false)
  const [manualId, setManualId] = useState('')
  const [loading, setLoading] = useState(false)
  const scannerRef = useRef(null)

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop()
        }
      } catch (e) {
        // ignore
      }
      scannerRef.current = null
    }
  }, [])

  const lookupVolunteer = useCallback(async (userId) => {
    setLoading(true)
    setScanResult(userId)
    setMode('result')

    try {
      const res = await fetch('/api/admin/inventory/check', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          target_user_id: userId,
          item_type: 'Kit',
          year: 2026
        })
      })

      if (!res.ok) {
        toast.error('Failed to lookup volunteer')
        setLoading(false)
        return
      }

      const data = await res.json()
      setVolunteerInfo(data.volunteer ? { ...data.volunteer, ...data.volunteerData } : null)
      setKitStatus(data.issued ? 'issued' : 'not_issued')
    } catch (err) {
      toast.error('Error looking up volunteer')
      console.error(err)
    }
    setLoading(false)
  }, [session])

  const startScanning = useCallback(async () => {
    setMode('scanning')
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const html5QrCode = new Html5Qrcode('qr-reader')
      scannerRef.current = html5QrCode

      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        async (decodedText) => {
          await stopScanner()
          lookupVolunteer(decodedText.trim())
        },
        () => {} // ignore errors
      )
    } catch (err) {
      console.error('Scanner error:', err)
      toast.error('Could not start camera. Try manual entry.')
      setMode('manual')
    }
  }, [stopScanner, lookupVolunteer])

  useEffect(() => {
    return () => { stopScanner() }
  }, [stopScanner])

  const handleIssueKit = async () => {
    setIssuing(true)
    try {
      const res = await fetch('/api/admin/inventory/issue', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          target_user_id: scanResult,
          item_type: 'Kit',
          year: 2026
        })
      })

      if (res.ok) {
        toast.success('Kit issued successfully!')
        setKitStatus('issued')
      } else {
        const data = await res.json()
        if (data.alreadyIssued) {
          toast.error('Kit already issued!')
          setKitStatus('issued')
        } else {
          toast.error(data.error || 'Failed to issue kit')
        }
      }
    } catch (err) {
      toast.error('Network error')
    }
    setIssuing(false)
  }

  const reset = () => {
    stopScanner()
    setScanResult(null)
    setVolunteerInfo(null)
    setKitStatus(null)
    setManualId('')
    setMode('idle')
  }

  const handleManualLookup = (e) => {
    e.preventDefault()
    if (manualId.trim()) {
      lookupVolunteer(manualId.trim())
    }
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold">Kit Scanner</h2>
          <p className="text-xs text-muted-foreground">Scan volunteer QR to check/issue kits</p>
        </div>
        {mode !== 'idle' && (
          <Button variant="outline" size="sm" onClick={reset} className="gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" />
            Reset
          </Button>
        )}
      </div>

      {/* Idle State */}
      {mode === 'idle' && (
        <div className="space-y-3">
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={startScanning}>
            <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
                <Camera className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Scan QR Code</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Use camera to scan volunteer QR</p>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setMode('manual')}>
            <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
              <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center">
                <KeyboardIcon className="h-8 w-8 text-secondary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">Enter ID Manually</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Type volunteer ID if QR not available</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Scanning State */}
      {mode === 'scanning' && (
        <Card>
          <CardContent className="p-4">
            <div id="qr-reader" className="rounded-xl overflow-hidden" />
            <p className="text-xs text-muted-foreground text-center mt-3">
              Point camera at volunteer QR code
            </p>
          </CardContent>
        </Card>
      )}

      {/* Manual Entry */}
      {mode === 'manual' && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleManualLookup} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Volunteer User ID</Label>
                <Input
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  placeholder="Enter UUID..."
                  autoFocus
                  className="font-mono text-sm"
                />
              </div>
              <Button type="submit" className="w-full" disabled={!manualId.trim() || loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                Lookup Volunteer
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Result State */}
      {mode === 'result' && (
        <div className="space-y-3">
          {loading ? (
            <Card>
              <CardContent className="p-6 space-y-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ) : volunteerInfo ? (
            <>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base truncate">{volunteerInfo.full_name || 'Unknown'}</h3>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {volunteerInfo.phone && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />{volunteerInfo.phone}
                          </span>
                        )}
                        {volunteerInfo.city && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />{volunteerInfo.city}
                          </span>
                        )}
                      </div>
                      <Badge variant="secondary" className="mt-2 text-[10px]">{volunteerInfo.role}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Kit Status Card */}
              <Card className={`border-2 ${kitStatus === 'issued' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
                <CardContent className="p-6 text-center">
                  {kitStatus === 'issued' ? (
                    <div className="space-y-3">
                      <XCircle className="h-16 w-16 text-red-500 mx-auto" />
                      <h3 className="text-xl font-bold text-red-700">ALREADY ISSUED</h3>
                      <p className="text-sm text-red-600">Kit for 2026 has been issued to this volunteer.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
                      <h3 className="text-xl font-bold text-green-700">READY TO ISSUE</h3>
                      <p className="text-sm text-green-600">No kit issued for 2026 yet.</p>
                      <Button
                        onClick={handleIssueKit}
                        disabled={issuing}
                        size="lg"
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold text-lg h-14"
                      >
                        {issuing ? (
                          <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        ) : (
                          <Package className="h-5 w-5 mr-2" />
                        )}
                        ISSUE KIT
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
                <h3 className="font-semibold text-base mb-1">Volunteer Not Found</h3>
                <p className="text-sm text-muted-foreground">
                  No volunteer found with this ID. Please verify the QR code.
                </p>
                <p className="text-xs text-muted-foreground mt-2 font-mono">{scanResult}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// ADMIN VOLUNTEER LIST VIEW
// ============================================================
function VolunteerListView({ session, onSelectVolunteer }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const pageSize = 20

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['volunteers', search, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        search,
        page: page.toString(),
        pageSize: pageSize.toString()
      })
      const res = await fetch(`/api/admin/volunteers?${params}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      if (!res.ok) throw new Error('Failed to fetch volunteers')
      return res.json()
    },
    enabled: !!session
  })

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0

  return (
    <div className="p-4">
      <div className="mb-4">
        <h2 className="text-lg font-bold">Volunteers</h2>
        <p className="text-xs text-muted-foreground">{data?.total || 0} total volunteers</p>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          className="pl-10 h-10"
        />
      </div>

      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : data?.data?.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No volunteers found</p>
            </CardContent>
          </Card>
        ) : (
          data?.data?.map(vol => (
            <Card
              key={vol.user_id}
              className="cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => onSelectVolunteer(vol.user_id)}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{vol.full_name || 'Unnamed'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {vol.profiles_data?.phone && (
                        <span className="text-xs text-muted-foreground">{vol.profiles_data.phone}</span>
                      )}
                      {vol.profiles_data?.city && (
                        <span className="text-xs text-muted-foreground">{vol.profiles_data.city}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={vol.role === 'admin' ? 'default' : 'secondary'} className="text-[10px]">
                      {vol.role}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
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
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}

// ============================================================
// VOLUNTEER DETAIL VIEW (Admin viewing a volunteer)
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
      if (!res.ok) throw new Error('Failed to fetch volunteer')
      return res.json()
    },
    enabled: !!userId && !!session
  })

  useEffect(() => {
    if (volunteer) {
      setFormData({
        ...(volunteer.data || {}),
        full_name: volunteer.core?.full_name || '',
      })
      setSensitiveData(volunteer.sensitive || {})
    }
  }, [volunteer])

  const handleChange = useCallback((key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleSensitiveChange = useCallback((key, value) => {
    setSensitiveData(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const { full_name, id, user_id, created_at, updated_at, ...dataFields } = formData

      // Update core
      const { error: coreError } = await supabase
        .from('profiles_core')
        .update({ full_name, updated_at: new Date().toISOString() })
        .eq('user_id', userId)

      // Update data
      const { error: dataError } = await supabase
        .from('profiles_data')
        .update({ ...dataFields, updated_at: new Date().toISOString() })
        .eq('user_id', userId)

      // Update sensitive via API (service role)
      const { id: sId, user_id: sUid, created_at: sCa, updated_at: sUa, ...sensitiveFields } = sensitiveData
      await fetch('/api/admin/sensitive/update', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ target_user_id: userId, ...sensitiveFields })
      })

      if (coreError || dataError) {
        toast.error('Some fields failed to save')
      } else {
        toast.success('Profile updated!')
        queryClient.invalidateQueries({ queryKey: ['volunteer-detail', userId] })
        queryClient.invalidateQueries({ queryKey: ['volunteers'] })
      }
    } catch (err) {
      toast.error('Save failed')
    }
    setSaving(false)
  }

  const handleRoleChange = async (newRole) => {
    setChangingRole(true)
    try {
      const res = await fetch('/api/admin/set-role', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ target_user_id: userId, role: newRole })
      })
      if (res.ok) {
        toast.success(`Role changed to ${newRole}`)
        queryClient.invalidateQueries({ queryKey: ['volunteer-detail', userId] })
        queryClient.invalidateQueries({ queryKey: ['volunteers'] })
      } else {
        toast.error('Failed to change role')
      }
    } catch (err) {
      toast.error('Network error')
    }
    setChangingRole(false)
  }

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const sectionIcons = {
    'Personal': <User className="h-4 w-4 text-blue-500" />,
    'Contact': <Phone className="h-4 w-4 text-green-500" />,
    'Address': <MapPin className="h-4 w-4 text-orange-500" />,
    'Emergency': <Heart className="h-4 w-4 text-red-500" />,
    'Sizing': <Package className="h-4 w-4 text-purple-500" />,
    'Skills & Languages': <Briefcase className="h-4 w-4 text-indigo-500" />,
    'Health': <Heart className="h-4 w-4 text-pink-500" />,
    'Assignment': <MapPin className="h-4 w-4 text-teal-500" />,
    'Travel': <MapPin className="h-4 w-4 text-cyan-500" />,
    'Professional': <Briefcase className="h-4 w-4 text-amber-500" />,
    'Other': <FileText className="h-4 w-4 text-gray-500" />,
    'Documents': <FileText className="h-4 w-4 text-blue-500" />,
    'Verification': <Shield className="h-4 w-4 text-green-500" />,
    'Admin': <UserCog className="h-4 w-4 text-red-500" />,
  }

  const groupBySection = (fields) => {
    const groups = {}
    fields.forEach(f => {
      if (!groups[f.section]) groups[f.section] = []
      groups[f.section].push(f)
    })
    return groups
  }

  return (
    <div className="p-4 pb-6">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 -ml-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold">{formData.full_name || 'Volunteer'}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={volunteer?.core?.role === 'admin' ? 'default' : 'secondary'}>
              {volunteer?.core?.role}
            </Badge>
            {volunteer?.core?.role !== 'admin' ? (
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => handleRoleChange('admin')}
                disabled={changingRole}
              >
                Promote to Admin
              </Button>
            ) : userId !== currentUserId ? (
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => handleRoleChange('volunteer')}
                disabled={changingRole}
              >
                Demote to Volunteer
              </Button>
            ) : null}
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save
        </Button>
      </div>

      <Tabs defaultValue="identity" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="identity" className="text-xs">Identity</TabsTrigger>
          <TabsTrigger value="logistics" className="text-xs">Logistics</TabsTrigger>
          <TabsTrigger value="docs" className="text-xs">Docs</TabsTrigger>
        </TabsList>

        <TabsContent value="identity" className="mt-0">
          <Card>
            <CardContent className="pt-4 space-y-4">
              {Object.entries(groupBySection(IDENTITY_FIELDS)).map(([section, fields]) => (
                <FieldSection key={section} title={section} icon={sectionIcons[section]} fields={fields} formData={formData} onChange={handleChange} />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logistics" className="mt-0">
          <Card>
            <CardContent className="pt-4 space-y-4">
              {Object.entries(groupBySection(LOGISTICS_FIELDS)).map(([section, fields]) => (
                <FieldSection key={section} title={section} icon={sectionIcons[section]} fields={fields} formData={formData} onChange={handleChange} />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docs" className="mt-0">
          <Card>
            <CardContent className="pt-4 space-y-4">
              {Object.entries(groupBySection(SENSITIVE_FIELDS)).map(([section, fields]) => (
                <FieldSection
                  key={section}
                  title={section}
                  icon={sectionIcons[section]}
                  fields={fields}
                  formData={sensitiveData}
                  onChange={handleSensitiveChange}
                />
              ))}
            </CardContent>
          </Card>
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
      toast.success('SQL copied to clipboard!')
      setTimeout(() => setCopied(false), 3000)
    } catch {
      toast.error('Failed to copy. Open /supabase-setup.sql manually.')
    }
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mb-2">
            <AlertTriangle className="h-7 w-7 text-amber-600" />
          </div>
          <CardTitle>Database Setup Required</CardTitle>
          <CardDescription>Complete these steps to get started</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">1</div>
              <h3 className="font-semibold text-sm">Run SQL Setup Script</h3>
            </div>
            <p className="text-xs text-muted-foreground ml-8">
              Go to <strong>Supabase Dashboard &gt; SQL Editor</strong> and run the setup script.
            </p>
            <div className="ml-8">
              <Button onClick={copySQL} variant="outline" size="sm" className="gap-1.5">
                {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                {copied ? 'Copied!' : 'Copy SQL Script'}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Step 2 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">2</div>
              <h3 className="font-semibold text-sm">Configure Auth Redirect URLs</h3>
            </div>
            <div className="text-xs text-muted-foreground ml-8 space-y-1">
              <p>Go to <strong>Supabase Dashboard &gt; Authentication &gt; URL Configuration</strong></p>
              <p>Set <strong>Site URL</strong> to:</p>
              <code className="block bg-muted p-2 rounded text-[11px] font-mono break-all">{siteUrl}</code>
              <p>Add to <strong>Redirect URLs</strong>:</p>
              <code className="block bg-muted p-2 rounded text-[11px] font-mono break-all">{siteUrl}/auth/callback</code>
            </div>
          </div>

          <Separator />

          {/* Step 3 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">3</div>
              <h3 className="font-semibold text-sm">Set First Admin</h3>
            </div>
            <p className="text-xs text-muted-foreground ml-8">
              After signing up, run this SQL to make yourself admin:
            </p>
            <code className="block bg-muted p-2 rounded text-[10px] font-mono ml-8 break-all">
              UPDATE profiles_core SET role = 'admin' WHERE full_name LIKE '%your_email%';
            </code>
          </div>

          <Button onClick={onRetry} className="w-full mt-4">
            I've completed the setup — Retry
          </Button>
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

  // Auth check
  useEffect(() => {
    const init = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!currentSession) {
        router.push('/')
        return
      }
      setUser(currentSession.user)
      setSession(currentSession)

      // Check if profile exists
      const { data: profile, error } = await supabase
        .from('profiles_core')
        .select('role, full_name')
        .eq('user_id', currentSession.user.id)
        .single()

      if (error) {
        console.error('Profile check error:', error)
        if (error.message?.includes('does not exist') || error.code === '42P01' || error.code === 'PGRST116') {
          // Try to ensure profile via API
          try {
            const ensureRes = await fetch('/api/profile/ensure', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${currentSession.access_token}`,
                'Content-Type': 'application/json'
              }
            })
            if (ensureRes.ok) {
              // Retry profile fetch
              const { data: retryProfile, error: retryError } = await supabase
                .from('profiles_core')
                .select('role, full_name')
                .eq('user_id', currentSession.user.id)
                .single()
              if (retryProfile) {
                setUserRole(retryProfile.role)
                setLoading(false)
                return
              }
            }
          } catch (e) {
            console.error('Profile ensure failed:', e)
          }
          setNeedsSetup(true)
          setLoading(false)
          return
        }
        setNeedsSetup(true)
        setLoading(false)
        return
      }

      setUserRole(profile?.role || 'volunteer')
      setLoading(false)
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'SIGNED_OUT' || !newSession) {
        router.push('/')
      }
      if (newSession) {
        setSession(newSession)
        setUser(newSession.user)
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  // Fetch own profile data using React Query
  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ['my-profile', user?.id],
    queryFn: async () => {
      const [coreRes, dataRes] = await Promise.all([
        supabase.from('profiles_core').select('*').eq('user_id', user.id).single(),
        supabase.from('profiles_data').select('*').eq('user_id', user.id).single()
      ])
      return { core: coreRes.data, data: dataRes.data }
    },
    enabled: !!user?.id && !needsSetup && !loading
  })

  // Populate form data when profile loads
  useEffect(() => {
    if (profileData && currentView === 'profile' && !selectedVolunteer) {
      setFormData({
        ...(profileData.data || {}),
        full_name: profileData.core?.full_name || '',
      })
    }
  }, [profileData, currentView, selectedVolunteer])

  const handleSave = async () => {
    setSaving(true)
    try {
      const { full_name, id, user_id, created_at, updated_at, ...dataFields } = formData

      const [coreResult, dataResult] = await Promise.all([
        supabase
          .from('profiles_core')
          .update({ full_name, updated_at: new Date().toISOString() })
          .eq('user_id', user.id),
        supabase
          .from('profiles_data')
          .update({ ...dataFields, updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
      ])

      if (coreResult.error || dataResult.error) {
        toast.error('Some fields failed to save')
        console.error(coreResult.error, dataResult.error)
      } else {
        toast.success('Profile saved!')
        queryClient.invalidateQueries({ queryKey: ['my-profile'] })
      }
    } catch (err) {
      toast.error('Failed to save profile')
      console.error(err)
    }
    setSaving(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleRetrySetup = async () => {
    setNeedsSetup(false)
    setLoading(true)
    const { data: { session: currentSession } } = await supabase.auth.getSession()
    if (currentSession) {
      const { data: profile } = await supabase
        .from('profiles_core')
        .select('role')
        .eq('user_id', currentSession.user.id)
        .single()
      if (profile) {
        setUserRole(profile.role)
        setNeedsSetup(false)
      } else {
        // Try ensure again
        await fetch('/api/profile/ensure', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${currentSession.access_token}` }
        })
        const { data: retryProfile } = await supabase
          .from('profiles_core')
          .select('role')
          .eq('user_id', currentSession.user.id)
          .single()
        if (retryProfile) {
          setUserRole(retryProfile.role)
          setNeedsSetup(false)
        } else {
          setNeedsSetup(true)
        }
      }
    }
    setLoading(false)
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  // Setup required
  if (needsSetup) {
    return <SetupView onRetry={handleRetrySetup} />
  }

  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-4 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-none">YA Core</h1>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
                {profileData?.core?.full_name || user?.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isAdmin ? 'default' : 'secondary'} className="text-[10px]">
              {userRole}
            </Badge>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {selectedVolunteer ? (
          <VolunteerDetailView
            session={session}
            userId={selectedVolunteer}
            onBack={() => { setSelectedVolunteer(null); setCurrentView('volunteers') }}
            currentUserId={user?.id}
          />
        ) : currentView === 'profile' ? (
          profileLoading ? (
            <div className="p-4 space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <ProfileView
              user={user}
              userRole={userRole}
              formData={formData}
              setFormData={setFormData}
              onSave={handleSave}
              saving={saving}
              isAdmin={isAdmin}
            />
          )
        ) : currentView === 'qrcode' ? (
          <QRCodeView user={user} userName={profileData?.core?.full_name} />
        ) : currentView === 'scanner' && isAdmin ? (
          <ScannerView user={user} session={session} />
        ) : currentView === 'volunteers' && isAdmin ? (
          <VolunteerListView
            session={session}
            onSelectVolunteer={(id) => { setSelectedVolunteer(id); setCurrentView('volunteers') }}
          />
        ) : null}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t z-50">
        <div className="max-w-2xl mx-auto flex justify-around py-1.5 px-2">
          <NavItem
            icon={<User className="h-5 w-5" />}
            label="Profile"
            active={currentView === 'profile' && !selectedVolunteer}
            onClick={() => { setCurrentView('profile'); setSelectedVolunteer(null) }}
          />
          <NavItem
            icon={<QrCode className="h-5 w-5" />}
            label="My QR"
            active={currentView === 'qrcode'}
            onClick={() => { setCurrentView('qrcode'); setSelectedVolunteer(null) }}
          />
          {isAdmin && (
            <>
              <NavItem
                icon={<ScanLine className="h-5 w-5" />}
                label="Scanner"
                active={currentView === 'scanner'}
                onClick={() => { setCurrentView('scanner'); setSelectedVolunteer(null) }}
              />
              <NavItem
                icon={<Users className="h-5 w-5" />}
                label="Volunteers"
                active={currentView === 'volunteers' || !!selectedVolunteer}
                onClick={() => { setCurrentView('volunteers'); setSelectedVolunteer(null) }}
              />
            </>
          )}
        </div>
      </nav>
    </div>
  )
}

export default App;
