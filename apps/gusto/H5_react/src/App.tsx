import { Routes, Route } from 'react-router'
import WebGLBackground from '@/components/WebGLBackground'
import Header from '@/components/Header'
import CartSidebar from '@/components/CartSidebar'
import Home from './pages/Home'
import Order from './pages/Order'

export default function App() {
  return (
    <div className="relative min-h-screen bg-[#0A0A0A]">
      <WebGLBackground />
      <Header />
      <CartSidebar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/order" element={<Order />} />
      </Routes>
    </div>
  )
}
