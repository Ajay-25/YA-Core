import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { eq } from 'drizzle-orm'
import { db } from '@/db/index'
import { profilesCore, profilesData } from '@/db/schema'

export async function POST(req) {
  const secret = process.env.CLERK_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CLERK_WEBHOOK_SECRET is not set' }, { status: 500 })
  }

  const headerList = await headers()
  const svixId = headerList.get('svix-id')
  const svixTimestamp = headerList.get('svix-timestamp')
  const svixSignature = headerList.get('svix-signature')
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 })
  }

  const payload = await req.text()
  const wh = new Webhook(secret)
  let evt
  try {
    evt = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    })
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const type = evt.type
  const data = evt.data

  if (type === 'user.created' || type === 'user.updated') {
    const id = data.id
    if (!id) {
      return NextResponse.json({ error: 'Missing user id' }, { status: 400 })
    }

    const primary = data.email_addresses?.find((e) => e.id === data.primary_email_address_id)
      || data.email_addresses?.[0]
    const email = primary?.email_address ?? ''
    const firstName = data.first_name ?? ''
    const lastName = data.last_name ?? ''
    const fullName =
      [firstName, lastName].filter(Boolean).join(' ').trim()
      || email.split('@')[0]
      || 'Volunteer'

    const now = new Date()

    await db
      .insert(profilesCore)
      .values({
        userId: id,
        email: email || null,
        fullName,
        firstName: firstName || null,
        lastName: lastName || null,
        role: 'volunteer',
        qrCodeUrl: id,
        accountStatus: 'active',
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: profilesCore.userId,
        set: {
          email: email || null,
          fullName,
          firstName: firstName || null,
          lastName: lastName || null,
          accountStatus: 'active',
          updatedAt: now,
        },
      })

    if (type === 'user.created') {
      const existingData = await db
        .select({ id: profilesData.id })
        .from(profilesData)
        .where(eq(profilesData.userId, id))
        .limit(1)

      if (!existingData[0]) {
        await db.insert(profilesData).values({
          userId: id,
          updatedAt: now,
        })
      }
    }
  }

  if (type === 'user.deleted') {
    const id = data.id
    if (id) {
      const now = new Date()
      await db
        .update(profilesCore)
        .set({ accountStatus: 'inactive', updatedAt: now })
        .where(eq(profilesCore.userId, id))
    }
  }

  return NextResponse.json({ ok: true })
}
