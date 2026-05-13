import { Clock, CheckCircle, ChefHat, Package, Truck, CheckCircle2, XCircle } from 'lucide-react';
import type { OrderStatus, OrderStatusHistory } from '@/types';

interface OrderStepperProps {
  currentStatus: OrderStatus;
  history: OrderStatusHistory[];
}

const statusFlow: OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'delivering',
  'delivered',
];

const statusLabels: Record<string, string> = {
  pending: '订单已提交',
  confirmed: '商家已接单',
  preparing: '制作中',
  ready: '待配送',
  delivering: '配送中',
  delivered: '已送达',
  cancelled: '已取消',
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="w-4 h-4" />,
  confirmed: <CheckCircle className="w-4 h-4" />,
  preparing: <ChefHat className="w-4 h-4" />,
  ready: <Package className="w-4 h-4" />,
  delivering: <Truck className="w-4 h-4" />,
  delivered: <CheckCircle2 className="w-4 h-4" />,
  cancelled: <XCircle className="w-4 h-4" />,
};

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function OrderStepper({ currentStatus, history }: OrderStepperProps) {
  if (currentStatus === 'cancelled') {
    const cancelRecord = history.find(h => h.status === 'cancelled');
    return (
      <div className="py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-400">
            <XCircle className="w-4 h-4" />
          </div>
          <div>
            <p className="text-red-400 font-display text-sm font-medium">已取消</p>
            {cancelRecord && (
              <p className="text-white/30 text-xs mt-0.5">
                {formatDateTime(cancelRecord.createdAt)}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const currentIndex = statusFlow.indexOf(currentStatus);

  // Build steps with history data where available
  const steps = statusFlow.map((status, index) => {
    const historyRecord = history.find(h => h.status === status);
    const isActive = index <= currentIndex;
    const isCurrent = index === currentIndex;

    return {
      status,
      label: statusLabels[status],
      icon: statusIcons[status],
      isActive,
      isCurrent,
      time: historyRecord?.createdAt,
      message: historyRecord?.message,
    };
  });

  return (
    <div className="py-2">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const showStep = step.isActive || (index === currentIndex + 1 && currentStatus !== 'delivered');

        if (!showStep && !step.isActive) return null;

        return (
          <div key={step.status} className="flex gap-3">
            {/* Timeline line + dot */}
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  step.isCurrent
                    ? 'bg-brand-orange text-white'
                    : step.isActive
                    ? 'bg-brand-orange/20 text-brand-orange'
                    : 'bg-white/5 text-white/30'
                }`}
              >
                {step.icon}
              </div>
              {!isLast && (
                <div
                  className={`w-px flex-1 min-h-[24px] my-1 ${
                    index < currentIndex ? 'bg-brand-orange/40' : 'bg-white/5'
                  }`}
                />
              )}
            </div>

            {/* Content */}
            <div className={`pb-4 ${!isLast ? '' : ''}`}>
              <p
                className={`font-display text-sm font-medium ${
                  step.isCurrent
                    ? 'text-brand-orange'
                    : step.isActive
                    ? 'text-white'
                    : 'text-white/30'
                }`}
              >
                {step.label}
              </p>
              {step.time && (
                <p className="text-white/30 text-xs mt-0.5">
                  {formatDateTime(step.time)}
                </p>
              )}
              {step.message && step.isCurrent && (
                <p className="text-white/40 text-xs mt-1 font-serif">{step.message}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
