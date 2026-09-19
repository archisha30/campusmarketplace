import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import BottomNav from './components/BottomNav.jsx'
import Footer from './components/Footer.jsx'
import RequireAuth from './components/RequireAuth.jsx'

import Landing from './pages/Landing.jsx'
import Marketplace from './pages/Marketplace.jsx'
import ListingDetail from './pages/ListingDetail.jsx'
import Sell from './pages/Sell.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Resources from './pages/Resources.jsx'
import ResourceDetail from './pages/ResourceDetail.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import Onboarding from './pages/Onboarding.jsx'
import Admin from './pages/Admin.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <div className="flex min-h-screen flex-col pb-[74px] md:pb-0">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/listing/:id" element={<ListingDetail />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/resources/:id" element={<ResourceDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/onboarding" element={<Onboarding />} />

          {/* Verified students only */}
          <Route element={<RequireAuth />}>
            <Route path="/sell" element={<Sell />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>

          {/* Admins only */}
          <Route element={<RequireAuth role="admin" />}>
            <Route path="/admin" element={<Admin />} />
          </Route>

          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </main>
      <Footer />
      <BottomNav />
    </div>
  )
}
