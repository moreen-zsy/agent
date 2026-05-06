import { Routes, Route, Navigate } from 'react-router'
import WebGLBackground from '@/components/WebGLBackground'
import Header from '@/components/Header'
import CartSidebar from '@/components/CartSidebar'
import LoginModal from '@/components/LoginModal'
import { ChatPanel } from '@/components/ChatPanel'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import Home from './pages/Home'
import Order from './pages/Order'

function OrderGuard() {
  const { user, openLoginModal } = useAuth();

  if (!user) {
    openLoginModal();
    return <Navigate to="/" replace />;
  }

  return <Order />;
}

function AppContent() {
  const { isLoginModalOpen, closeLoginModal } = useAuth();

  return (
    <div className="relative min-h-screen bg-[#0A0A0A]">
      <WebGLBackground />
      <Header />
      <CartSidebar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/order" element={<OrderGuard />} />
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
