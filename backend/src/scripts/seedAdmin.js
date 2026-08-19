import bcrypt from 'bcryptjs'
import 'dotenv/config'
import pg from 'pg'
import { config } from '../config.js'

const USERS = [
  {
    name: 'Vishal Wandile',
    username: 'vishal.wandile',
    password: 'admin123',
    team: 'Admin',
    isAdmin: true,
    permissions: [
      'name_change',
      'rooftop_solar',
      'pm_suryaghar',
      'finance',
      'installation',
      'closure',
    ],
  },
  {
    name: 'Priya Sawant',
    username: 'priya.sawant',
    password: 'office123',
    team: 'Office',
    isAdmin: false,
    permissions: ['name_change', 'rooftop_solar', 'pm_suryaghar', 'closure'],
  },
  {
    name: 'Ganesh More',
    username: 'ganesh.more',
    password: 'sales123',
    team: 'Sales',
    isAdmin: false,
    permissions: [],
  },
  {
    name: 'Sunita Jadhav',
    username: 'sunita.jadhav',
    password: 'account123',
    team: 'Account',
    isAdmin: false,
    permissions: ['finance'],
  },
  {
    name: 'Vikas Pawar',
    username: 'vikas.pawar',
    password: 'install123',
    team: 'Installation',
    isAdmin: false,
    permissions: ['installation'],
  },
]

async function main() {
  if (!config.databaseUrl) {
    console.error('DATABASE_URL is required')
    process.exit(1)
  }

  const client = new pg.Client({
    connectionString: config.databaseUrl,
    ssl: config.databaseUrl.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  })
  await client.connect()

  try {
    // Rename legacy admin if still present
    await client.query(
      `update users
       set name = 'Vishal Wandile', username = 'vishal.wandile', team = 'Admin', is_admin = true
       where username = 'rahul.kadam' or lower(name) = 'rahul kadam'`
    )

    for (const u of USERS) {
      const hash = await bcrypt.hash(u.password, 10)
      const { rows } = await client.query(
        `insert into users (name, username, password_hash, team, is_admin)
         values ($1, $2, $3, $4, $5)
         on conflict (username) do update
           set name = excluded.name,
               password_hash = excluded.password_hash,
               team = excluded.team,
               is_admin = excluded.is_admin
         returning id, username`,
        [u.name, u.username, hash, u.team, u.isAdmin]
      )
      const userId = rows[0].id
      await client.query(`delete from user_category_permissions where user_id = $1`, [userId])
      for (const cat of u.permissions) {
        await client.query(
          `insert into user_category_permissions (user_id, category, can_edit)
           values ($1, $2, true)`,
          [userId, cat]
        )
      }
      console.log(`Seeded user ${u.username} / ${u.password}`)
    }
    console.log('Done.')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
