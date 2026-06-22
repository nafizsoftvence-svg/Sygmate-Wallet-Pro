import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Users, 
  History, 
  LayoutDashboard, 
  UserCircle,
  PlusCircle,
  Search,
  Check,
  X,
  CreditCard,
  Building,
  Smartphone,
  RefreshCw,
  FileText,
  TrendingUp,
  Briefcase,
  Upload,
  Eye,
  Info,
  Clock,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Copy,
  ThumbsUp,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../firebase';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  doc,
  updateDoc
} from 'firebase/firestore';

interface Transaction {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL';
  agentId: string;
  agentName?: string;
  customerId?: string;
  customerName?: string;
  senderId?: string | null;
  senderName?: string | null;
  receiverId?: string | null;
  receiverName?: string | null;
  receiverPhone?: string | null;
  amount: number;
  currency: 'USD' | 'EUR' | 'BDT';
  conversionRate: number;
  commissionRate: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  transitionId: string;
  transitionFile?: { name: string, type: string, base64: string } | null;
  method: string;
  timestamp: any;
}

interface UserProfile {
  uid: string;
  name: string;
  phone: string;
  role: 'ADMIN' | 'AGENT' | 'CUSTOMER';
  balance: number;
  status: 'PENDING' | 'ACTIVE' | 'REJECTED';
  photoURL?: string;
}

interface WalletPluginWidgetProps {
  embedded?: boolean;
  initialTheme?: string;
  initialAmount?: string;
  initialAgentId?: string;
  initialCustomerId?: string;
  onTransactionSuccess?: (tx: any) => void;
}

