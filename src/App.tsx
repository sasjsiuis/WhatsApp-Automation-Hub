import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Users, 
  FileText, 
  Settings as SettingsIcon,
  QrCode,
  Send,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { io } from 'socket.io-client';
import { clsx } from 'clsx';

const socket = io();

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isConnected, setIsConnected] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [liveMessages, setLiveMessages] = useState<any[]>([]);
  const [connectedNumber, setConnectedNumber] = useState<string | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  useEffect(() => {
    socket.on('connect', () => setIsSocketConnected(true));
    socket.on('disconnect', () => setIsSocketConnected(false));
    socket.on('qr', (qr) => setQrCode(qr));
    socket.on('connection-status', (status) => {
      setIsConnected(status === 'open');
      if (status === 'open') setQrCode(null);
    });
    
    socket.on('connected-number', (num) => setConnectedNumber(num));
    socket.on('contacts', (data) => setContacts(data));
    socket.on('chats', (data) => setChats(data));
    socket.on('new-message', (msg) => {
      setLiveMessages(prev => [msg, ...prev].slice(0, 50));
    });

    return () => {
      socket.off('connect');
      socket.off('qr');
      socket.off('connection-status');
      socket.off('contacts');
      socket.off('chats');
    };
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard isConnected={isConnected} qrCode={qrCode} chats={chats} />;
      case 'live':
        return <LiveMessages messages={liveMessages} />;
      case 'messages':
        return <Messages isConnected={isConnected} contacts={contacts} />;
      case 'contacts':
        return <ContactsList contacts={contacts} />;
      case 'templates':
        return <Templates />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard isConnected={isConnected} qrCode={qrCode} chats={chats} />;
    }
  };

  if (!isSocketConnected) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-emerald-500" size={48} />
          <p className="text-neutral-500 font-medium">Connecting to server...</p>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return <Login qrCode={qrCode} />;
  }

  return (
    <div className="flex h-screen bg-neutral-50 overflow-hidden">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={clsx(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-neutral-200 flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
          <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <MessageSquare className="text-emerald-500" />
            WA Hub
          </h1>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-neutral-400">
            <XCircle size={24} />
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <SidebarItem 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }} 
          />
          <SidebarItem 
            icon={<MessageSquare size={20} />} 
            label="Live Messages" 
            active={activeTab === 'live'} 
            onClick={() => { setActiveTab('live'); setIsSidebarOpen(false); }} 
          />
          <SidebarItem 
            icon={<Send size={20} />} 
            label="Send Message" 
            active={activeTab === 'messages'} 
            onClick={() => { setActiveTab('messages'); setIsSidebarOpen(false); }} 
          />
          <SidebarItem 
            icon={<Users size={20} />} 
            label="Contacts" 
            active={activeTab === 'contacts'} 
            onClick={() => { setActiveTab('contacts'); setIsSidebarOpen(false); }} 
          />
          <SidebarItem 
            icon={<FileText size={20} />} 
            label="Templates" 
            active={activeTab === 'templates'} 
            onClick={() => { setActiveTab('templates'); setIsSidebarOpen(false); }} 
          />
          <SidebarItem 
            icon={<SettingsIcon size={20} />} 
            label="Settings" 
            active={activeTab === 'settings'} 
            onClick={() => { setActiveTab('settings'); setIsSidebarOpen(false); }} 
          />
          <button
            onClick={async () => {
              if (confirm('Are you sure you want to logout?')) {
                await fetch('/api/logout', { method: 'POST' });
                window.location.reload();
              }
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-red-500 hover:bg-red-50 mt-auto"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </nav>

        <div className="p-4 border-t border-neutral-200">
          <div className="flex flex-col gap-2 p-3 rounded-lg bg-neutral-50">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className="text-sm font-medium text-neutral-600">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            {isConnected && connectedNumber && (
              <p className="text-xs text-neutral-400 font-mono">
                Sender: {connectedNumber}
              </p>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white border-b border-neutral-200 p-4 flex items-center justify-between sticky top-0 z-30">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-lg">
            <LayoutDashboard size={24} />
          </button>
          <div className="flex flex-col items-center">
            <h1 className="text-lg font-bold text-neutral-900">WA Hub</h1>
            {isConnected && connectedNumber && (
              <span className="text-[10px] text-neutral-400 font-mono leading-none">
                {connectedNumber}
              </span>
            )}
          </div>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-6xl mx-auto"
            >
              {activeTab === 'dashboard' ? <Dashboard isConnected={isConnected} qrCode={qrCode} chats={chats} connectedNumber={connectedNumber} /> : renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function Login({ qrCode }: any) {
  const [method, setMethod] = useState<'qr' | 'phone'>('qr');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    socket.on('pairing-code', (code) => {
      setPairingCode(code);
      setLoading(false);
    });
    socket.on('pairing-code-error', (err) => {
      setError(err);
      setLoading(false);
    });
    return () => {
      socket.off('pairing-code');
      socket.off('pairing-code-error');
    };
  }, []);

  const handleRequestPairingCode = () => {
    if (!phoneNumber) return;
    setLoading(true);
    setError(null);
    setPairingCode(null);
    socket.emit('request-pairing-code', phoneNumber);
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-neutral-200 p-8 space-y-8 text-center"
      >
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center">
            <MessageSquare className="text-emerald-500 w-8 h-8" />
          </div>
        </div>
        
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Login to WA Hub</h1>
          <p className="text-neutral-500 mt-2">Choose your preferred login method.</p>
        </div>

        <div className="flex p-1 bg-neutral-100 rounded-xl">
          <button 
            onClick={() => setMethod('qr')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${method === 'qr' ? 'bg-white text-emerald-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
          >
            QR Code
          </button>
          <button 
            onClick={() => setMethod('phone')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${method === 'phone' ? 'bg-white text-emerald-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
          >
            Phone Number
          </button>
        </div>

        {method === 'qr' ? (
          <div className="space-y-6">
            <div className="flex justify-center p-4 bg-neutral-50 rounded-2xl border border-neutral-100 min-h-[280px] items-center">
              {qrCode ? (
                <div className="relative group">
                  <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64" />
                  <div className="absolute inset-0 border-2 border-emerald-500 rounded-lg opacity-20 group-hover:opacity-40 transition-opacity" />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 text-neutral-400">
                  <Loader2 className="animate-spin w-8 h-8" />
                  <p className="text-sm font-medium">Generating QR Code...</p>
                  <button 
                    onClick={() => window.location.reload()}
                    className="text-xs text-emerald-600 font-bold hover:underline"
                  >
                    Refresh Page
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-4 text-left">
              <h3 className="text-sm font-bold text-neutral-700 uppercase tracking-wider">Instructions:</h3>
              <ul className="text-sm text-neutral-600 space-y-2">
                <li className="flex gap-2">
                  <span className="font-bold text-emerald-500">1.</span>
                  Open WhatsApp on your phone
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-emerald-500">2.</span>
                  Tap Menu or Settings and select Linked Devices
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-emerald-500">3.</span>
                  Tap on Link a Device
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-emerald-500">4.</span>
                  Point your phone to this screen to scan the code
                </li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2 text-left">
                <label className="text-sm font-bold text-neutral-700 uppercase tracking-wider">Phone Number</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="e.g. 8801775390365"
                    className="flex-1 px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                  <button 
                    onClick={handleRequestPairingCode}
                    disabled={loading || !phoneNumber}
                    className="px-6 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-all"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : 'Get Code'}
                  </button>
                </div>
                <p className="text-[10px] text-neutral-400">Include country code without '+' (e.g. 88017...)</p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100">
                  {error}
                </div>
              )}

              {pairingCode && (
                <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-4">
                  <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Your Pairing Code</p>
                  <div className="flex justify-center gap-2">
                    {pairingCode.split('').map((char, i) => (
                      <div key={i} className="w-8 h-10 bg-white border border-emerald-200 rounded-lg flex items-center justify-center text-xl font-bold text-emerald-700 shadow-sm">
                        {char}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-emerald-500">Enter this code on your phone when prompted.</p>
                </div>
              )}
            </div>

            <div className="space-y-4 text-left">
              <h3 className="text-sm font-bold text-neutral-700 uppercase tracking-wider">Instructions:</h3>
              <ul className="text-sm text-neutral-600 space-y-2">
                <li className="flex gap-2">
                  <span className="font-bold text-emerald-500">1.</span>
                  Open WhatsApp on your phone
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-emerald-500">2.</span>
                  Tap Menu or Settings and select Linked Devices
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-emerald-500">3.</span>
                  Tap on Link a Device
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-emerald-500">4.</span>
                  Select "Link with phone number instead"
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-emerald-500">5.</span>
                  Enter the 8-character code shown above
                </li>
              </ul>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-neutral-100">
          <p className="text-xs text-neutral-400">
            Your messages and data remain private and secure.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        active 
          ? 'bg-emerald-50 text-emerald-700 font-semibold' 
          : 'text-neutral-500 hover:bg-neutral-100'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Dashboard({ isConnected, qrCode, chats, connectedNumber }: any) {
  return (
    <div className="space-y-8">
      <header className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-neutral-900">Dashboard</h2>
          <p className="text-neutral-500">Welcome back to your WhatsApp Automation Hub.</p>
        </div>
        <div className="flex items-center gap-4">
          {isConnected && connectedNumber && (
            <div className="bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-xl hidden md:block text-right">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Active Sender</p>
              <p className="text-sm font-mono font-bold text-emerald-700">{connectedNumber}</p>
            </div>
          )}
          <button
            onClick={async () => {
              if (confirm('Are you sure you want to logout?')) {
                await fetch('/api/logout', { method: 'POST' });
                window.location.reload();
              }
            }}
            className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all"
            title="Logout"
          >
            <LogOut size={24} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <StatCard label="Total Messages" value="1,284" change="+12%" />
        <StatCard label="Active Chats" value={chats.length.toString()} change="Synced" />
        <StatCard label="Success Rate" value="98.2%" change="+0.5%" />
      </div>

      {isConnected && chats.length > 0 && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-neutral-200">
            <h3 className="font-bold text-neutral-900">Recent Chats</h3>
          </div>
          <div className="divide-y divide-neutral-100">
            {chats.slice(0, 5).map((chat: any) => (
              <div key={chat.id} className="p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                    {chat.name?.[0] || chat.id[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-neutral-900">{chat.name || chat.id.split('@')[0]}</p>
                    <p className="text-xs text-neutral-500 truncate max-w-[200px]">{chat.lastMessage || 'No messages yet'}</p>
                  </div>
                </div>
                <span className="text-xs text-neutral-400">
                  {chat.unreadCount > 0 && (
                    <span className="bg-emerald-500 text-white px-2 py-0.5 rounded-full font-bold mr-2">
                      {chat.unreadCount}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, change }: any) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
      <p className="text-sm font-medium text-neutral-500 uppercase tracking-wider">{label}</p>
      <div className="mt-2 flex items-baseline justify-between">
        <h4 className="text-3xl font-bold text-neutral-900">{value}</h4>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
          change.startsWith('+') ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-600'
        }`}>
          {change}
        </span>
      </div>
    </div>
  );
}

function ContactsList({ contacts }: any) {
  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-2xl md:text-3xl font-bold text-neutral-900">Contacts</h2>
        <p className="text-neutral-500">All your synced WhatsApp contacts.</p>
      </header>

      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-neutral-200 bg-neutral-50">
          <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
            {contacts.length} Contacts Found
          </p>
        </div>
        <div className="divide-y divide-neutral-100 max-h-[600px] overflow-y-auto">
          {contacts.length === 0 ? (
            <div className="p-12 text-center text-neutral-400">
              <Users size={48} className="mx-auto mb-4 opacity-20" />
              <p>No contacts synced yet. Make sure you're connected.</p>
            </div>
          ) : (
            contacts.map((contact: any) => (
              <div key={contact.id} className="p-4 flex items-center gap-4 hover:bg-neutral-50 transition-colors">
                <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 font-bold overflow-hidden">
                  {contact.imgUrl ? (
                    <img src={contact.imgUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    contact.name?.[0] || contact.id[0]
                  )}
                </div>
                <div>
                  <p className="font-bold text-neutral-900">{contact.name || contact.id.split('@')[0]}</p>
                  <p className="text-sm text-neutral-500">{contact.id.split('@')[0]}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function LiveMessages({ messages }: { messages: any[] }) {
  return (
    <div className="max-w-4xl space-y-8">
      <header>
        <h2 className="text-2xl md:text-3xl font-bold text-neutral-900">Live Messages</h2>
        <p className="text-neutral-500">Real-time incoming messages from your WhatsApp.</p>
      </header>

      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden min-h-[400px]">
        <div className="p-4 border-b border-neutral-200 bg-neutral-50 flex justify-between items-center">
          <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
            {messages.length} Recent Messages
          </p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Live</span>
          </div>
        </div>
        
        <div className="divide-y divide-neutral-100">
          {messages.length === 0 ? (
            <div className="p-20 text-center text-neutral-400">
              <MessageSquare size={48} className="mx-auto mb-4 opacity-20" />
              <p>No new messages yet. They will appear here in real-time.</p>
            </div>
          ) : (
            messages.map((msg: any) => (
              <div key={msg.id} className="p-6 hover:bg-neutral-50 transition-colors flex gap-4">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                  {msg.from[0]}
                </div>
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <p className="font-bold text-neutral-900 truncate">{msg.from.split('@')[0]}</p>
                    <p className="text-[10px] text-neutral-400 font-mono">
                      {new Date(msg.timestamp * 1000).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                    <p className="text-sm text-neutral-700 whitespace-pre-wrap break-words">{msg.text}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Messages({ isConnected, contacts }: any) {
  const [phoneNumbers, setPhoneNumbers] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');

  useEffect(() => {
    fetch('/api/templates')
      .then(res => res.json())
      .then(data => setTemplates(data));
  }, []);

  const addNumber = (num: string) => {
    const cleanNum = num.replace(/\D/g, '');
    if (cleanNum && !phoneNumbers.includes(cleanNum)) {
      setPhoneNumbers(prev => [...prev, cleanNum]);
    }
    setCurrentInput('');
  };

  const removeNumber = (num: string) => {
    setPhoneNumbers(prev => prev.filter(p => p !== num));
  };

  const handleTemplateChange = (content: string) => {
    setSelectedTemplate(content);
    setMessage(content);
  };

  const handleSend = async () => {
    if (phoneNumbers.length === 0 || !message) return;
    setSending(true);
    setProgress({ current: 0, total: phoneNumbers.length });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < phoneNumbers.length; i++) {
      const num = phoneNumbers[i];
      setProgress(prev => ({ ...prev, current: i + 1 }));
      
      try {
        const res = await fetch('/api/send-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: num, message }),
        });
        if (res.ok) successCount++;
        else failCount++;
      } catch (err) {
        console.error(err);
        failCount++;
      }
      
      // Small delay between messages to prevent spam detection
      if (i < phoneNumbers.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    setSending(false);
    alert(`Bulk sending complete!\nSuccess: ${successCount}\nFailed: ${failCount}`);
    if (successCount > 0) {
      setMessage('');
      setSelectedTemplate('');
      setPhoneNumbers([]);
    }
  };

  return (
    <div className="max-w-2xl space-y-8">
      <header>
        <h2 className="text-2xl md:text-3xl font-bold text-neutral-900">Bulk Messaging</h2>
        <p className="text-neutral-500">Send messages to multiple recipients at once.</p>
      </header>

      <div className="bg-white p-6 md:p-8 rounded-2xl border border-neutral-200 shadow-sm space-y-6">
        {/* Template Picker */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-neutral-700 uppercase tracking-wider">Select Template</label>
          <select 
            className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
            value={selectedTemplate}
            onChange={(e) => handleTemplateChange(e.target.value)}
          >
            <option value="">-- Choose a saved template --</option>
            {templates.map(t => (
              <option key={t.id} value={t.content}>{t.title}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2 relative">
          <div className="flex justify-between items-center">
            <label className="text-sm font-bold text-neutral-700 uppercase tracking-wider">Recipients ({phoneNumbers.length})</label>
            <button 
              onClick={() => setShowContactPicker(!showContactPicker)}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
            >
              {showContactPicker ? 'Close Picker' : 'Pick from Contacts'}
            </button>
          </div>
          
          {showContactPicker ? (
            <div className="absolute z-10 top-full left-0 right-0 mt-2 bg-white border border-neutral-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
              {contacts.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => {
                    addNumber(c.id.split('@')[0]);
                    setShowContactPicker(false);
                  }}
                  className="w-full p-3 text-left hover:bg-neutral-50 flex items-center gap-3 border-b border-neutral-100 last:border-0"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                    {c.name?.[0] || c.id[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-neutral-900">{c.name || c.id.split('@')[0]}</p>
                    <p className="text-xs text-neutral-500">{c.id.split('@')[0]}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Enter number (e.g. 88017...)"
                  className="flex-1 px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addNumber(currentInput)}
                />
                <button 
                  onClick={() => addNumber(currentInput)}
                  className="px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-xl transition-colors"
                >
                  Add
                </button>
              </div>
              
              {phoneNumbers.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                  {phoneNumbers.map(num => (
                    <span key={num} className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-neutral-200 rounded-full text-xs font-bold text-neutral-700">
                      {num}
                      <button onClick={() => removeNumber(num)} className="text-neutral-400 hover:text-red-500">
                        <XCircle size={14} />
                      </button>
                    </span>
                  ))}
                  <button 
                    onClick={() => setPhoneNumbers([])}
                    className="text-[10px] font-bold text-red-500 uppercase tracking-widest ml-auto"
                  >
                    Clear All
                  </button>
                </div>
              )}
              <p className="text-[10px] text-neutral-400">Include country code without '+' (e.g. 88017...)</p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-neutral-700 uppercase tracking-wider">Message Content</label>
          <textarea 
            rows={5}
            placeholder="Type your message here..."
            className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all resize-none"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        {sending && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold text-neutral-500 uppercase">
              <span>Sending Progress</span>
              <span>{progress.current} / {progress.total}</span>
            </div>
            <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <button 
          onClick={handleSend}
          disabled={!isConnected || sending || phoneNumbers.length === 0 || !message}
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-300 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
        >
          {sending ? <Loader2 className="animate-spin" /> : <Send size={20} />}
          {sending ? `Sending (${progress.current}/${progress.total})...` : `Send to ${phoneNumbers.length} Recipients`}
        </button>
        
        {!isConnected && (
          <p className="text-center text-sm text-red-500 font-medium">
            Please connect WhatsApp to send messages.
          </p>
        )}
      </div>
    </div>
  );
}

function Templates() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      setTemplates(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleAdd = async () => {
    if (!newTitle || !newContent) return;
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, content: newContent }),
      });
      if (res.ok) {
        fetchTemplates();
        setShowModal(false);
        setNewTitle('');
        setNewContent('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      if (res.ok) fetchTemplates();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-neutral-900">Templates</h2>
          <p className="text-neutral-500">Manage your reusable message templates.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="px-6 py-3 bg-neutral-900 text-white font-bold rounded-xl hover:bg-neutral-800 transition-all flex items-center gap-2"
        >
          <Plus size={20} />
          New Template
        </button>
      </header>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-neutral-400" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {templates.map(t => (
            <TemplateCard 
              key={t.id} 
              title={t.title} 
              content={t.content} 
              onDelete={() => handleDelete(t.id)} 
            />
          ))}
        </div>
      )}

      {/* New Template Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-2xl p-8 shadow-2xl space-y-6"
            >
              <h3 className="text-xl font-bold text-neutral-900">Create Template</h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Title</label>
                  <input 
                    type="text" 
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="e.g. Welcome Message"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Content</label>
                  <textarea 
                    rows={4}
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                    placeholder="Hi {{name}}, welcome!"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 bg-neutral-100 text-neutral-600 font-bold rounded-xl hover:bg-neutral-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAdd}
                  className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                >
                  Create
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TemplateCard({ title, content, onDelete }: any) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm group">
      <div className="flex justify-between items-start mb-4">
        <h4 className="font-bold text-neutral-900">{title}</h4>
        <button 
          onClick={onDelete}
          className="text-neutral-400 hover:text-red-500 transition-colors"
        >
          <Trash2 size={18} />
        </button>
      </div>
      <p className="text-neutral-600 text-sm bg-neutral-50 p-4 rounded-xl border border-neutral-100 italic">
        "{content}"
      </p>
    </div>
  );
}

function Settings() {
  return (
    <div className="max-w-2xl space-y-8">
      <header>
        <h2 className="text-3xl font-bold text-neutral-900">Settings</h2>
        <p className="text-neutral-500">Configure your hub preferences.</p>
      </header>

      <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-neutral-900">Auto-Reconnect</h4>
            <p className="text-sm text-neutral-500">Automatically try to reconnect if disconnected.</p>
          </div>
          <div className="w-12 h-6 bg-emerald-500 rounded-full relative">
            <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-neutral-900">Message Delay</h4>
            <p className="text-sm text-neutral-500">Delay between messages in bulk sends (seconds).</p>
          </div>
          <input type="number" defaultValue={5} className="w-20 px-3 py-2 border border-neutral-200 rounded-lg text-center font-bold" />
        </div>
      </div>
    </div>
  );
}
