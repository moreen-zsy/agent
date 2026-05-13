import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { ShoppingBag, Menu, X, User, LogOut, ChevronDown, Package, Settings } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { totalItems, toggleCart } = useCart();
  const { user, logout, openLoginModal } = useAuth();
  const location = useLocation();

  const isAppPage =
    location.pathname === '/order' ||
    location.pathname === '/ai-order' ||
    location.pathname.startsWith('/orders') ||
    location.pathname.startsWith('/profile');

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close user menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
            {isAppPage ? (
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
                  className={`text-xs uppercase tracking-widest font-display transition-colors relative group ${
                    location.pathname === '/order' ? 'text-brand-orange' : 'text-white/70 hover:text-white'
                  }`}
                >
                  甄选美味
                  <span className={`absolute -bottom-1 left-0 h-0.5 bg-brand-orange transition-all duration-300 ${
                    location.pathname === '/order' ? 'w-full' : 'w-0 group-hover:w-full'
                  }`} />
                </Link>
                <Link
                  to="/ai-order"
                  className={`text-xs uppercase tracking-widest font-display transition-colors relative group ${
                    location.pathname === '/ai-order' ? 'text-brand-orange' : 'text-white/70 hover:text-white'
                  }`}
                >
                  AI 点餐
                  <span className={`absolute -bottom-1 left-0 h-0.5 bg-brand-orange transition-all duration-300 ${
                    location.pathname === '/ai-order' ? 'w-full' : 'w-0 group-hover:w-full'
                  }`} />
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
              <div className="hidden md:block relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 text-white/70 hover:text-white text-xs uppercase tracking-widest font-display transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-brand-orange/20 flex items-center justify-center">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <span className="max-w-[100px] truncate">{user.name || user.email}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-[#111] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50">
                    <Link
                      to="/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-white/70 hover:text-white hover:bg-white/5 transition-colors text-sm font-display"
                    >
                      <Settings className="w-4 h-4" />
                      个人资料
                    </Link>
                    <Link
                      to="/orders"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-white/70 hover:text-white hover:bg-white/5 transition-colors text-sm font-display"
                    >
                      <Package className="w-4 h-4" />
                      我的订单
                    </Link>
                    <div className="border-t border-white/5" />
                    <button
                      onClick={() => {
                        logout();
                        setUserMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-white/40 hover:text-red-400 hover:bg-white/5 transition-colors text-sm font-display"
                    >
                      <LogOut className="w-4 h-4" />
                      退出登录
                    </button>
                  </div>
                )}
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
          <Link
            to="/ai-order"
            onClick={() => setMobileMenuOpen(false)}
            className="text-white text-2xl font-display tracking-tight"
          >
            AI点餐
          </Link>
          {user && (
            <>
              <Link
                to="/orders"
                onClick={() => setMobileMenuOpen(false)}
                className="text-white text-2xl font-display tracking-tight"
              >
                我的订单
              </Link>
              <Link
                to="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="text-white text-2xl font-display tracking-tight"
              >
                个人中心
              </Link>
            </>
          )}
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
