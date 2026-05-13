import { Routes, Route, Navigate } from 'react-router'
import WebGLBackground from '@/components/WebGLBackground'
import Header from '@/components/Header'
import CartSidebar from '@/components/CartSidebar'
import LoginModal from '@/components/LoginModal'
import { ChatPanel } from '@/components/ChatPanel'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import Home from './pages/Home'
import Order from './pages/Order'
import AiOrder from './pages/AiOrder'
import Orders from './pages/Orders'
import OrderDetail from './pages/OrderDetail'
import Profile from './pages/Profile'
import Addresses from './pages/Addresses'

function LandingRedirect() {
  return <Navigate to="/ai-order" replace />;
}

function OrderGuard() {
  const { user, openLoginModal } = useAuth();

  if (!user) {
    openLoginModal();
    return <Navigate to="/" replace />;
  }

  return <Order />;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, openLoginModal } = useAuth();

  if (!user) {
    openLoginModal();
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
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
        <Route path="/home" element={<Home />} />
        <Route path="/order" element={<OrderGuard />} />
        <Route path="/ai-order" element={<AiOrder />} />
        <Route path="/orders" element={<AuthGuard><Orders /></AuthGuard>} />
        <Route path="/orders/:id" element={<AuthGuard><OrderDetail /></AuthGuard>} />
        <Route path="/profile" element={<AuthGuard><Profile /></AuthGuard>} />
        <Route path="/profile/addresses" element={<AuthGuard><Addresses /></AuthGuard>} />
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
