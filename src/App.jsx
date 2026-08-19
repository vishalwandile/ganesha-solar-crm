import { Routes, Route, Navigate } from 'react-router-dom'
import { useCrm } from './context/CrmContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import CustomerList from './pages/CustomerList'
import CreateCustomer from './pages/CreateCustomer'
import CustomerDetail from './pages/CustomerDetail'
import Users from './pages/Users'
import Notifications from './pages/Notifications'

export default function App() {
  const { sessionUser, hydrated } = useCrm()

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mesh">
        <div className="rounded-2xl bg-white px-6 py-4 text-sm font-semibold text-ink shadow-soft">
          Loading CRM…
        </div>
      </div>
    )
  }

  if (!sessionUser) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/customers" element={<CustomerList />} />
      <Route path="/customers/new" element={<CreateCustomer />} />
      <Route path="/customers/:id" element={<CustomerDetail />} />
      <Route path="/users" element={<Users />} />
      <Route path="/notifications" element={<Notifications />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
