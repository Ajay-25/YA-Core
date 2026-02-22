'use client'

import { useState, useEffect, useCallback } from 'react'
import { useDashboard } from '@/contexts/DashboardContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { FormField, FieldGroup } from '@/components/dashboard/form-fields'
import {
  Loader2, Save, Shield,
  MapPin, Heart, Briefcase, FileText,
  Package, CheckCircle2, BarChart3,
  Phone, UserCog,
} from 'lucide-react'
import { toast } from 'sonner'
import { PROFILE_TABS, groupBySection } from '@/lib/field-configs'

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

export default function ProfilePage() {
  const { session, role, profileCore, profileData, profileLoading, refreshProfile } = useDashboard()
  const [formData, setFormData] = useState({})
  const [saving, setSaving] = useState(false)

  const isAdmin = role === 'admin'

  useEffect(() => {
    if (profileCore || profileData) {
      setFormData({
        ...(profileData || {}),
        ya_id: profileCore?.ya_id || '',
        first_name: profileCore?.first_name || '',
        middle_name: profileCore?.middle_name || '',
        last_name: profileCore?.last_name || '',
        full_name: profileCore?.full_name || '',
      })
    }
  }, [profileCore, profileData])

  const handleChange = useCallback((key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const {
        ya_id, first_name, middle_name, last_name, full_name,
        id, user_id, created_at, updated_at,
        ...dataFields
      } = formData
      const computedFullName =
        [first_name, middle_name, last_name].filter(Boolean).join(' ') || full_name

      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          core: { ya_id, first_name, middle_name, last_name, full_name: computedFullName },
          data: dataFields,
        }),
      })

      if (res.ok) {
        toast.success('Profile saved!')
        refreshProfile()
      } else {
        toast.error('Failed to save')
      }
    } catch {
      toast.error('Failed to save')
    }
    setSaving(false)
  }

  if (profileLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="p-4 pb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold">My Profile</h2>
          <p className="text-xs text-muted-foreground">
            Manage your information across all sections
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Save
        </Button>
      </div>

      <Tabs defaultValue="personal" className="w-full">
        <div className="overflow-x-auto -mx-4 px-4 pb-1">
          <TabsList className="inline-flex w-auto min-w-full sm:w-full h-9">
            {PROFILE_TABS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="text-[11px] px-2.5 whitespace-nowrap"
              >
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

        {PROFILE_TABS.map((tab) => {
          const sections = groupBySection(tab.fields)
          const hasSections = Object.keys(sections).some((s) => s !== 'General')

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
                      {tab.fields.map((f) => (
                        <FormField
                          key={f.key}
                          field={f}
                          value={formData[f.key]}
                          onChange={handleChange}
                        />
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
                <p className="text-sm text-muted-foreground">
                  Sensitive data is view-only from your own profile.
                  <br />
                  Use the Volunteers list to manage sensitive fields.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
