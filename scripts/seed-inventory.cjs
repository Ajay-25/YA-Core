'use strict'

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const { neon } = require('@neondatabase/serverless')

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing (.env.local)')
  process.exit(1)
}

const sql = neon(process.env.DATABASE_URL)

/** T-Shirt sizes: S–XXXL (6 sizes). Cloth: Blue & White by meter. */
const ITEMS = [
  ...['S', 'M', 'L', 'XL', 'XXL', 'XXXL'].map((variant) => ({
    item_name: 'T-Shirt',
    variant,
    unit_price: '320',
    unit_type: 'piece',
  })),
  { item_name: 'Cloth', variant: 'Blue', unit_price: '50', unit_type: 'meter' },
  { item_name: 'Cloth', variant: 'White', unit_price: '50', unit_type: 'meter' },
]

async function main() {
  for (const row of ITEMS) {
    await sql`
			INSERT INTO inventory_items (item_name, variant, current_quantity, unit_price, unit_type, total_received)
			SELECT ${row.item_name}, ${row.variant}, 0, ${row.unit_price}, ${row.unit_type}, 0
			WHERE NOT EXISTS (
				SELECT 1 FROM inventory_items i
				WHERE i.item_name = ${row.item_name}
				AND COALESCE(i.variant, '') = ${row.variant}
			)
		`
  }
  console.log('Inventory seed done (skipped existing item_name + variant pairs).')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
