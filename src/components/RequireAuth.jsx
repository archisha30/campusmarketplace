import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

// Route guard. Unverified students never reach marketplace interactions;
// non-admins never reach /admin; buyers never reach seller pages.
// The backend must enforce the same rules.
export default function RequireAuth({ role, seller = false }) {
  const { user, loading, isVerified, isSeller, isAdmin } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="mx-auto max-w-[1180px] px-6 py-16"><div className="skeleton h-64" /></div>
  }
  if (!user || !isVerified) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  if (role === 'admin' ? !isAdmin : role && user.role !== role) {
    return <Navigate to="/marketplace" replace />
  }
  if (seller && !isSeller) {
    return <Navigate to="/profile" state={{ needsSeller: true }} replace />
  }
  return <Outlet />
}