export default function WalletPluginWidget({
  embedded = false,
  initialTheme,
  initialAmount,
  initialAgentId,
  initialCustomerId,
  onTransactionSuccess
}: WalletPluginWidgetProps) {
  // Read setup params from URL parameters or props fallback
  const params = useMemo(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return {
      theme: urlParams.get('theme') || initialTheme || 'indigo',
      agentId: urlParams.get('agentId') || initialAgentId || 'sandbox_agent_1',
      customerId: urlParams.get('customerId') || initialCustomerId || 'cust_phone_123',
      amount: urlParams.get('amount') || initialAmount || '',
      currency: urlParams.get('currency') || 'BDT',
      logo: urlParams.get('logo') || '',
      merchantName: urlParams.get('merchant') || 'WalletPro Merchant'
    };
  }, [initialTheme, initialAmount, initialAgentId, initialCustomerId]);

  const [activeTheme, setActiveTheme] = useState(params.theme);
  const [activeTab, setActiveTab] = useState<'PAY' | 'WITHDRAW' | 'HISTORY' | 'INFO'>('PAY');
  
  // Simulated or Linked Profiles States
  const [isOffline, setIsOffline] = useState(() => {
    return localStorage.getItem('is_offline_mode') === 'true' || !auth.currentUser;
  });

  const [simulatedRole, setSimulatedRole] = useState<'CUSTOMER' | 'AGENT' | 'ADMIN'>('CUSTOMER');
  const [customerBalance, setCustomerBalance] = useState(25000); // virtual default
  const [agentName, setAgentName] = useState('Global Fast Agent');
  const [activeTransactions, setActiveTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  // Form states
  const [payAmount, setPayAmount] = useState(params.amount);
  const [payMethod, setPayMethod] = useState('bKash');
  const [transitionId, setTransitionId] = useState('');
  const [payCustomerPhone, setPayCustomerPhone] = useState(params.customerId);
  const [payCustomerName, setPayCustomerName] = useState('Guest Customer');
  const [receiptFile, setReceiptFile] = useState<{ name: string, type: string, base64: string } | null>(null);

  // Withdrawal States
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');

  // UI Feedback toasts/notifications
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'err' | 'info', text: string } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Theme mapping classes
  const themeColors = useMemo(() => {
    switch (activeTheme) {
      case 'emerald':
        return {
          primary: 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white',
          text: 'text-emerald-600',
          border: 'border-emerald-200 focus:border-emerald-500',
          bgLight: 'bg-emerald-50',
          bgBadge: 'bg-emerald-100 text-emerald-800',
          gradient: 'from-emerald-600 to-teal-700',
          accent: 'emerald',
          focusRing: 'focus:ring-emerald-500'
        };
      case 'rose':
        return {
          primary: 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white',
          text: 'text-rose-600',
          border: 'border-rose-200 focus:border-rose-500',
          bgLight: 'bg-rose-50',
          bgBadge: 'bg-rose-100 text-rose-800',
          gradient: 'from-rose-600 to-red-700',
          accent: 'rose',
          focusRing: 'focus:ring-rose-500'
        };
      case 'amber':
        return {
          primary: 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white',
          text: 'text-amber-600',
          border: 'border-amber-200 focus:border-amber-500',
          bgLight: 'bg-amber-50',
          bgBadge: 'bg-amber-100 text-amber-800',
          gradient: 'from-amber-600 to-orange-700',
          accent: 'amber',
          focusRing: 'focus:ring-amber-500'
        };
      case 'slate':
        return {
          primary: 'bg-slate-700 hover:bg-slate-800 active:bg-slate-900 text-white',
          text: 'text-slate-700',
          border: 'border-slate-300 focus:border-slate-600',
          bgLight: 'bg-slate-100',
          bgBadge: 'bg-slate-200 text-slate-800',
          gradient: 'from-slate-700 to-slate-900',
          accent: 'slate',
          focusRing: 'focus:ring-slate-600'
        };
      case 'indigo':
      default:
        return {
          primary: 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white',
          text: 'text-indigo-600',
          border: 'border-slate-200 focus:border-indigo-500',
          bgLight: 'bg-indigo-50',
          bgBadge: 'bg-indigo-100 text-indigo-800',
          gradient: 'from-indigo-600 to-violet-700',
          accent: 'indigo',
          focusRing: 'focus:ring-indigo-500'
        };
    }
  }, [activeTheme]);

  // Load transactions
  useEffect(() => {
    setLoading(true);
    if (isOffline) {
      // Load local transactions matching simulated sender
      const loadLocal = () => {
        const txs: Transaction[] = JSON.parse(localStorage.getItem('sandbox_transactions') || '[]');
        // Filter transactions logically belonging to this customer or agent
        const filtered = txs.filter(t => 
          t.customerId === payCustomerPhone || 
          t.senderId === payCustomerPhone || 
          t.receiverPhone === payCustomerPhone
        );
        setActiveTransactions(filtered);
        setLoading(false);
      };
      
      loadLocal();
      // Listen for local changes
      window.addEventListener('storage', loadLocal);
      return () => window.removeEventListener('storage', loadLocal);
    } else {
      // Load real firestore transactions filtered for this user if logged in
      const q = query(
        collection(db, 'transactions'), 
        where('customerId', '==', payCustomerPhone),
        orderBy('timestamp', 'desc')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const txs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Transaction));
        setActiveTransactions(txs);
        setLoading(false);
      }, () => {
        // Fallback silently if forbidden
        setLoading(false);
      });
      return unsubscribe;
    }
  }, [isOffline, payCustomerPhone]);

  // Handle setting Toast Alert
  const showToast = (text: string, type: 'success' | 'err' | 'info' = 'info') => {
    setAlertMsg({ type, text });
    setTimeout(() => {
      setAlertMsg(null);
    }, 4500);
  };

  // Convert files to base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (file.size > 150000) {
      showToast('Image is too large (Maximum 150KB for sandbox embedding).', 'err');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setReceiptFile({
        name: file.name,
        type: file.type,
        base64: reader.result as string
      });
      showToast('Document uploaded successfully!', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // Generate code-friendly unique Transaction ID
  const generateSimulatedTxID = () => {
    const randomHex = Math.floor(Math.random() * 1e12).toString(16).toUpperCase();
    setTransitionId(`TX-${Date.now().toString().slice(-4)}-${randomHex}`);
    showToast('Draft Transaction ID pre-filled!', 'info');
  };

  // Submit payment / deposit
  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(payAmount);
    
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast('Please enter a valid amount greater than 0.', 'err');
      return;
    }
    if (!transitionId.trim()) {
      showToast('Transaction ID / Transition ID is required for verification.', 'err');
      return;
    }

    try {
      const newTx: any = {
        type: 'DEPOSIT',
        agentId: params.agentId,
        agentName: agentName,
        customerId: payCustomerPhone,
        customerName: payCustomerName,
        senderId: payCustomerPhone,
        senderName: payCustomerName,
        amount: amountNum,
        currency: params.currency,
        conversionRate: 1,
        commissionRate: 1.5,
        status: 'PENDING',
        transitionId: transitionId.trim(),
        transitionFile: receiptFile,
        method: payMethod,
        timestamp: new Date().toISOString()
      };

      if (isOffline) {
        // Save to offline simulator
        const localTxs = JSON.parse(localStorage.getItem('sandbox_transactions') || '[]');
        const id = `local_tx_${Date.now()}`;
        const finalTx = { id, ...newTx };
        localStorage.setItem('sandbox_transactions', JSON.stringify([finalTx, ...localTxs]));
        
        // Log custom log
        const logs = JSON.parse(localStorage.getItem('sandbox_system_logs') || '[]');
        logs.unshift({
          id: `log_${Date.now()}`,
          type: 'TX_CREATE',
          message: `Plugin transaction submitted: Deposit of $${amountNum} via ${payMethod} by ${payCustomerName}`,
          userPhone: payCustomerPhone,
          userName: payCustomerName,
          role: 'CUSTOMER',
          timestamp: new Date().toISOString()
        });
        localStorage.setItem('sandbox_system_logs', JSON.stringify(logs));

        // Dispatch storage update event
        window.dispatchEvent(new Event('storage'));
      } else {
        // Submit to live cloud database
        await addDoc(collection(db, 'transactions'), {
          ...newTx,
          timestamp: new Date()
        });
      }

      showToast('Payment / Deposit submitted for Agent approval! 🎉', 'success');
      
      // Callback if defined
      if (onTransactionSuccess) {
        onTransactionSuccess(newTx);
      }

      // Reset form fields
      setPayAmount('');
      setTransitionId('');
      setReceiptFile(null);
      setActiveTab('HISTORY');
    } catch (err: any) {
      console.error(err);
      showToast(`Error submitting transaction: ${err.message}`, 'err');
    }
  };

  // Submit withdrawal / cash-out request
  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(withdrawAmount);

    if (isNaN(amountNum) || amountNum <= 0) {
      showToast('Please specify a valid amount.', 'err');
      return;
    }
    if (amountNum > customerBalance) {
      showToast('Insufficient wallet balance to request withdrawal.', 'err');
      return;
    }
    if (!receiverName.trim() || !receiverPhone.trim()) {
      showToast('Receiver Name and Phone number are required.', 'err');
      return;
    }

    try {
      const generatedTxId = `TX-WDR-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 1e6)}`;
      const newTx: any = {
        type: 'WITHDRAWAL',
        agentId: params.agentId,
        agentName: agentName,
        customerId: payCustomerPhone,
        customerName: payCustomerName,
        senderId: payCustomerPhone,
        senderName: payCustomerName,
        receiverName: receiverName.trim(),
        receiverPhone: receiverPhone.trim(),
        amount: amountNum,
        currency: params.currency,
        conversionRate: 1,
        commissionRate: 1.5,
        status: 'PENDING',
        transitionId: generatedTxId,
        transitionFile: null,
        method: 'Wallet Withdrawal',
        timestamp: new Date().toISOString()
      };

      if (isOffline) {
        const localTxs = JSON.parse(localStorage.getItem('sandbox_transactions') || '[]');
        const finalTx = { id: `local_tx_${Date.now()}`, ...newTx };
        localStorage.setItem('sandbox_transactions', JSON.stringify([finalTx, ...localTxs]));
        
        // Subtract virtual balance
        setCustomerBalance(prev => prev - amountNum);

        // System log
        const logs = JSON.parse(localStorage.getItem('sandbox_system_logs') || '[]');
        logs.unshift({
          id: `log_${Date.now()}`,
          type: 'TX_CREATE',
          message: `Plugin cash-out submitted: Withdrawal of $${amountNum} for receiver ${receiverName}`,
          userPhone: payCustomerPhone,
          userName: payCustomerName,
          role: 'CUSTOMER',
          timestamp: new Date().toISOString()
        });
        localStorage.setItem('sandbox_system_logs', JSON.stringify(logs));

        window.dispatchEvent(new Event('storage'));
      } else {
        await addDoc(collection(db, 'transactions'), {
          ...newTx,
          timestamp: new Date()
        });
      }

      showToast('Cash-out withdrawal registered successfully!', 'success');
      setWithdrawAmount('');
      setReceiverName('');
      setReceiverPhone('');
      setActiveTab('HISTORY');
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'err');
    }
  };

  return (
    <div className={`w-full max-w-md mx-auto bg-white rounded-3xl border border-slate-200/80 shadow-2xl overflow-hidden font-sans ${embedded ? 'h-full max-h-[620px] flex flex-col justify-between' : ''}`}>
      {/* Widget Header Banner */}
      <div className={`p-5 text-white bg-gradient-to-r ${themeColors.gradient} flex items-center justify-between shadow-md shrink-0`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-md">
            <Wallet size={20} className="text-white" />
          </div>
          <div>
            <h3 className="font-extrabold text-[15px] tracking-tight leading-none">WalletPro Widget</h3>
            <p className="text-[10px] text-white/85 font-semibold mt-1 font-mono tracking-wide">
              {params.merchantName} ({isOffline ? 'SANDBOX' : 'LIVE'})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick theme selector inside plugin */}
          <select 
            value={activeTheme} 
            onChange={(e) => setActiveTheme(e.target.value)}
            className="text-[10px] font-black bg-white/10 text-white rounded-lg px-2 py-1 outline-none border border-white/20 uppercase"
            title="Switch Plugin Theme"
          >
            <option value="indigo" className="bg-slate-900 text-white text-xs">Indigo Theme</option>
            <option value="emerald" className="bg-slate-900 text-white text-xs">Emerald Theme</option>
            <option value="rose" className="bg-slate-900 text-white text-xs">Rose Theme</option>
            <option value="amber" className="bg-slate-900 text-white text-xs">Amber Theme</option>
            <option value="slate" className="bg-slate-900 text-white text-xs">Slate Theme</option>
          </select>
        </div>
      </div>

      {/* Widget Quick Info Band */}
      <div className="bg-slate-50 border-b border-slate-100 px-5 py-2.5 flex items-center justify-between text-[11px] font-medium text-slate-500 shrink-0">
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse mr-1"></span>
          <span>Customer Wallet:</span>
          <strong className="text-slate-800 font-bold font-mono">{payCustomerPhone}</strong>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-extrabold text-slate-700">Bal:</span>
          <span className="text-slate-900 font-black font-mono">
            {params.currency} {customerBalance.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Toast Alert Center inside iframe with slide down animation */}
      <div className="relative z-50 shrink-0">
        <AnimatePresence>
          {alertMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
              className={`p-3 text-[11px] font-bold text-center flex items-center justify-center gap-2 ${
                alertMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-150' : 
                alertMsg.type === 'err' ? 'bg-rose-50 text-rose-800 border-b border-rose-150' : 'bg-indigo-50 text-indigo-800 border-b border-indigo-150'
              }`}
            >
              <Info size={13} />
              <span>{alertMsg.text}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Primary Tab View Containers */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {activeTab === 'PAY' && (
          <motion.form 
            initial={{ opacity: 0, x: -10 }} 
            animate={{ opacity: 1, x: 0 }} 
            onSubmit={handlePaySubmit}
            className="space-y-3.5"
          >
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                Transaction Amount ({params.currency})
              </label>
              <div className="relative">
                <input 
                  type="number" 
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className={`w-full p-3 font-bold font-mono text-base border ${themeColors.border} rounded-2xl bg-slate-50/50 outline-none transition-all pr-12`}
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-black font-mono">
                  {params.currency}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                  Customer Mobile / ID
                </label>
                <input 
                  type="text" 
                  required
                  value={payCustomerPhone}
                  onChange={(e) => setPayCustomerPhone(e.target.value)}
                  className={`w-full p-2.5 text-xs font-bold font-mono border ${themeColors.border} rounded-xl bg-slate-50/50 outline-none`}
                  placeholder="017xxxxxxxx"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                  Customer Name
                </label>
                <input 
                  type="text" 
                  required
                  value={payCustomerName}
                  onChange={(e) => setPayCustomerName(e.target.value)}
                  className={`w-full p-2.5 text-xs font-bold border ${themeColors.border} rounded-xl bg-slate-50/50 outline-none`}
                  placeholder="User Name"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                Payment Channel
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['bKash', 'Nagad', 'Bank Transfer'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPayMethod(m)}
                    className={`py-2 px-1 text-center font-bold text-[11px] rounded-xl border transition-all ${
                      payMethod === m 
                        ? `${themeColors.bgLight} border-${themeColors.accent}-500 text-${themeColors.accent}-700 font-extrabold shadow-sm` 
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {m === 'bKash' && <span className="text-pink-600 mr-0.5">●</span>}
                    {m === 'Nagad' && <span className="text-orange-600 mr-0.5">●</span>}
                    {m === 'Bank Transfer' && <Building size={11} className="inline mr-1" />}
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Transaction Reference ID
                </label>
                <button
                  type="button"
                  onClick={generateSimulatedTxID}
                  className={`text-[9px] font-extrabold ${themeColors.text} hover:underline focus:outline-none`}
                >
                  Auto-Simulate ID
                </button>
              </div>
              <input 
                type="text" 
                required
                value={transitionId}
                onChange={(e) => setTransitionId(e.target.value)}
                placeholder="Paste Bkash / Nagad Transaction ID"
                className={`w-full p-2.5 font-bold font-mono text-xs border ${themeColors.border} rounded-xl bg-slate-50/50 outline-none`}
              />
            </div>

            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`p-3.5 border-2 border-dashed rounded-2xl text-center transition-all cursor-pointer relative ${
                isDragOver ? `border-${themeColors.accent}-500 ${themeColors.bgLight}` : 'border-slate-200 bg-slate-50/50'
              }`}
            >
              <input 
                type="file" 
                id="plugin-file" 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileChange}
              />
              <label htmlFor="plugin-file" className="cursor-pointer block">
                <Upload size={18} className="mx-auto text-slate-400 mb-1" />
                <p className="text-[10px] font-bold text-slate-500">
                  {receiptFile ? 'Document Uploaded' : 'Drag & drop image slip or Browse'}
                </p>
                <p className="text-[8px] text-slate-400 mt-0.5">Maximum image size 150KB</p>
              </label>
              {receiptFile && (
                <div className="absolute right-3 top-3 bg-indigo-500 text-white rounded-full p-0.5" title={receiptFile.name}>
                  <Check size={9} />
                </div>
              )}
            </div>

            <button
              type="submit"
              className={`w-full py-3.5 px-4 rounded-2xl font-black text-sm transition-all shadow-md active:scale-95 select-none ${themeColors.primary}`}
            >
              Verify & Complete Payment
            </button>
          </motion.form>
        )}

        {activeTab === 'WITHDRAW' && (
          <motion.form 
            initial={{ opacity: 0, x: 10 }} 
            animate={{ opacity: 1, x: 0 }} 
            onSubmit={handleWithdrawSubmit}
            className="space-y-4"
          >
            <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-2xl text-[10px] text-amber-800 leading-normal flex items-start gap-2 font-medium">
              <Info size={14} className="shrink-0 mt-0.5 text-amber-600" />
              <span>
                Withdrawal transactions are routed directly to your configured receivers list and must be approved by the agent before cash payout.
              </span>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                Withdrawal Amount ({params.currency})
              </label>
              <input 
                type="number" 
                step="1"
                required
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Specify withdrawal amount"
                className={`w-full p-2.5 font-bold font-mono text-xs border ${themeColors.border} rounded-xl bg-slate-50/50 outline-none`}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                Receiver details
              </label>
              <input 
                type="text" 
                required
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
                placeholder="Receiver name (e.g., Self / Relative)"
                className={`w-full p-2.5 font-bold text-xs border ${themeColors.border} rounded-xl bg-slate-50/50 outline-none`}
              />
              <input 
                type="text" 
                required
                value={receiverPhone}
                onChange={(e) => setReceiverPhone(e.target.value)}
                placeholder="Receiver Mobile Number"
                className={`w-full p-2.5 font-bold font-mono text-xs border ${themeColors.border} rounded-xl bg-slate-50/50 outline-none`}
              />
            </div>

            <button
              type="submit"
              className={`w-full py-3.5 px-4 rounded-2xl font-black text-sm transition-all shadow-md active:scale-95 select-none ${themeColors.primary}`}
            >
              Initiate Fast Cash-out
            </button>
          </motion.form>
        )}

        {activeTab === 'HISTORY' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Transaction Passbook</h4>
              <span className="text-[9px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">
                {activeTransactions.length} Recorded
              </span>
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-400">
                <RefreshCw className="animate-spin text-slate-400 mx-auto mb-2" size={20} />
                <span className="text-xs font-bold">Synchronizing entries...</span>
              </div>
            ) : activeTransactions.length === 0 ? (
              <div className="py-12 text-center text-slate-400 border border-slate-100 rounded-2xl bg-slate-50/50">
                <History className="mx-auto text-slate-300 mb-2" size={24} />
                <p className="text-xs font-bold leading-none">No transactions registered for this ID</p>
                <p className="text-[10px] text-slate-400 mt-1">Submit your first channel request above</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {activeTransactions.map((tx) => (
                  <div key={tx.id} className="p-3 bg-white hover:bg-slate-50/60 border border-slate-100 rounded-2xl transition-all flex items-center justify-between text-left shadow-sm">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`p-1.5 rounded-xl ${
                        tx.type === 'DEPOSIT' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                      }`}>
                        {tx.type === 'DEPOSIT' ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-800 leading-none truncate">
                          {tx.type === 'DEPOSIT' ? `Deposit (${tx.method})` : `Cash Out (${tx.receiverName || 'Receiver'})`}
                        </p>
                        <p className="text-[9px] text-slate-400 font-bold font-mono tracking-tighter mt-1 truncate">
                          TXID: {tx.transitionId || tx.id}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-black text-slate-900 font-mono tracking-tight leading-none">
                        {tx.type === 'DEPOSIT' ? '+' : '-'}{params.currency} {tx.amount.toLocaleString()}
                      </p>
                      <span className={`inline-block text-[8px] font-black uppercase mt-1 px-1.5 py-0.5 rounded-full ${
                        tx.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600' : 
                        tx.status === 'REJECTED' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {tx.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'INFO' && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="space-y-3.5 text-left"
          >
            <div className="border border-slate-100 bg-slate-50/50 p-4 rounded-2xl space-y-2">
              <span className="text-[10px] font-black uppercase text-indigo-600 tracking-widest block leading-none">Plugin Metadata</span>
              <h5 className="text-xs font-black text-slate-800">WalletPro Sandbox Core</h5>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                This widget mimics merchant gateways, cash portals, and checkout integration scripts. Any transaction generated in this widget updates active dashboards in real-time.
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block leading-none">API & Settings Config</span>
              <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2 font-mono">
                <span className="text-slate-500">Active Agent:</span>
                <span className="font-extrabold text-slate-800">{params.agentId}</span>
              </div>
              <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2 font-mono">
                <span className="text-slate-500">Active Sync:</span>
                <span className="font-extrabold text-emerald-600">{isOffline ? 'Local Storage (Sandbox)' : 'Cloud Live (Firestore)'}</span>
              </div>
              <div className="flex items-center justify-between text-xs pb-1 font-mono">
                <span className="text-slate-500">Widget Version:</span>
                <span className="font-extrabold text-slate-800">1.2.0 (Stable)</span>
              </div>
            </div>

            <button
              onClick={() => {
                setIsOffline(prev => {
                  const n = !prev;
                  localStorage.setItem('is_offline_mode', n ? 'true' : 'false');
                  showToast(`Switched back-end mode to ${n ? 'Sandbox Engine' : 'Cloud Database'}!`, 'info');
                  return n;
                });
              }}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-extrabold transition-all"
            >
              Toggle Core Backend Mode
            </button>
          </motion.div>
        )}
      </div>

      {/* Widget Tabs Footer bar */}
      <div className="bg-slate-50 border-t border-slate-200 px-3 py-2 shrink-0">
        <div className="grid grid-cols-4 gap-1">
          {[
            { id: 'PAY', label: 'Pay / Send', icon: ArrowUpRight },
            { id: 'WITHDRAW', label: 'Cash-out', icon: ArrowDownLeft },
            { id: 'HISTORY', label: 'History', icon: History },
            { id: 'INFO', label: 'API Widget', icon: Settings }
          ].map((t) => {
            const IconComponent = t.icon;
            const isSelected = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`py-2 px-1 text-center rounded-xl flex flex-col items-center justify-center gap-1 transition-all focus:outline-none select-none ${
                  isSelected 
                    ? `${themeColors.bgLight} text-${themeColors.accent}-600 font-extrabold` 
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                <IconComponent size={14} className={isSelected ? `text-${themeColors.accent}-600` : 'text-slate-400'} />
                <span className="text-[8px] font-black tracking-tight leading-none">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
