import { Routes, Route, Navigate } from 'react-router-dom'
import { useCrm } from './context/CrmContext'
import { firstAllowedPath, hasFeature } from './data/features'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import CustomerList from './pages/CustomerList'
import CreateCustomer from './pages/CreateCustomer'
import CustomerDetail from './pages/CustomerDetail'
import Users from './pages/Users'
import Notifications from './pages/Notifications'

function FeatureRoute({ feature, children }) {
  const { sessionUser } = useCrm()
  if (!hasFeature(sessionUser, feature)) {
    return <Navigate to={firstAllowedPath(sessionUser)} replace />
  }
  return children
}

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

  const home = firstAllowedPath(sessionUser)

  return (
    <Routes>
      <Route
        path="/"
        element={
          <FeatureRoute feature="dashboard">
            <Dashboard />
          </FeatureRoute>
        }
      />
      <Route
        path="/customers"
        element={
          <FeatureRoute feature="customers">
            <CustomerList />
          </FeatureRoute>
        }
      />
      <Route
        path="/customers/new"
        element={
          <FeatureRoute feature="createCustomer">
            <CreateCustomer />
          </FeatureRoute>
        }
      />
      <Route
        path="/customers/:id"
        element={
          <FeatureRoute feature="customers">
            <CustomerDetail />
          </FeatureRoute>
        }
      />
      <Route
        path="/users"
        element={
          <FeatureRoute feature="users">
            <Users />
          </FeatureRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <FeatureRoute feature="notifications">
            <Notifications />
          </FeatureRoute>
        }
      />
      <Route path="*" element={<Navigate to={home} replace />} />
    </Routes>
  )
}
