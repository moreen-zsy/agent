import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowLeft, MapPin, Plus, X, Check, Trash2, Loader2,
  Home, Building2, School, Star
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api, mapAddress } from '@/api';
import { toast } from 'sonner';
import type { UserAddress } from '@/types';

const labelOptions = [
  { value: '家', icon: <Home className="w-3.5 h-3.5" /> },
  { value: '公司', icon: <Building2 className="w-3.5 h-3.5" /> },
  { value: '学校', icon: <School className="w-3.5 h-3.5" /> },
];

function AddressCard({
  address,
  onSetDefault,
  onDelete,
  deleting,
}: {
  address: UserAddress;
  onSetDefault: (id: string) => void;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  return (
    <div
      className={`bg-[#111] rounded-2xl border p-5 transition-all ${
        address.isDefault ? 'border-brand-orange/30' : 'border-white/5'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {address.label && (
              <span className="px-2 py-0.5 bg-white/5 text-white/50 text-[10px] font-display rounded-md">
                {address.label}
              </span>
            )}
            {address.isDefault && (
              <span className="px-2 py-0.5 bg-brand-orange/20 text-brand-orange text-[10px] font-display rounded-md flex items-center gap-1">
                <Star className="w-3 h-3" />
                默认
              </span>
            )}
          </div>
          <p className="text-white text-sm font-display mt-2">{address.address}</p>
          <div className="flex items-center gap-3 mt-1.5">
            {address.contactName && (
              <span className="text-white/40 text-xs">{address.contactName}</span>
            )}
            {address.phone && (
              <span className="text-white/40 text-xs">{address.phone}</span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          {!address.isDefault && (
            <button
              onClick={() => onSetDefault(address.id)}
              className="p-2 text-white/30 hover:text-brand-orange hover:bg-white/5 rounded-lg transition-colors"
              title="设为默认"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onDelete(address.id)}
            disabled={deleting}
            className="p-2 text-white/30 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function AddAddressForm({
  onSave,
  onCancel,
  saving,
}: {
  onSave: (data: {
    label?: string;
    address: string;
    phone?: string;
    contactName?: string;
    isDefault?: boolean;
  }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [contactName, setContactName] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) {
      toast.error('请填写地址');
      return;
    }
    onSave({
      label: label || undefined,
      address: address.trim(),
      phone: phone.trim() || undefined,
      contactName: contactName.trim() || undefined,
      isDefault,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-[#111] rounded-2xl border border-white/5 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-display text-sm font-medium">新增地址</h3>
        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 text-white/30 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Label */}
      <div className="flex gap-2">
        {labelOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setLabel(opt.value)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-display text-xs transition-all ${
              label === opt.value
                ? 'bg-brand-orange text-white'
                : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
            }`}
          >
            {opt.icon}
            {opt.value}
          </button>
        ))}
        {label && !labelOptions.some((o) => o.value === label) && (
          <button
            type="button"
            onClick={() => setLabel('')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-display text-xs bg-brand-orange text-white"
          >
            {label}
          </button>
        )}
      </div>

      <input
        type="text"
        placeholder="收货地址"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-display text-sm placeholder:text-white/30 focus:outline-none focus:border-brand-orange/50 transition-colors"
        required
      />
      <div className="grid grid-cols-2 gap-3">
        <input
          type="text"
          placeholder="联系人"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-display text-sm placeholder:text-white/30 focus:outline-none focus:border-brand-orange/50 transition-colors"
        />
        <input
          type="tel"
          placeholder="手机号"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-display text-sm placeholder:text-white/30 focus:outline-none focus:border-brand-orange/50 transition-colors"
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          className="w-4 h-4 accent-brand-orange"
        />
        <span className="text-white/50 text-sm font-display">设为默认地址</span>
      </label>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 border border-white/10 text-white/50 rounded-xl font-display text-sm hover:bg-white/5 transition-all"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 py-3 bg-brand-orange text-white rounded-xl font-display text-sm hover:bg-brand-orange/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              保存中...
            </>
          ) : (
            '保存'
          )}
        </button>
      </div>
    </form>
  );
}

export default function Addresses() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAddresses = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const list = await api.food.addresses.get(token);
      setAddresses(list.map(mapAddress));
    } catch {
      toast.error('加载地址失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAddresses();
  }, [token]);

  const handleSave = async (data: {
    label?: string;
    address: string;
    phone?: string;
    contactName?: string;
    isDefault?: boolean;
  }) => {
    if (!token) return;
    setSaving(true);
    try {
      await api.food.addresses.create(token, data);
      toast.success('地址已保存');
      setShowAddForm(false);
      fetchAddresses();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    if (!token) return;
    try {
      await api.food.addresses.update(id, token, { isDefault: true });
      toast.success('已设为默认地址');
      fetchAddresses();
    } catch {
      toast.error('设置失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    if (!confirm('确定要删除此地址吗？')) return;
    setDeletingId(id);
    try {
      await api.food.addresses.delete(id, token);
      toast.success('地址已删除');
      fetchAddresses();
    } catch {
      toast.error('删除失败');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="relative z-10 min-h-screen pt-20">
      <div className="px-6 lg:px-12 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => navigate('/profile')}
              className="text-white/50 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-white font-display text-2xl font-bold tracking-tight">
              收货地址
            </h1>
          </div>

          {/* Add button */}
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full py-4 mb-6 border border-dashed border-white/10 rounded-2xl text-white/40 hover:text-brand-orange hover:border-brand-orange/30 transition-all flex items-center justify-center gap-2 font-display text-sm"
            >
              <Plus className="w-4 h-4" />
              新增收货地址
            </button>
          )}

          {/* Add form */}
          {showAddForm && (
            <div className="mb-6">
              <AddAddressForm onSave={handleSave} onCancel={() => setShowAddForm(false)} saving={saving} />
            </div>
          )}

          {/* Address list */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-brand-orange animate-spin" />
              <p className="text-white/30 font-display text-sm mt-4">加载中...</p>
            </div>
          ) : addresses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-white/30">
              <MapPin className="w-16 h-16 mb-4" />
              <p className="font-display text-lg">暂无收货地址</p>
              <p className="font-serif text-sm mt-2">添加一个地址以便快速下单</p>
            </div>
          ) : (
            <div className="space-y-4">
              {addresses.map((addr) => (
                <AddressCard
                  key={addr.id}
                  address={addr}
                  onSetDefault={handleSetDefault}
                  onDelete={handleDelete}
                  deleting={deletingId === addr.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
