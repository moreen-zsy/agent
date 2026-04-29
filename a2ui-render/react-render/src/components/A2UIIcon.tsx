/**
 * A2UI Icon 组件
 * 使用 lucide-react 图标库
 */

import {
  CircleUser,
  Plus,
  ArrowLeft,
  ArrowRight,
  Paperclip,
  Calendar,
  Phone,
  Camera,
  Check,
  X,
  Trash2,
  Download,
  Pencil,
  CalendarDays,
  AlertCircle,
  Heart,
  Folder,
  HelpCircle,
  Home,
  Info,
  MapPin,
  Lock,
  LockOpen,
  Mail,
  Menu,
  MoreVertical,
  MoreHorizontal,
  BellOff,
  Bell,
  CreditCard,
  User,
  Printer,
  RefreshCw,
  Search,
  Send,
  Settings,
  Share2,
  ShoppingCart,
  Star,
  StarHalf,
  Upload,
  Eye,
  EyeOff,
  AlertTriangle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  accountCircle: CircleUser,
  add: Plus,
  arrowBack: ArrowLeft,
  arrowForward: ArrowRight,
  attachFile: Paperclip,
  calendarToday: Calendar,
  call: Phone,
  camera: Camera,
  check: Check,
  close: X,
  delete: Trash2,
  download: Download,
  edit: Pencil,
  event: CalendarDays,
  error: AlertCircle,
  favorite: Heart,
  favoriteOff: Heart,
  folder: Folder,
  help: HelpCircle,
  home: Home,
  info: Info,
  locationOn: MapPin,
  lock: Lock,
  lockOpen: LockOpen,
  mail: Mail,
  menu: Menu,
  moreVert: MoreVertical,
  moreHoriz: MoreHorizontal,
  notificationsOff: BellOff,
  notifications: Bell,
  payment: CreditCard,
  person: User,
  phone: Phone,
  photo: Camera,
  print: Printer,
  refresh: RefreshCw,
  search: Search,
  send: Send,
  settings: Settings,
  share: Share2,
  shoppingCart: ShoppingCart,
  star: Star,
  starHalf: StarHalf,
  starOff: Star,
  upload: Upload,
  visibility: Eye,
  visibilityOff: EyeOff,
  warning: AlertTriangle,
};

export interface IconProps {
  name: string;
  size?: number;
}

export function A2UIIcon({ name, size = 20 }: IconProps) {
  const IconComponent = ICON_MAP[name];
  if (!IconComponent) {
    console.warn(`[A2UI] Unknown icon name: ${name}`);
    return null;
  }
  return <IconComponent size={size} />;
}
