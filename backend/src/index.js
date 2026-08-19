import { createApp } from './app.js'
import { config } from './config.js'

const app = createApp()

app.listen(config.port, () => {
  console.log(`Ganesha Solar CRM API listening on http://localhost:${config.port}`)
  if (!config.databaseUrl) {
    console.warn('WARNING: DATABASE_URL is not set. API routes that hit Postgres will fail.')
  }
})
