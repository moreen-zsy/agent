import { Routes, Route, Navigate } from 'react-router'
import WebGLBackground from '@/components/WebGLBackground'
import Header from '@/components/Header'
import CartSidebar from '@/components/CartSidebar'
import LoginModal from '@/components/LoginModal'
import { ChatPanel } from '@/components/ChatPanel'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { lazy, Suspense } from 'react'

const Home = lazy(() => import('./pages/Home'))
const Order = lazy(() => import('./pages/Order'))
const AiOrder = lazy(() => import('./pages/AiOrder'))
const Orders = lazy(() => import('./pages/Orders'))
const OrderDetail = lazy(() => import('./pages/OrderDetail'))
const Profile = lazy(() => import('./pages/Profile'))
const Addresses = lazy(() => import('./pages/Addresses'))

function LandingRedirect() {
  return <Navigate to="/ai-order" replace />;
}

function OrderGuard() {
  const { user, openLoginModal } = useAuth();

  if (!user) {
    openLoginModal();
    return <Navigate to="/" replace />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Order />
    </Suspense>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, openLoginModal } = useAuth();

  if (!user) {
    openLoginModal();
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
    </div>
  );
}

function AppContent() {
  const { isLoginModalOpen, closeLoginModal } = useAuth();

  return (
    <div className="relative min-h-screen bg-[#0A0A0A]">
      <WebGLBackground />
      <Header />
      <CartSidebar />
      <Routes>
        <Route path="/" element={<LandingRedirect />} />
        <Route path="/home" element={<Suspense fallback={<PageLoader />}><Home /></Suspense>} />
        <Route path="/order" element={<OrderGuard />} />
        <Route path="/ai-order" element={<Suspense fallback={<PageLoader />}><AiOrder /></Suspense>} />
        <Route path="/orders" element={<AuthGuard><Suspense fallback={<PageLoader />}><Orders /></Suspense></AuthGuard>} />
        <Route path="/orders/:id" element={<AuthGuard><Suspense fallback={<PageLoader />}><OrderDetail /></Suspense></AuthGuard>} />
        <Route path="/profile" element={<AuthGuard><Suspense fallback={<PageLoader />}><Profile /></Suspense></AuthGuard>} />
        <Route path="/profile/addresses" element={<AuthGuard><Suspense fallback={<PageLoader />}><Addresses /></Suspense></AuthGuard>} />
      </Routes>
      <ChatPanel />
      <LoginModal open={isLoginModalOpen} onClose={closeLoginModal} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
