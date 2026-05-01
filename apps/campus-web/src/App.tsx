import { useState } from 'react';
import { ChatPanel } from './components/ChatPanel.js';
import { BookOpen, CreditCard, Calendar, Home } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');

  const tabs = [
    { id: 'home', label: '首页', icon: Home },
    { id: 'schedule', label: '课表', icon: Calendar },
    { id: 'payments', label: '缴费', icon: CreditCard },
    { id: 'reservations', label: '预约', icon: BookOpen },
  ];

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">校园助手</h1>
        <span className="text-sm opacity-80">AI 智能服务</span>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4">
        <ChatPanel appType="campus" />
      </main>

      {/* Bottom Nav */}
      <nav className="bg-white border-t flex">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center py-2 text-xs ${
                activeTab === tab.id ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              <Icon className="w-5 h-5 mb-1" />
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
