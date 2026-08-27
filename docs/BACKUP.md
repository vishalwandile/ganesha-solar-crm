# Backups (free-tier Supabase)

Supabase **Free** has no automated Postgres backups and no point-in-time recovery. If the project is paused, limited, or wiped, data is gone unless you have a copy **somewhere else**.

Do **not** store the only dump inside the same Supabase project. That is not a backup.

## What we do

A script writes rotating files under `backend/backups/` (gitignored):

| File | Contents |
|---|---|
| `crm-<env>-<timestamp>.sql` | Full Postgres dump (`pg_dump`) |
| `crm-<env>-<timestamp>-files.tar.gz` | All objects from the documents bucket |

It keeps the **newest 3** of each kind (`BACKUP_KEEP=3`).

## Run on your machine

Install Postgres client tools so `pg_dump` exists (`psql` / `pg_dump` on PATH). If they are missing, the script still writes a SQL file using Node (schema.sql + INSERT rows).

```bash
cd backend
npm run backup          # production DB + files
npm run backup:uat      # UAT
npm run backup:db       # SQL only (saves storage egress)
```

Copy the three newest files to Google Drive / a USB disk as well. GitHub artifacts expire; a Drive folder does not.

If `pg_dump` fails on the pooler URL, set in `backend/.env`:

```
DIRECT_DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.ovkdeujqpvhrscwusurc.supabase.co:5432/postgres
```

(UAT: `db.yfjvvqjznjoxuyhhtfjk.supabase.co`.)

## Automatic on GitHub (private repo)

Workflow: `.github/workflows/backup.yml` on branch `main`.

| When | What |
|---|---|
| Every day 18:00 UTC (≈ 11:30 PM IST) | SQL dump only |
| Every Sunday 20:00 UTC (≈ 1:30 AM IST Monday) | SQL + file archive |
| Actions → Backup production → Run workflow | Manual; tick **Also download and zip storage files** if needed |

GitHub starts the schedule **only after this workflow exists on `main`**. The first run can be up to ~1 hour after the cron time. Artifacts are kept **90 days**.

### One-time: add secrets

GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:

- `DATABASE_URL` (production pooler URL)
- `STORAGE_S3_ENDPOINT`
- `STORAGE_S3_REGION`
- `STORAGE_S3_ACCESS_KEY_ID`
- `STORAGE_S3_SECRET_ACCESS_KEY`
- `SUPABASE_DOCUMENTS_BUCKET` (`ganesha_solar`)
- Optional: `DIRECT_DATABASE_URL`

Then run the workflow once by hand to confirm. After that it is unattended.

GitHub **pauses scheduled workflows** if `main` has had **no commits for 60 days**. A workflow run does not reset that clock. If backups stop, push any small commit or click **Run workflow**.

To skip the bucket (less egress): leave the weekly job as-is, or change the Sunday cron step to `npm run backup:db`.

## Restore (disaster)

```bash
# Database (destroys current objects named in the dump)
psql "$DIRECT_DATABASE_URL" -f backend/backups/crm-prod-....sql

# Files
mkdir /tmp/restore-files && tar -xzf backend/backups/crm-prod-....-files.tar.gz -C /tmp/restore-files
# Re-upload with AWS CLI / Supabase dashboard into ganesha_solar
```

Test a restore on **UAT** once, not only on paper.

## What not to do

- Do not commit `.sql` dumps to git.
- Do not rely on Render disk (`uploads/`) — it is wiped on deploy.
- Do not dump daily **and** download the full bucket if you are near the **5 GB** free egress cap. Weekly files + daily SQL (locally) is enough at ~100 customers/month.
