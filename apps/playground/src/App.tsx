import { useState } from 'react';
import { Playground } from './components/Playground.js';
import { AgentTest } from './components/AgentTest.js';
import { AuthProvider } from './context/AuthContext.js';
import { FlaskConical, Bot, Code2 } from 'lucide-react';

type Tab = 'jsonl' | 'agent';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('jsonl');

  return (
    <AuthProvider>
      <div className="h-screen flex flex-col">
      {/* 顶部导航 */}
      <nav className="bg-gray-900 text-white flex items-center px-4 h-12 shrink-0">
        <div className="flex items-center gap-2 mr-8">
          <Code2 className="w-5 h-5 text-blue-400" />
          <span className="font-semibold text-sm">A2UI Playground</span>
          <span className="text-xs text-gray-400 ml-1">v0.9</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('jsonl')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
              activeTab === 'jsonl'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-800'
            }`}
          >
            <FlaskConical className="w-4 h-4" />
            JSONL 测试
          </button>
          <button
            onClick={() => setActiveTab('agent')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
              activeTab === 'agent'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Bot className="w-4 h-4" />
            Agent 测试
          </button>
        </div>
      </nav>

      {/* 内容区域 */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'jsonl' && <Playground />}
        {activeTab === 'agent' && <AgentTest />}
      </main>
    </div>
    </AuthProvider>
  );
}
