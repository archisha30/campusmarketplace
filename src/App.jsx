import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import BottomNav from './components/BottomNav.jsx'
import Footer from './components/Footer.jsx'
import RequireAuth from './components/RequireAuth.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import ScrollToHash from './components/ScrollToHash.jsx'

import Landing from './pages/Landing.jsx'
import Marketplace from './pages/Marketplace.jsx'
import ListingDetail from './pages/ListingDetail.jsx'
import Sell from './pages/Sell.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Resources from './pages/Resources.jsx'
import ResourceDetail from './pages/ResourceDetail.jsx'
import ResourceForm from './pages/ResourceForm.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import Onboarding from './pages/Onboarding.jsx'
import Interests from './pages/Interests.jsx'
import Admin from './pages/Admin.jsx'
import Wishlist from './pages/Wishlist.jsx'
import Profile from './pages/Profile.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  const location = useLocation()
  return (
    <div className="flex min-h-screen flex-col pb-[74px] md:pb-0">
      <ScrollToHash />
      <Navbar />
      <main className="flex-1">
        <ErrorBoundary resetKey={location.pathname}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/resources/:id" element={<ResourceDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Verified students only */}
          <Route element={<RequireAuth />}>
            {/* The marketplace is never shown to logged-out visitors (the API enforces it too). */}
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/listing/:id" element={<ListingDetail />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/interests" element={<Interests />} />
            <Route path="/profile" element={<Profile />} />
          </Route>

          {/* Seller accounts only */}
          <Route element={<RequireAuth seller />}>
            <Route path="/sell" element={<Sell />} />
            <Route path="/sell/:id/edit" element={<Sell />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/resources/new" element={<ResourceForm />} />
            <Route path="/resources/:id/edit" element={<ResourceForm />} />
          </Route>

          {/* Admins only */}
          <Route element={<RequireAuth role="admin" />}>
            <Route path="/admin" element={<Admin />} />
          </Route>

          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
        </ErrorBoundary>
      </main>
      <Footer />
      <BottomNav />
    </div>
  )
}
