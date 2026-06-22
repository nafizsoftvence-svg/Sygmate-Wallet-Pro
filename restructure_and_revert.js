import fs from 'fs';
import { execSync } from 'child_process';

function run() {
  try {
    console.log('Reverting src/App.tsx to original state...');
    execSync('git checkout src/App.tsx', { stdio: 'inherit' });
  } catch (err) {
    console.log('Revert failed or git not initialized. Proceeding with backup...', err.message);
  }

  const filePath = 'src/App.tsx';
  let content = fs.readFileSync(filePath, 'utf8');

  // Insert the state variables first
  const stateInjectedLine = "function AgentDashboard({ profile, isOffline = false }: { profile: UserProfile, isOffline?: boolean, key?: string }) {\n  const [agentActiveTab, setAgentActiveTab] = useState<'OVERVIEW' | 'TRANSACTION_HISTORY' | 'CUSTOMER_MANAGEMENT' | 'SYSTEM_RATES'>('OVERVIEW');\n  const [agentMobileSidebarOpen, setAgentMobileSidebarOpen] = useState(false);";
  content = content.replace("function AgentDashboard({ profile, isOffline = false }: { profile: UserProfile, isOffline?: boolean, key?: string }) {", stateInjectedLine);

  const startIdx = content.indexOf('function AgentDashboard');
  if (startIdx === -1) {
    throw new Error('Could not find function AgentDashboard');
  }

  // 1. Locate the return statement start
  const returnMarker = 'return (\n    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">';
  const returnMarkerCR = 'return (\r\n    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">';
  let returnPos = content.indexOf(returnMarker, startIdx);
  let usesCR = false;
  if (returnPos === -1) {
    returnPos = content.indexOf(returnMarkerCR, startIdx);
    if (returnPos === -1) {
      throw new Error('Could not find start of return statement of AgentDashboard');
    }
    usesCR = true;
  }
  const fileLineEnding = usesCR ? '\r\n' : '\n';

  // Find various sections below returnPos to extract their contents
  // A. Welcome block (Notification Bar Header)
  const welcomeStartMarker = '{/* Agent Dashboard Notification Bar Header */}';
  const customCardsMarker = '{/* Agent Custom Dynamic Metric Cards */}';
  
  const welcomeStart = content.indexOf(welcomeStartMarker, returnPos);
  const customCardsStart = content.indexOf(customCardsMarker, returnPos);

  if (welcomeStart === -1 || customCardsStart === -1) {
    throw new Error('Could not find welcome or custom metric cards markers.');
  }

  // Extract Welcome / Header Bar
  const welcomeBlock = content.substring(content.indexOf('<div', welcomeStart), content.lastIndexOf('</div>', customCardsStart) + 6);

  // B. Metric cards block
  const heroWalletMarker = '{/* Hero Wallet Card */}';
  const heroWalletStart = content.indexOf(heroWalletMarker, returnPos);
  if (heroWalletStart === -1) {
    throw new Error('Could not find Hero Wallet Card marker');
  }
  // Metric cards is between customCardsStart and heroWalletStart
  const rawMetricCards = content.substring(content.indexOf('<div', customCardsStart), content.lastIndexOf('</div>', heroWalletStart) + 6);
  // Remove "hidden" from the class if it exists
  const metricCardsBlock = rawMetricCards.replace('className="hidden grid', 'className="grid');

  // C. Hero wallet card
  const commissionTrackerMarker = '{/* Commission Tracker Section */}';
  const commissionTrackerStart = content.indexOf(commissionTrackerMarker, returnPos);
  if (commissionTrackerStart === -1) {
    throw new Error('Could not find Commission Tracker Section marker');
  }
  const heroWalletBlock = content.substring(content.indexOf('<div', heroWalletStart), content.lastIndexOf('</div>', commissionTrackerStart) + 6);

  // D. Commission tracker section
  const gridMarker = '<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">';
  const gridMarkerPos = content.indexOf(gridMarker, commissionTrackerStart);
  if (gridMarkerPos === -1) {
    throw new Error('Could not find grid cols container marker');
  }
  const commissionBlock = content.substring(content.indexOf('<div', commissionTrackerStart), content.lastIndexOf('</div>', gridMarkerPos) + 6);

  // E. History Panel
  const customerManagementMarker = '{/* Customer Management Panel */}';
  const customerManagementStart = content.indexOf(customerManagementMarker, gridMarkerPos);
  if (customerManagementStart === -1) {
    throw new Error('Could not find Customer Management Panel marker');
  }
  const historyPanelStart = content.indexOf('/* History Panel */', gridMarkerPos);
  const historyBlock = content.substring(content.indexOf('<div', historyPanelStart), content.lastIndexOf('</div>', customerManagementStart) + 6);

  // F. Customer Management Panel
  const quickSidebarMarker = '{/* Quick Action Overlay / Sidebar */}';
  const quickSidebarStart = content.indexOf(quickSidebarMarker, customerManagementStart);
  if (quickSidebarStart === -1) {
    throw new Error('Could not find Quick Action Sidebar marker');
  }
  const customerBlock = content.substring(content.indexOf('<div', customerManagementStart), content.lastIndexOf('</div>', quickSidebarStart) + 6);

  // G. Quick action sidebar
  const customerDetailsModalMarker = '{/* Customer Details Modal */}';
  const customerDetailsModalStart = content.indexOf(customerDetailsModalMarker, quickSidebarStart);
  if (customerDetailsModalStart === -1) {
    throw new Error('Could not find Customer Details Modal marker');
  }
  const sidebarBlock = content.substring(content.indexOf('<div', quickSidebarStart), content.lastIndexOf('</div>', customerDetailsModalStart) + 6);

  // H. Modals block (everything after Customer Details Modal up to the end of return statement)
  const returnEndMarker = '    </motion.div>\n  );\n}';
  const returnEndMarkerCR = '    </motion.div>\r\n  );\r\n}';
  let endPos = content.indexOf(returnEndMarker, customerDetailsModalStart);
  if (endPos === -1) {
    endPos = content.indexOf(returnEndMarkerCR, customerDetailsModalStart);
    if (endPos === -1) {
      throw new Error('Could not find end of return statement of AgentDashboard');
    }
  }

  const modalsBlock = content.substring(customerDetailsModalStart, endPos);

  // Construct the brand-new, modern Return block for AgentDashboard with correct layouts
  const newReturnBlock = `  return (
    <div className="flex flex-col md:flex-row gap-8 min-h-screen">
      {/* Sidebar Navigation */}
      <aside className="w-72 bg-white border border-slate-200 rounded-[2rem] p-6 md:block hidden shrink-0 self-start shadow-sm sticky top-6 font-sans">
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-extrabold shadow-md">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800 tracking-tight uppercase leading-none font-sans">Agent Portal</h2>
            <span className="text-[9px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md mt-1 inline-block font-sans">FINANCIAL PARTNER</span>
          </div>
        </div>

        <nav className="space-y-1.5">
          {[
            { id: 'OVERVIEW' as const, label: 'Overview', icon: LayoutDashboard },
            { id: 'TRANSACTION_HISTORY' as const, label: 'My History', icon: History },
            { id: 'CUSTOMER_MANAGEMENT' as const, label: 'My Customers', icon: Users, count: myCustomers.length },
            { id: 'SYSTEM_RATES' as const, label: 'System Rates', icon: Settings },
          ].map((t) => {
            const Icon = t.icon;
            const isActive = agentActiveTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setAgentActiveTab(t.id)}
                className={cn(
                  "w-full flex items-center justify-between px-4.5 py-3.5 rounded-2xl text-xs font-bold transition-all group cursor-pointer border-l-4",
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm border-indigo-700 font-extrabold"
                    : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/80"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon size={16} className={cn(isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600")} />
                  <span>{t.label}</span>
                </div>
                {t.count !== undefined && t.count > 0 && (
                  <span className={cn(
                    "px-2 py-0.5 rounded-lg text-[10px] font-extrabold font-mono",
                    isActive ? "bg-white text-indigo-600" : "bg-indigo-100 text-indigo-700"
                  )}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="pt-8 border-t border-slate-100 mt-8">
          <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl">
            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1 font-sans">Signed In As</span>
            <p className="text-xs font-black text-slate-800 truncate font-sans">{profile.name}</p>
            <p className="text-[10px] text-slate-500 font-bold font-mono">{profile.phone}</p>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {agentMobileSidebarOpen && (
          <div className="fixed inset-0 z-[200] md:hidden font-sans">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAgentMobileSidebarOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="absolute inset-y-0 left-0 w-72 bg-white p-6 shadow-2xl flex flex-col justify-between border-r border-slate-150"
            >
              <div>
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-extrabold shadow-sm">
                      <ShieldCheck size={16} />
                    </div>
                    <span className="font-extrabold text-sm text-slate-850 uppercase tracking-tight font-sans">Agent Portal</span>
                  </div>
                  <button onClick={() => setAgentMobileSidebarOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400">
                    <X size={18} />
                  </button>
                </div>

                <nav className="space-y-1">
                  {[
                    { id: 'OVERVIEW' as const, label: 'Overview', icon: LayoutDashboard },
                    { id: 'TRANSACTION_HISTORY' as const, label: 'My History', icon: History },
                    { id: 'CUSTOMER_MANAGEMENT' as const, label: 'My Customers', icon: Users, count: myCustomers.length },
                    { id: 'SYSTEM_RATES' as const, label: 'System Rates', icon: Settings },
                  ].map((t) => {
                    const Icon = t.icon;
                    const isActive = agentActiveTab === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => {
                          setAgentActiveTab(t.id);
                          setAgentMobileSidebarOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-xs font-bold transition-all group cursor-pointer border-l-4",
                          isActive
                            ? "bg-indigo-600 text-white shadow-sm border-indigo-700 font-extrabold"
                            : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/80"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon size={15} className={cn(isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600")} />
                          <span>{t.label}</span>
                        </div>
                        {t.count !== undefined && t.count > 0 && (
                          <span className={cn(
                            "px-2 py-0.5 rounded-md text-[9px] font-extrabold font-mono",
                            isActive ? "bg-white text-indigo-600" : "bg-indigo-150 text-indigo-700"
                          )}>
                            {t.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block mb-1">Active Agent</span>
                <p className="text-xs font-black text-slate-850 truncate font-sans">{profile.name}</p>
                <p className="text-[10px] text-slate-400 font-semibold font-mono">{profile.phone}</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Content Column */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Mobile Nav Header Row */}
        <div className="md:hidden flex items-center justify-between bg-white border border-slate-200 p-4 rounded-3xl shadow-sm">
          <button
            onClick={() => setAgentMobileSidebarOpen(true)}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
          >
            <List size={16} />
            <span className="text-[10px] font-black uppercase tracking-wider">NAV MENU</span>
          </button>
          
          <div className="text-right">
            <span className="text-[9px] font-extrabold text-indigo-600 uppercase tracking-wider block bg-indigo-50/50 px-2 py-0.5 rounded-md inline-block font-sans">
              {agentActiveTab === 'OVERVIEW' ? 'Overview' :
               agentActiveTab === 'TRANSACTION_HISTORY' ? 'My History' :
               agentActiveTab === 'CUSTOMER_MANAGEMENT' ? 'My Customers' : 'System Rates'}
            </span>
          </div>
        </div>

        {/* Global Alert Center Top Bar Greeting */}
        ${welcomeBlock}

        {/* Dynamic Inner Tab Content */}
        {agentActiveTab === 'OVERVIEW' && (
          <div className="space-y-8 animate-fade-in">
            {/* Metric Cards in Overview */}
            ${metricCardsBlock}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column (Wallet & Commission Chart) */}
              <div className="lg:col-span-2 space-y-8">
                ${heroWalletBlock}
                ${commissionBlock}
              </div>

              {/* Right Column (Sidebar Deposit/Withdrawal form or Rates) */}
              ${sidebarBlock}
            </div>
          </div>
        )}

        {agentActiveTab === 'TRANSACTION_HISTORY' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
            ${historyBlock}
            ${sidebarBlock}
          </div>
        )}

        {agentActiveTab === 'CUSTOMER_MANAGEMENT' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in font-sans">
            ${customerBlock}
            ${sidebarBlock}
          </div>
        )}

        {agentActiveTab === 'SYSTEM_RATES' && (
          <div className="max-w-4xl mx-auto space-y-6 animate-fade-in font-sans">
            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <Settings size={22} />
                </div>
                <div>
                  <h3 className="font-extrabold text-xl text-slate-900 font-sans">System Exchange Rates</h3>
                  <p className="text-xs text-slate-500 font-semibold font-sans">Current standard rates set by the System Supervisor</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div className="p-6 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                   <div>
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">USD to Bangladeshi Taka</span>
                     <span className="text-2xl font-black text-slate-950">৳ {settings.usdToBdt}</span>
                   </div>
                   <div className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-black font-mono">USD/BDT</div>
                 </div>
                 <div className="p-6 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                   <div>
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">EUR to Bangladeshi Taka</span>
                     <span className="text-2xl font-black text-slate-950">৳ {settings.eurToBdt}</span>
                   </div>
                   <div className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-black font-mono">EUR/BDT</div>
                 </div>
                 <div className="p-6 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                   <div>
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">Withdrawal Commission Fee</span>
                     <span className="text-2xl font-black text-slate-950">{settings.commissionPercent}%</span>
                   </div>
                   <div className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-black font-mono">FEE</div>
                 </div>
                 <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between">
                   <div>
                     <span className="text-[10px] font-emerald-700 font-bold uppercase tracking-widest block font-sans">Agent Share (Toll Earned)</span>
                     <span className="text-2xl font-black text-emerald-700 font-sans">\${(settings.agentCommission ?? 1.5).toFixed(2)}</span>
                   </div>
                   <div className="px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-black font-mono font-sans">EARNINGS</div>
                 </div>
              </div>
            </div>
          </div>
        )}
      </div>

      \${modalsBlock}
    </div>
  );
}
`;

  // Do the replacement
  const beforeReturn = content.substring(0, returnPos);
  const afterReturn = content.substring(endPos + (usesCR ? returnEndMarkerCR.length : returnEndMarker.length));

  fs.writeFileSync(filePath, beforeReturn + newReturnBlock + afterReturn, 'utf8');
  console.log('Successfully completed the restructuring script on src/App.tsx');
}

run();
