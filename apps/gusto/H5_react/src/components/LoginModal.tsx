import { useState } from 'react';
import { X, Mail, User, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api';
import { toast } from 'sonner';

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

export default function LoginModal({ open, onClose }: LoginModalProps) {
  const { login } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      const result =
        mode === 'login'
          ? await api.auth.login({ email })
          : await api.auth.register({ email, name: name || email.split('@')[0] });

      if (result.success && result.data) {
        login(result.data.token, result.data.user);
        toast.success(mode === 'login' ? '登录成功！' : '注册成功！');
        setEmail('');
        setName('');
      } else {
        toast.error(result.error?.message || '操作失败');
      }
    } catch {
      toast.error('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#111] rounded-3xl overflow-hidden max-w-md w-full shadow-2xl border border-white/10">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/80 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="px-8 pt-10 pb-6">
          <h2 className="text-white font-display text-2xl font-bold tracking-tight">
            {mode === 'login' ? '欢迎回来' : '创建账户'}
          </h2>
          <p className="text-white/40 font-serif text-sm mt-2">
            {mode === 'login'
              ? '登录您的账户以继续点餐'
              : '注册一个新账户开始您的美食之旅'}
          </p>
        </div>

        {/* Tabs */}
        <div className="px-8 mb-6">
          <div className="flex bg-white/5 rounded-xl p-1">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2.5 rounded-lg font-display text-sm transition-all ${
                mode === 'login'
                  ? 'bg-brand-orange text-white'
                  : 'text-white/50 hover:text-white/70'
              }`}
            >
              登录
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 py-2.5 rounded-lg font-display text-sm transition-all ${
                mode === 'register'
                  ? 'bg-brand-orange text-white'
                  : 'text-white/50 hover:text-white/70'
              }`}
            >
              注册
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 pb-10 space-y-5">
          {/* Name field (register only) */}
          {mode === 'register' && (
            <div className="space-y-2">
              <label className="text-white/70 font-display text-xs uppercase tracking-wider">
                昵称
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="text"
                  placeholder="您的昵称"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white font-display text-sm placeholder:text-white/30 focus:outline-none focus:border-brand-orange/50 transition-colors"
                />
              </div>
            </div>
          )}

          {/* Email field */}
          <div className="space-y-2">
            <label className="text-white/70 font-display text-xs uppercase tracking-wider">
              邮箱地址
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-11 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white font-display text-sm placeholder:text-white/30 focus:outline-none focus:border-brand-orange/50 transition-colors"
              />
            </div>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading || !email}
            className="w-full py-4 bg-brand-orange text-white font-display font-semibold text-sm uppercase tracking-widest rounded-xl hover:bg-brand-orange/90 transition-all hover:shadow-glow active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {mode === 'login' ? '登录中...' : '注册中...'}
              </>
            ) : mode === 'login' ? (
              '登录'
            ) : (
              '注册'
            )}
          </button>

          {/* Hint */}
          <p className="text-white/30 text-xs text-center font-serif">
            {mode === 'login'
              ? '首次使用？切换到注册 tab 创建账户'
              : '已有账户？切换到登录 tab 直接登录'}
          </p>
        </form>
      </div>
    </div>
  );
}
