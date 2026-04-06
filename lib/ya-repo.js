import { sql } from 'drizzle-orm'
import { db } from '@/db/index'
import {
  PROFILE_CORE_COLUMNS,
  PROFILE_DATA_COLUMNS,
  PROFILE_SENSITIVE_COLUMNS,
} from '@/lib/profile-columns'

const LIST_DATA_FIELDS = [
  'contact_number', 'email_id', 'gender', 'date_of_birth', 'age', 'permanent_address',
  'sewa_center', 'sewa_zone', 'primary_sewa_current', 'primary_sewa_permanent',
  'permanent_icard_status', 'uniform', 'date_of_joining', 'years_in_ya', 'active_status',
]

function buildJsonbObjectFromPd(alias = 'pd') {
  const parts = LIST_DATA_FIELDS.map((f) => `'${f}', ${alias}.${f}`)
  return `jsonb_build_object(${parts.join(', ')})`
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function escapeIlikePattern(s) {
  return `%${String(s).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')}%`
}

function firstRow(result) {
  if (!result) return undefined
  if (Array.isArray(result)) return result[0]
  if (result.rows && result.rows[0]) return result.rows[0]
  return result[0]
}

function allRows(result) {
  if (!result) return []
  if (Array.isArray(result)) return result
  if (result.rows) return result.rows
  return []
}

export async function ensureProfilesDataRowForUser(userId) {
  const row = firstRow(
    await db.execute(sql`SELECT id FROM profiles_data WHERE user_id = ${userId} LIMIT 1`)
  )
  if (row) return
  await db.execute(sql`INSERT INTO profiles_data (user_id, updated_at) VALUES (${userId}, NOW())`)
}

async function patchTableWithWhitelist(table, whitelistSet, userId, patch) {
  const entries = Object.entries(patch || {}).filter(
    ([k, v]) => whitelistSet.has(k) && v !== undefined
  )
  if (entries.length === 0) return
  const fragments = entries.map(([col, val]) => sql`${sql.identifier(col)} = ${val}`)
  const tableSql =
    table === 'profiles_core'
      ? sql`profiles_core`
      : table === 'profiles_data'
        ? sql`profiles_data`
        : sql`profiles_sensitive`
  await db.execute(sql`
    UPDATE ${tableSql}
    SET ${sql.join(fragments, sql`, `)}, updated_at = NOW()
    WHERE user_id = ${userId}
  `)
}

export async function patchProfilesCore(userId, coreUpdate) {
  await patchTableWithWhitelist('profiles_core', PROFILE_CORE_COLUMNS, userId, coreUpdate)
}

export async function patchProfilesData(userId, dataUpdate) {
  const { id, user_id, created_at, updated_at, ...clean } = dataUpdate || {}
  await patchTableWithWhitelist('profiles_data', PROFILE_DATA_COLUMNS, userId, clean)
}

export async function patchProfilesSensitive(userId, sensitiveUpdate) {
  await patchTableWithWhitelist(
    'profiles_sensitive',
    PROFILE_SENSITIVE_COLUMNS,
    userId,
    sensitiveUpdate
  )
}

export async function ensureProfileRows(userId, email, fullName) {
  const existing = allRows(
    await db.execute(sql`SELECT * FROM profiles_core WHERE user_id = ${userId} LIMIT 1`)
  )
  if (existing[0]) return existing[0]

  await db.execute(sql`
    INSERT INTO profiles_core (user_id, full_name, first_name, role, qr_code_url, account_status)
    VALUES (${userId}, ${fullName}, ${fullName}, 'volunteer', ${userId}, 'active')
  `)
  const row = firstRow(
    await db.execute(sql`SELECT * FROM profiles_core WHERE user_id = ${userId} LIMIT 1`)
  )
  await db.execute(sql`
    INSERT INTO profiles_data (user_id, email_id)
    VALUES (${userId}, ${email || ''})
  `)
  await db.execute(sql`INSERT INTO profiles_sensitive (user_id) VALUES (${userId})`)
  return row
}

export async function selectProfileMe(userId) {
  const [coreRows, dataRows] = await Promise.all([
    db.execute(sql`SELECT * FROM profiles_core WHERE user_id = ${userId} LIMIT 1`),
    db.execute(sql`SELECT * FROM profiles_data WHERE user_id = ${userId} LIMIT 1`),
  ])
  return {
    core: firstRow(coreRows) ?? null,
    data: firstRow(dataRows) ?? null,
  }
}

export async function setUserRole(targetUserId, role) {
  await db.execute(sql`
    UPDATE profiles_core SET role = ${role}, updated_at = NOW() WHERE user_id = ${targetUserId}
  `)
}

export async function listVolunteersPaginated(search, page, pageSize) {
  const from = page * pageSize
  const jsonExpr = buildJsonbObjectFromPd('pd')
  if (search?.trim()) {
    const pattern = escapeIlikePattern(search.trim())
    const countRows = allRows(
      await db.execute(
        sql`SELECT COUNT(*)::int AS c FROM profiles_core pc
            WHERE pc.full_name ILIKE ${pattern} ESCAPE '\\' OR pc.ya_id ILIKE ${pattern} ESCAPE '\\'`
      )
    )
    const total = countRows[0]?.c ?? 0
    const data = allRows(
      await db.execute(sql`
        SELECT pc.id, pc.user_id, pc.full_name, pc.ya_id, pc.photo_url, pc.role,
          ${sql.raw(jsonExpr)} AS profiles_data
        FROM profiles_core pc
        LEFT JOIN profiles_data pd ON pd.user_id = pc.user_id
        WHERE pc.full_name ILIKE ${pattern} ESCAPE '\\' OR pc.ya_id ILIKE ${pattern} ESCAPE '\\'
        ORDER BY pc.full_name
        LIMIT ${pageSize} OFFSET ${from}
      `)
    )
    return { data, total }
  }
  const countRows = allRows(await db.execute(sql`SELECT COUNT(*)::int AS c FROM profiles_core`))
  const total = countRows[0]?.c ?? 0
  const data = allRows(
    await db.execute(sql`
      SELECT pc.id, pc.user_id, pc.full_name, pc.ya_id, pc.photo_url, pc.role,
        ${sql.raw(jsonExpr)} AS profiles_data
      FROM profiles_core pc
      LEFT JOIN profiles_data pd ON pd.user_id = pc.user_id
      ORDER BY pc.full_name
      LIMIT ${pageSize} OFFSET ${from}
    `)
  )
  return { data, total }
}

export async function resolveCoreByIdOrUserId(paramId) {
  if (UUID_RE.test(paramId)) {
    const byId = allRows(
      await db.execute(sql`SELECT * FROM profiles_core WHERE id = ${paramId}::uuid LIMIT 1`)
    )
    if (byId[0]) return byId[0]
  }
  const byUser = allRows(
    await db.execute(sql`SELECT * FROM profiles_core WHERE user_id = ${paramId} LIMIT 1`)
  )
  return byUser[0] ?? null
}

export async function getVolunteerDetailByParam(param) {
  const core = await resolveCoreByIdOrUserId(param)
  if (!core) return null
  const uid = core.user_id
  const profileId = core.id
  const [dataRows, sensRows, invRows] = await Promise.all([
    db.execute(sql`SELECT * FROM profiles_data WHERE user_id = ${uid} LIMIT 1`),
    db.execute(sql`SELECT * FROM profiles_sensitive WHERE user_id = ${uid} LIMIT 1`),
    db.execute(sql`
      SELECT il.*, jsonb_build_object('item_name', ii.item_name, 'variant', ii.variant) AS inventory_items
      FROM inventory_logs il
      LEFT JOIN inventory_items ii ON ii.id = il.item_id
      WHERE il.volunteer_id = ${profileId}::uuid
      ORDER BY il.created_at DESC
    `),
  ])
  const invList = allRows(invRows)
  const inventory = invList.map((r) => {
    const { inventory_items, ...rest } = r
    return { ...rest, inventory_items: inventory_items || null }
  })
  return {
    core,
    data: firstRow(dataRows) ?? null,
    sensitive: firstRow(sensRows) ?? null,
    inventory,
  }
}

export async function listStockItems() {
  return allRows(
    await db.execute(sql`SELECT * FROM stock_items ORDER BY category, name`)
  )
}

export async function insertStockItem(body) {
  const rows = allRows(
    await db.execute(sql`
      INSERT INTO stock_items (name, category, description, total_quantity, issued_quantity, unit, min_stock_level)
      VALUES (
        ${body.name},
        ${body.category || 'General'},
        ${body.description || ''},
        ${body.total_quantity || 0},
        0,
        ${body.unit || 'pcs'},
        ${body.min_stock_level || 0}
      )
      RETURNING *
    `)
  )
  return rows[0]
}

export async function updateStockItem(id, updateData) {
  const { id: _id, ...rest } = updateData
  const entries = Object.entries(rest).filter(([, v]) => v !== undefined)
  if (entries.length === 0) return
  const fragments = entries.map(([col, val]) => sql`${sql.identifier(col)} = ${val}`)
  await db.execute(sql`
    UPDATE stock_items SET ${sql.join(fragments, sql`, `)}, updated_at = NOW() WHERE id = ${id}::uuid
  `)
}

export async function deleteStockItem(id) {
  await db.execute(sql`DELETE FROM stock_items WHERE id = ${id}::uuid`)
}

export async function stockIssueLegacy(userId, body) {
  const { target_user_id, stock_item_id, quantity, notes, year } = body
  const items = allRows(
    await db.execute(sql`SELECT * FROM stock_items WHERE id = ${stock_item_id}::uuid LIMIT 1`)
  )
  const item = items[0]
  if (!item) return { error: 'Item not found', status: 404 }
  const available = item.total_quantity - item.issued_quantity
  if (available < quantity) {
    return { error: `Insufficient stock. Available: ${available}`, status: 400 }
  }
  const logRows = allRows(
    await db.execute(sql`
      INSERT INTO inventory_logs (
        user_id, stock_item_id, item_name, quantity, year, issued_by, issued_at, notes
      ) VALUES (
        ${target_user_id},
        ${stock_item_id}::uuid,
        ${item.name},
        ${quantity},
        ${year || new Date().getFullYear()},
        ${userId},
        NOW(),
        ${notes || ''}
      )
      RETURNING *
    `)
  )
  await db.execute(sql`
    UPDATE stock_items SET
      issued_quantity = ${item.issued_quantity + quantity},
      updated_at = NOW()
    WHERE id = ${stock_item_id}::uuid
  `)
  return { data: logRows[0] }
}

export async function stockHistoryPage(search, page, pageSize) {
  const from = page * pageSize
  if (search?.trim()) {
    const pattern = escapeIlikePattern(search.trim())
    const countRows = allRows(
      await db.execute(
        sql`SELECT COUNT(*)::int AS c FROM inventory_logs il WHERE il.item_name ILIKE ${pattern} ESCAPE '\\'`
      )
    )
    const total = countRows[0]?.c ?? 0
    const data = allRows(
      await db.execute(sql`
        SELECT il.*,
          jsonb_build_object('name', si.name, 'category', si.category) AS stock_items,
          jsonb_build_object('full_name', pc.full_name, 'ya_id', pc.ya_id) AS profiles_core
        FROM inventory_logs il
        LEFT JOIN stock_items si ON si.id = il.stock_item_id
        LEFT JOIN profiles_core pc ON pc.user_id::text = il.user_id::text
        WHERE il.item_name ILIKE ${pattern} ESCAPE '\\'
        ORDER BY il.issued_at DESC NULLS LAST
        LIMIT ${pageSize} OFFSET ${from}
      `)
    )
    return { data, total }
  }
  const countRows = allRows(await db.execute(sql`SELECT COUNT(*)::int AS c FROM inventory_logs`))
  const total = countRows[0]?.c ?? 0
  const data = allRows(
    await db.execute(sql`
      SELECT il.*,
        jsonb_build_object('name', si.name, 'category', si.category) AS stock_items,
        jsonb_build_object('full_name', pc.full_name, 'ya_id', pc.ya_id) AS profiles_core
      FROM inventory_logs il
      LEFT JOIN stock_items si ON si.id = il.stock_item_id
      LEFT JOIN profiles_core pc ON pc.user_id::text = il.user_id::text
      ORDER BY il.issued_at DESC NULLS LAST
      LIMIT ${pageSize} OFFSET ${from}
    `)
  )
  return { data, total }
}

export async function searchVolunteersForStock(q) {
  const pattern = escapeIlikePattern(q)
  return allRows(
    await db.execute(sql`
      SELECT user_id, full_name, ya_id, role FROM profiles_core
      WHERE full_name ILIKE ${pattern} ESCAPE '\\' OR ya_id ILIKE ${pattern} ESCAPE '\\'
      ORDER BY full_name LIMIT 10
    `)
  )
}

export async function listInventoryItems() {
  return allRows(await db.execute(sql`SELECT * FROM inventory_items ORDER BY item_name`))
}

export async function inventorySearchVolunteersMerged(q) {
  const pattern = escapeIlikePattern(q)
  const byYa = allRows(
    await db.execute(sql`
      SELECT user_id, full_name, ya_id FROM profiles_core
      WHERE ya_id ILIKE ${pattern} ESCAPE '\\' LIMIT 10
    `)
  )
  const byPhone = allRows(
    await db.execute(sql`
      SELECT user_id FROM profiles_data
      WHERE contact_number ILIKE ${pattern} ESCAPE '\\' LIMIT 10
    `)
  )
  const yaIds = byYa.map((r) => r.user_id)
  const phoneIds = byPhone.map((r) => r.user_id)
  const allUserIds = [...new Set([...yaIds, ...phoneIds])].slice(0, 10)
  if (allUserIds.length === 0) return []
  const cores = allRows(
    await db.execute(sql`
      SELECT id, user_id, full_name, ya_id FROM profiles_core
      WHERE user_id IN (${sql.join(allUserIds.map((id) => sql`${id}`), sql`, `)})
    `)
  )
  const dataRows = allRows(
    await db.execute(sql`
      SELECT user_id, contact_number, email_id, age, gender, sewa_center, sewa_zone
      FROM profiles_data
      WHERE user_id IN (${sql.join(allUserIds.map((id) => sql`${id}`), sql`, `)})
    `)
  )
  const dataByUserId = Object.fromEntries(dataRows.map((r) => [r.user_id, r]))
  return cores.map((c) => {
    const d = dataByUserId[c.user_id]
    return {
      id: c.id,
      user_id: c.user_id,
      full_name: c.full_name,
      ya_id: c.ya_id,
      phone: d?.contact_number || '',
      email: d?.email_id || '',
      age: d?.age != null ? d.age : null,
      gender: d?.gender || '',
      sewa_center: d?.sewa_center || '',
      sewa_zone: d?.sewa_zone || '',
    }
  })
}

export async function resolveVolunteerProfileId(volunteerParam) {
  if (UUID_RE.test(volunteerParam)) {
    const rows = allRows(
      await db.execute(sql`
        SELECT id FROM profiles_core WHERE id = ${volunteerParam}::uuid OR user_id = ${volunteerParam} LIMIT 1
      `)
    )
    return rows[0]?.id ?? null
  }
  const rows = allRows(
    await db.execute(sql`SELECT id FROM profiles_core WHERE user_id = ${volunteerParam} LIMIT 1`)
  )
  return rows[0]?.id ?? null
}

export async function inventoryVolunteerIssuedLogs(volunteerProfileId) {
  return allRows(
    await db.execute(sql`
      SELECT id, status FROM inventory_logs
      WHERE volunteer_id = ${volunteerProfileId}::uuid AND status = 'issued'
    `)
  )
}

export async function inventoryVolunteerHistoryDetail(volunteerProfileId) {
  const logs = allRows(
    await db.execute(sql`
      SELECT id, item_id, quantity_issued, amount_due, status, created_at
      FROM inventory_logs
      WHERE volunteer_id = ${volunteerProfileId}::uuid
      ORDER BY created_at DESC
    `)
  )
  const itemIds = [...new Set(logs.map((l) => l.item_id).filter(Boolean))]
  if (itemIds.length === 0) return logs.map((l) => ({ ...l, item_name: '—', variant: '' }))
  const items = allRows(
    await db.execute(sql`
      SELECT id, item_name, variant FROM inventory_items
      WHERE id IN (${sql.join(itemIds.map((id) => sql`${id}::uuid`), sql`, `)})
    `)
  )
  const byId = Object.fromEntries(items.map((i) => [i.id, i]))
  return logs.map((log) => ({
    ...log,
    item_name: byId[log.item_id]?.item_name || '—',
    variant: byId[log.item_id]?.variant || '',
  }))
}

export async function getInventoryItem(itemId) {
  return (
    firstRow(
      await db.execute(sql`SELECT * FROM inventory_items WHERE id = ${itemId}::uuid LIMIT 1`)
    ) ?? null
  )
}

export async function getProfileCoreIdByUserId(userId) {
  const rows = allRows(
    await db.execute(sql`SELECT id FROM profiles_core WHERE user_id = ${userId} LIMIT 1`)
  )
  return rows[0]?.id ?? null
}

export async function insertInventoryIssue(row) {
  const inserted = allRows(
    await db.execute(sql`
      INSERT INTO inventory_logs (
        volunteer_id, item_id, issued_by, status, quantity_issued, amount_due, payment_method
      ) VALUES (
        ${row.volunteerProfileId}::uuid,
        ${row.itemId}::uuid,
        ${row.issuedByProfileId}::uuid,
        'issued',
        ${row.qty},
        ${row.amount_due},
        ${row.payment_method}
      )
      RETURNING *
    `)
  )
  return inserted[0]
}

export async function decrementInventoryItemQty(itemId, newQty) {
  await db.execute(sql`
    UPDATE inventory_items SET current_quantity = ${newQty} WHERE id = ${itemId}::uuid
  `)
}

export async function listRecentInventoryLogs(limit) {
  const logs = allRows(
    await db.execute(sql`
      SELECT id, volunteer_id, item_id, quantity_issued, amount_due, payment_method, status, created_at
      FROM inventory_logs
      WHERE status = 'issued'
      ORDER BY created_at DESC
      LIMIT ${limit}
    `)
  )
  const itemIds = [...new Set(logs.map((l) => l.item_id).filter(Boolean))]
  const volunteerIds = [...new Set(logs.map((l) => l.volunteer_id).filter(Boolean))]
  const items =
    itemIds.length > 0
      ? allRows(
          await db.execute(sql`
            SELECT id, item_name, variant, unit_type FROM inventory_items
            WHERE id IN (${sql.join(itemIds.map((id) => sql`${id}::uuid`), sql`, `)})
          `)
        )
      : []
  const volunteers =
    volunteerIds.length > 0
      ? allRows(
          await db.execute(sql`
            SELECT id, user_id, full_name, ya_id FROM profiles_core
            WHERE id IN (${sql.join(volunteerIds.map((id) => sql`${id}::uuid`), sql`, `)})
          `)
        )
      : []
  const itemsById = Object.fromEntries(items.map((i) => [i.id, i]))
  const volById = Object.fromEntries(volunteers.map((v) => [v.id, v]))
  return logs.map((log) => ({
    ...log,
    inventory_items: itemsById[log.item_id] || null,
    profiles_core: volById[log.volunteer_id] || null,
  }))
}

export async function undoInventoryLog(logId) {
  const logRows = allRows(
    await db.execute(sql`
      SELECT id, item_id, quantity_issued, status FROM inventory_logs WHERE id = ${logId}::uuid LIMIT 1
    `)
  )
  const log = logRows[0]
  if (!log) return { error: 'Log not found', status: 404 }
  if (log.status !== 'issued') return { error: 'Log already undone', status: 400 }
  await db.execute(sql`UPDATE inventory_logs SET status = 'undone' WHERE id = ${logId}::uuid`)
  const itemRows = allRows(
    await db.execute(sql`
      SELECT current_quantity FROM inventory_items WHERE id = ${log.item_id}::uuid LIMIT 1
    `)
  )
  const currentQty = Number(itemRows[0]?.current_quantity) || 0
  await db.execute(sql`
    UPDATE inventory_items
    SET current_quantity = ${currentQty + Number(log.quantity_issued)}
    WHERE id = ${log.item_id}::uuid
  `)
  return { ok: true }
}

export async function adjustInventoryStock(itemId, qty, notes, adjustedByProfileId) {
  const itemRows = allRows(
    await db.execute(sql`
      SELECT id, current_quantity, total_received FROM inventory_items WHERE id = ${itemId}::uuid LIMIT 1
    `)
  )
  const item = itemRows[0]
  if (!item) return { error: 'Item not found', status: 404 }
  const currentQty = Number(item.current_quantity) || 0
  const currentReceived = Number(item.total_received) || 0
  const newTotal = currentQty + qty
  if (newTotal < 0) {
    return { error: 'Insufficient stock: reduction would make quantity negative', status: 400 }
  }
  const newReceived = qty > 0 ? currentReceived + qty : currentReceived
  await db.execute(sql`
    UPDATE inventory_items SET
      current_quantity = ${newTotal},
      total_received = ${newReceived},
      updated_at = NOW()
    WHERE id = ${itemId}::uuid
  `)
  await db.execute(sql`
    INSERT INTO stock_audit_logs (item_id, adjusted_by, quantity_added, new_total, notes)
    VALUES (
      ${itemId}::uuid,
      ${adjustedByProfileId}::uuid,
      ${qty},
      ${newTotal},
      ${notes != null ? String(notes).trim() : ''}
    )
  `)
  return { new_total: newTotal }
}

export async function listStockAuditForItem(itemId) {
  const logs = allRows(
    await db.execute(sql`
      SELECT id, item_id, adjusted_by, quantity_added, new_total, notes, created_at
      FROM stock_audit_logs
      WHERE item_id = ${itemId}::uuid
      ORDER BY created_at DESC
    `)
  )
  const adjustedByIds = [...new Set(logs.map((l) => l.adjusted_by).filter(Boolean))]
  if (adjustedByIds.length === 0) {
    return logs.map((l) => ({ ...l, profiles_core: null }))
  }
  const profiles = allRows(
    await db.execute(sql`
      SELECT id, full_name FROM profiles_core
      WHERE id IN (${sql.join(adjustedByIds.map((id) => sql`${id}::uuid`), sql`, `)})
    `)
  )
  const profilesById = Object.fromEntries(profiles.map((p) => [p.id, p]))
  return logs.map((log) => ({
    ...log,
    profiles_core: profilesById[log.adjusted_by]
      ? { full_name: profilesById[log.adjusted_by].full_name }
      : null,
  }))
}

export async function onboardingLookupByEmail(email) {
  const e = (email || '').trim().toLowerCase()
  if (!e) return null
  const rows = allRows(
    await db.execute(sql`
      SELECT pc.id, pc.ya_id, pc.user_id
      FROM profiles_core pc
      LEFT JOIN profiles_data pd ON pd.user_id = pc.user_id
      WHERE (pc.email IS NOT NULL AND lower(pc.email) = ${e})
         OR (pd.email_id IS NOT NULL AND lower(pd.email_id) = ${e})
      LIMIT 1
    `)
  )
  return rows[0] ?? null
}

export async function onboardingLinkProfile(profileId, userId, email) {
  await db.execute(sql`
    UPDATE profiles_core
    SET user_id = ${userId}, email = COALESCE(${email || null}, email), updated_at = NOW()
    WHERE id = ${profileId}::uuid
  `)
}

export async function accessSearchUsers(q) {
  const pattern = escapeIlikePattern(q)
  return allRows(
    await db.execute(sql`
      SELECT id, user_id, full_name, ya_id, photo_url, role, accessible_modules
      FROM profiles_core
      WHERE full_name ILIKE ${pattern} ESCAPE '\\' OR ya_id ILIKE ${pattern} ESCAPE '\\'
      ORDER BY full_name LIMIT 20
    `)
  )
}

export async function accessListStaff() {
  return allRows(
    await db.execute(sql`
      SELECT id, user_id, full_name, ya_id, photo_url, role, accessible_modules
      FROM profiles_core
      WHERE role <> 'volunteer'
      ORDER BY full_name
    `)
  )
}

export async function accessUpdateUser(targetUserId, role, accessible_modules) {
  const hasModules = Array.isArray(accessible_modules)
  if (role && hasModules) {
    await db.execute(sql`
      UPDATE profiles_core
      SET role = ${role},
          accessible_modules = ${JSON.stringify(accessible_modules)}::jsonb,
          updated_at = NOW()
      WHERE user_id = ${targetUserId}
    `)
    return
  }
  if (hasModules) {
    await db.execute(sql`
      UPDATE profiles_core
      SET accessible_modules = ${JSON.stringify(accessible_modules)}::jsonb,
          updated_at = NOW()
      WHERE user_id = ${targetUserId}
    `)
  }
  if (role) {
    await db.execute(sql`
      UPDATE profiles_core SET role = ${role}, updated_at = NOW() WHERE user_id = ${targetUserId}
    `)
  }
}

export async function findProfileByYaId(trimmedYaId) {
  const rows = allRows(
    await db.execute(sql`
      SELECT id, user_id, ya_id FROM profiles_core WHERE lower(ya_id) = lower(${trimmedYaId}) LIMIT 1
    `)
  )
  return rows[0] ?? null
}

