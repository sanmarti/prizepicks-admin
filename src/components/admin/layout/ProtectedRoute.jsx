import { Navigate } from 'react-router'
import { useAdminAuthStore } from '../../../store/adminAuthStore'

export default function ProtectedRoute({ children }) {
  const { admin, token } = useAdminAuthStore()
  if (!token || !admin || admin.role !== 'admin') {
    return <Navigate to="/admin/login" replace />
  }
  return children
}
