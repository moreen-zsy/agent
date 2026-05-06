import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { ShoppingBag, Menu, X, User, LogOut } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { totalItems, toggleCart } = useCart();
  const { user, logout, openLoginModal } = useAuth();
  const location = useLocation();

  const isOrderPage = location.pathname === '/order';

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      setMobileMenuOpen(false);
    }
  };

  const handleCartClick = () => {
    if (!user) {
      openLoginModal();
      return;
    }
    toggleCart();
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-white/5'
            : 'bg-transparent'
        }`}
      >
        <div className="w-full px-6 lg:px-12 h-20 flex items-center justify-between">
          {/* Logo */}
          <Link
            to="/"
            className="text-white font-display font-bold text-2xl tracking-tight hover:text-brand-orange transition-colors"
          >
            GUSTO
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-10">
            {isOrderPage ? (
              <>
                <Link
                  to="/"
                  className="text-white/70 hover:text-white text-xs uppercase tracking-widest font-display transition-colors relative group"
                >
                  首页
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-brand-orange transition-all duration-300 group-hover:w-full" />
                </Link>
                <Link
                  to="/order"
                  className="text-brand-orange text-xs uppercase tracking-widest font-display transition-colors relative group"
                >
                  甄选美味
                  <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-brand-orange" />
                </Link>
              </>
            ) : (
              <>
                <button
                  onClick={() => scrollToSection('hero')}
                  className="text-white/70 hover:text-white text-xs uppercase tracking-widest font-display transition-colors relative group"
                >
                  首页
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-brand-orange transition-all duration-300 group-hover:w-full" />
                </button>
                <button
                  onClick={() => scrollToSection('philosophy')}
                  className="text-white/70 hover:text-white text-xs uppercase tracking-widest font-display transition-colors relative group"
                >
                  关于我们
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-brand-orange transition-all duration-300 group-hover:w-full" />
                </button>
                <button
                  onClick={() => scrollToSection('menu-showcase')}
                  className="text-white/70 hover:text-white text-xs uppercase tracking-widest font-display transition-colors relative group"
                >
                  精选菜单
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-brand-orange transition-all duration-300 group-hover:w-full" />
                </button>
              </>
            )}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            {user ? (
              <div className="hidden md:flex items-center gap-3">
                <span className="text-white/70 text-xs font-display">
                  {user.name || user.email}
                </span>
                <button
                  onClick={logout}
                  className="p-2 text-white/50 hover:text-white transition-colors"
                  title="退出登录"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={openLoginModal}
                className="hidden md:flex items-center gap-2 text-white/70 hover:text-white text-xs uppercase tracking-widest font-display transition-colors"
              >
                <User className="w-4 h-4" />
                登录
              </button>
            )}

            <Link
              to="/order"
              className="hidden md:block text-xs uppercase tracking-widest font-display bg-brand-orange text-white px-5 py-2.5 rounded-full hover:bg-brand-orange/90 transition-all hover:shadow-glow"
            >
              立即点餐
            </Link>

            <button
              onClick={handleCartClick}
              className="relative p-2 text-white/70 hover:text-white transition-colors"
              aria-label="购物车"
            >
              <ShoppingBag className="w-5 h-5" />
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-brand-orange text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </button>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 text-white/70 hover:text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl flex flex-col items-center justify-center gap-8 md:hidden">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="text-white text-2xl font-display tracking-tight"
          >
            首页
          </Link>
          <Link
            to="/order"
            onClick={() => setMobileMenuOpen(false)}
            className="text-white text-2xl font-display tracking-tight"
          >
            甄选美味
          </Link>
          <button
            onClick={() => {
              handleCartClick();
              setMobileMenuOpen(false);
            }}
            className="text-brand-orange text-2xl font-display tracking-tight flex items-center gap-2"
          >
            购物车 {totalItems > 0 && `(${totalItems})`}
          </button>
          {user ? (
            <button
              onClick={() => {
                logout();
                setMobileMenuOpen(false);
              }}
              className="text-white/50 text-lg font-display"
            >
              退出登录
            </button>
          ) : (
            <button
              onClick={() => {
                openLoginModal();
                setMobileMenuOpen(false);
              }}
              className="text-white text-lg font-display"
            >
              登录 / 注册
            </button>
          )}
        </div>
      )}
    </>
  );
}
