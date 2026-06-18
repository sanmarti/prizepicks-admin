import { Outlet } from 'react-router'
import AdminSidebar from '../components/admin/layout/AdminSidebar'
import AdminTopBar from '../components/admin/layout/AdminTopBar'

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-[#0a0d12] flex">
      <AdminSidebar/>
      <div className="flex-1 ml-[240px] flex flex-col min-h-screen">
        <AdminTopBar/>
        <main className="flex-1 p-6">
          <Outlet/>
        </main>
      </div>
    </div>
  )
}
