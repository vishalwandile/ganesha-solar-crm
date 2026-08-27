import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appEnv = String(process.env.APP_ENV || process.env.NODE_ENV || '').toLowerCase()
const fileName = process.env.ENV_FILE || (appEnv === 'uat' ? '.env.uat' : '.env')

dotenv.config({ path: path.resolve(backendRoot, fileName) })
