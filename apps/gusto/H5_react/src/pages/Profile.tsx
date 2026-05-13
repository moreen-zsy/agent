import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  ArrowLeft, User, ShoppingBag, MapPin, LogOut, ChevronRight,
  Phone, Mail, Edit3, Save, X
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api';
import { toast } from 'sonner';

export default function Profile() {
  const { user, token, logout, login } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');

  if (!user) {
    return (
      <div className="relative z-10 min-h-screen pt-20 flex items-center justify-center">
        <div className="text-center text-white/30">
          <p className="font-display text-lg">请先登录</p>
          <Link to="/" className="mt-4 text-brand-orange text-sm font-display hover:underline inline-block">
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const result = await api.auth.updateProfile(token, { name, phone });
      if (result.data?.user) {
        login(token, result.data.user);
        toast.success('资料已更新');
        setEditing(false);
      } else {
        toast.error(result.error?.message || '更新失败');
      }
    } catch {
      toast.error('网络错误');
    } finally {
      setSaving(false);
    }
  };

  const menuItems = [
    { icon: <ShoppingBag className="w-5 h-5" />, label: '我的订单', to: '/orders' },
    { icon: <MapPin className="w-5 h-5" />, label: '收货地址', to: '/profile/addresses' },
  ];

  return (
    <div className="relative z-10 min-h-screen pt-20">
      <div className="px-6 lg:px-12 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => navigate('/')}
              className="text-white/50 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-white font-display text-2xl font-bold tracking-tight">
              个人中心
            </h1>
          </div>

          {/* Profile Card */}
          <div className="bg-[#111] rounded-2xl border border-white/5 p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-brand-orange/20 flex items-center justify-center text-brand-orange">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name || ''} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <User className="w-8 h-8" />
                  )}
                </div>
                <div>
                  {editing ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="姓名"
                        className="block w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm font-display focus:outline-none focus:border-brand-orange/50"
                      />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="手机号"
                        className="block w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm font-display focus:outline-none focus:border-brand-orange/50"
                      />
                    </div>
                  ) : (
                    <>
                      <p className="text-white font-display text-lg font-semibold">
                        {user.name || '未设置姓名'}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-white/40 text-xs flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {user.email}
                        </span>
                        {user.phone && (
                          <span className="text-white/40 text-xs flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {user.phone}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {editing ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="p-2 text-brand-orange hover:bg-brand-orange/10 rounded-lg transition-colors"
                    title="保存"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setName(user.name || '');
                      setPhone(user.phone || '');
                    }}
                    className="p-2 text-white/40 hover:bg-white/5 rounded-lg transition-colors"
                    title="取消"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="p-2 text-white/30 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                  title="编辑"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Menu */}
          <div className="mt-6 bg-[#111] rounded-2xl border border-white/5 overflow-hidden">
            {menuItems.map((item, index) => (
              <Link
                key={item.label}
                to={item.to}
                className={`flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors ${
                  index !== menuItems.length - 1 ? 'border-b border-white/5' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-white/40">{item.icon}</span>
                  <span className="text-white text-sm font-display">{item.label}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-white/20" />
              </Link>
            ))}
          </div>

          {/* Logout */}
          <button
            onClick={() => {
              if (confirm('确定要退出登录吗？')) {
                logout();
                navigate('/');
              }
            }}
            className="mt-6 w-full py-4 border border-white/10 text-white/50 rounded-2xl font-display text-sm uppercase tracking-wider hover:bg-white/5 hover:text-white transition-all flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            退出登录
          </button>
        </div>
      </div>
    </div>
  );
}
