import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Database, Zap, GitBranch, Search, X, Home,
  Info, Mail, Lock, LogIn, ChevronRight, Command, Bell,
  Moon, User, Menu, Layers
} from "lucide-react";
import ToolGrid from "./ToolGrid";
import ContactPage from "./ContactPage";

// ─── Types ────────────────────────────────────────────────────────────────────
type Route = "home" | "about" | "contact" | "privacy" | "login";

interface SpotlightItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
}

// ─── Spotlight Search ─────────────────────────────────────────────────────────
function Spotlight({
  open, onClose, navigate
}: { open: boolean; onClose: () => void; navigate: (r: Route) => void }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items: SpotlightItem[] = [
    { id: "vault", label: "The Vault", description: "Security Auditor — scan code for secrets & weak crypto", icon: <Shield size={16} className="text-red-400" />, action: () => { onClose(); document.getElementById("tool-vault")?.scrollIntoView({ behavior: "smooth" }); }, category: "Tools" },
    { id: "titan", label: "Data Titan", description: "Process 1GB+ CSV/JSON files with client-side SQL", icon: <Database size={16} className="text-blue-400" />, action: () => { onClose(); document.getElementById("tool-titan")?.scrollIntoView({ behavior: "smooth" }); }, category: "Tools" },
    { id: "opti", label: "Opti-Neural", description: "AI image optimizer — 90% compression, 0% quality loss", icon: <Zap size={16} className="text-yellow-400" />, action: () => { onClose(); document.getElementById("tool-opti")?.scrollIntoView({ behavior: "smooth" }); }, category: "Tools" },
    { id: "flow", label: "Logic Flow", description: "Generate interactive flowcharts from code", icon: <GitBranch size={16} className="text-green-400" />, action: () => { onClose(); document.getElementById("tool-flow")?.scrollIntoView({ behavior: "smooth" }); }, category: "Tools" },
    { id: "about", label: "About Us", description: "Our Zero-Data Privacy mission", icon: <Info size={16} className="text-purple-400" />, action: () => { navigate("about"); onClose(); }, category: "Pages" },
    { id: "contact", label: "Contact", description: "Get in touch with the Aegis Nova team", icon: <Mail size={16} className="text-cyan-400" />, action: () => { navigate("contact"); onClose(); }, category: "Pages" },
    { id: "privacy", label: "Privacy Policy", description: "How we protect your data (spoiler: we don't touch it)", icon: <Lock size={16} className="text-orange-400" />, action: () => { navigate("privacy"); onClose(); }, category: "Pages" },
    { id: "login", label: "Sign In", description: "Firebase Auth — Google or Email", icon: <LogIn size={16} className="text-pink-400" />, action: () => { navigate("login"); onClose(); }, category: "Auth" },
  ];

  const filtered = query
    ? items.filter(i => i.label.toLowerCase().includes(query.toLowerCase()) || i.description.toLowerCase().includes(query.toLowerCase()))
    : items;

  useEffect(() => { if (open) { setQuery(""); setSelected(0); setTimeout(() => inputRef.current?.focus(), 50); } }, [open]);

  useEffect(() => { setSelected(0); }, [query]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && filtered[selected]) filtered[selected].action();
    if (e.key === "Escape") onClose();
  };

  const grouped = filtered.reduce((acc, item) => {
    (acc[item.category] = acc[item.category] || []).push(item);
    return acc;
  }, {} as Record<string, SpotlightItem[]>);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <motion.div className="relative w-full max-w-2xl overflow-hidden"
            style={{ background: "rgba(10,10,15,0.97)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, boxShadow: "0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(99,102,241,0.15)" }}
            initial={{ y: -20, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -10, scale: 0.97, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            onClick={e => e.stopPropagation()}>
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-4 border-b border-white/5">
              <Search size={18} className="text-white/30 flex-shrink-0" />
              <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Search tools, pages, commands…"
                className="flex-1 bg-transparent text-white placeholder-white/20 text-sm outline-none"
                style={{ fontFamily: "'JetBrains Mono', monospace" }} />
              {query && <button onClick={() => setQuery("")}><X size={14} className="text-white/20 hover:text-white/50 transition-colors" /></button>}
              <kbd className="text-[10px] text-white/20 border border-white/10 rounded px-1.5 py-0.5">ESC</kbd>
            </div>
            {/* Results */}
            <div className="max-h-96 overflow-y-auto py-2">
              {Object.keys(grouped).length === 0 && (
                <div className="px-4 py-8 text-center text-white/20 text-sm">No results for "{query}"</div>
              )}
              {Object.entries(grouped).map(([cat, catItems]) => (
                <div key={cat} className="mb-2">
                  <div className="px-4 py-1.5 text-[10px] font-semibold text-white/20 uppercase tracking-widest">{cat}</div>
                  {catItems.map((item) => {
                    const globalIdx = filtered.indexOf(item);
                    return (
                      <button key={item.id} className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all"
                        style={{ background: globalIdx === selected ? "rgba(99,102,241,0.1)" : "transparent" }}
                        onClick={item.action}
                        onMouseEnter={() => setSelected(globalIdx)}>
                        <span className="w-7 h-7 flex items-center justify-center rounded-lg"
                          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                          {item.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-white/90 text-sm font-medium">{item.label}</div>
                          <div className="text-white/30 text-xs truncate">{item.description}</div>
                        </div>
                        {globalIdx === selected && <ChevronRight size={14} className="text-white/20 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-white/5 flex items-center gap-4 text-[11px] text-white/20">
              <span className="flex items-center gap-1"><kbd className="border border-white/10 rounded px-1 py-0.5 text-[9px]">↑↓</kbd> navigate</span>
              <span className="flex items-center gap-1"><kbd className="border border-white/10 rounded px-1 py-0.5 text-[9px]">↵</kbd> open</span>
              <span className="ml-auto flex items-center gap-1"><Command size={10} /> K to toggle</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── About Page ───────────────────────────────────────────────────────────────
function AboutPage() {
  return (
    <motion.div className="max-w-4xl mx-auto px-6 py-20"
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <div className="mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-6 text-xs font-medium"
          style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#818cf8" }}>
          <Shield size={12} /> Zero-Data Architecture
        </div>
        <h1 className="text-5xl font-bold text-white mb-6 leading-tight" style={{ fontFamily: "'Syne', sans-serif", letterSpacing: "-0.03em" }}>
          Built by engineers.<br />
          <span style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Trusted by none — because trust requires no data.</span>
        </h1>
        <p className="text-white/50 text-lg leading-relaxed max-w-2xl">
          Aegis Nova was born from a simple belief: your code, your data, and your ideas should never leave your machine. Every computation, every analysis, every transformation happens entirely within your browser's secure sandbox.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
        {[
          { title: "The Vault Philosophy", icon: <Shield size={20} className="text-red-400" />, body: "Security tools that phone home are oxymoronic. The Vault performs full AST-based static analysis using pure browser-native JavaScript engines. Your source code is parsed, scanned, and discarded — all in a sandboxed Worker thread, never transmitted anywhere." },
          { title: "Distributed by Design", icon: <Database size={20} className="text-blue-400" />, body: "Data Titan leverages the Web Streams API and SharedArrayBuffer to process gigabyte-scale files client-side. We push the browser to its absolute limits so your data never has to cross a network boundary to be processed at enterprise scale." },
          { title: "Intelligent, Not Invasive", icon: <Zap size={20} className="text-yellow-400" />, body: "Opti-Neural uses WebAssembly-compiled FFmpeg and perceptual hash algorithms to achieve compression ratios that rival cloud ML pipelines — with zero model training on your images and zero telemetry sent outward." },
          { title: "Visual Clarity", icon: <GitBranch size={20} className="text-green-400" />, body: "Logic Flow bridges the gap between code and understanding. By parsing function signatures and call graphs directly in the browser, we generate Mermaid-powered diagrams that evolve in real-time as you type — no backend, no latency." },
        ].map((card) => (
          <div key={card.title} className="p-6 rounded-2xl"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="flex items-center gap-3 mb-3">{card.icon}<h3 className="text-white font-semibold">{card.title}</h3></div>
            <p className="text-white/40 text-sm leading-relaxed">{card.body}</p>
          </div>
        ))}
      </div>

      <div className="p-8 rounded-3xl text-center"
        style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.05))", border: "1px solid rgba(99,102,241,0.15)" }}>
        <h2 className="text-2xl font-bold text-white mb-3" style={{ fontFamily: "'Syne', sans-serif" }}>The Zero-Data Promise</h2>
        <p className="text-white/40 text-sm max-w-xl mx-auto leading-relaxed">
          No accounts required. No analytics. No cookies beyond your local preferences. No CDN logging your IPs. This is not a legal disclaimer — it is a technical guarantee enforced by architecture, not policy.
        </p>
      </div>
    </motion.div>
  );
}

// ─── Privacy Page ─────────────────────────────────────────────────────────────
function PrivacyPage() {
  const sections = [
    { title: "1. Data Collection", body: "Aegis Nova collects zero personal data. The application is a fully static, client-side web application hosted on GitHub Pages. No server receives any request containing your data, files, or code at any point during usage." },
    { title: "2. Local Processing Architecture", body: "All computation occurs within your browser's JavaScript runtime and WebAssembly sandbox. File analysis, code scanning, image compression, and data transformation are performed using Web Workers isolated from the main thread. No data is transmitted to any external server, API endpoint, or third-party service." },
    { title: "3. Browser Storage", body: "Aegis Nova does not write to localStorage, sessionStorage, IndexedDB, or any other persistent browser storage mechanism unless you explicitly trigger an export or save action. Any temporary in-memory state is cleared when you close or refresh the tab." },
    { title: "4. Third-Party Services", body: "The optional Firebase Authentication module, if enabled, is governed by Google's Firebase Privacy Policy. Authentication tokens are handled by the Firebase SDK and are not accessible to Aegis Nova's application logic beyond confirming a valid session. If you do not use Firebase Auth, no data is sent to Google." },
    { title: "5. Analytics & Telemetry", body: "There are no analytics scripts, tracking pixels, session recorders, heatmap tools, or telemetry SDKs embedded in this application. GitHub Pages may log standard web server access logs (IP address, request time, user-agent) as per GitHub's own Privacy Statement, which is outside our control." },
    { title: "6. Cookies", body: "Aegis Nova does not set or read any cookies. Your theme preference and UI state may be stored in localStorage purely for convenience if you opt in via the settings panel." },
    { title: "7. Data Retention", body: "Because no data is ever transmitted to us, there is no data to retain, delete, or export. Your rights under GDPR, CCPA, and similar frameworks are satisfied by the simple fact that we are technically incapable of holding your personal information." },
    { title: "8. Contact Regarding This Policy", body: "If you have questions about this Privacy Policy, please contact us at Gxplcp@gmail.com. We will respond within 72 hours." },
    { title: "9. Changes to This Policy", body: "Any changes to this Privacy Policy will be reflected in the version timestamp below and announced via the GitHub repository's release notes. Continued use of Aegis Nova after such changes constitutes acceptance of the updated policy." },
  ];

  return (
    <motion.div className="max-w-3xl mx-auto px-6 py-20"
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <div className="mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-6 text-xs font-medium"
          style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)", color: "#fb923c" }}>
          <Lock size={12} /> Legal Grade
        </div>
        <h1 className="text-4xl font-bold text-white mb-4" style={{ fontFamily: "'Syne', sans-serif" }}>Privacy Policy</h1>
        <p className="text-white/30 text-sm">Effective Date: January 1, 2025 · Version 1.0.0</p>
        <p className="text-white/40 mt-4 leading-relaxed">
          This Privacy Policy describes how Aegis Nova ("we," "us," or "our") handles information in connection with your use of our browser-based engineering suite.
        </p>
      </div>
      <div className="space-y-8">
        {sections.map((s) => (
          <div key={s.title} className="pb-8 border-b border-white/5 last:border-0">
            <h2 className="text-white font-semibold mb-3">{s.title}</h2>
            <p className="text-white/40 text-sm leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-12 p-6 rounded-2xl"
        style={{ background: "rgba(249,115,22,0.05)", border: "1px solid rgba(249,115,22,0.1)" }}>
        <p className="text-orange-400/70 text-xs text-center">
          This policy is legally binding and reflects the technical architecture of Aegis Nova. For enterprise compliance inquiries, contact Gxplcp@gmail.com.
        </p>
      </div>
    </motion.div>
  );
}

// ─── Login Page ───────────────────────────────────────────────────────────────
function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <motion.div className="min-h-screen flex items-center justify-center px-4"
      initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 0 40px rgba(99,102,241,0.4)" }}>
            <Layers size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "'Syne', sans-serif" }}>Aegis Nova</h1>
          <p className="text-white/30 text-sm mt-1">Elite Engineering Suite</p>
        </div>

        {/* Card */}
        <div className="rounded-3xl p-8" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(20px)" }}>
          {/* Mode Toggle */}
          <div className="flex rounded-xl p-1 mb-8" style={{ background: "rgba(0,0,0,0.3)" }}>
            {(["login", "register"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize"
                style={{ background: mode === m ? "rgba(99,102,241,0.3)" : "transparent", color: mode === m ? "#a5b4fc" : "rgba(255,255,255,0.3)" }}>
                {m === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          {/* Google Button */}
          <button className="w-full flex items-center justify-center gap-3 py-3 rounded-xl mb-6 text-sm font-medium text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 2.9l5.7-5.7C34.5 6.5 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.1 8 2.9l5.7-5.7C34.5 6.5 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.4 26.7 36 24 36c-5.2 0-9.7-3.3-11.3-8H6.5C9.8 36.7 16.3 44 24 44z" /><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.2 5.2C37 36.7 44 31 44 24c0-1.3-.1-2.6-.4-3.9z" /></svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.05)" }} />
            <span className="text-white/20 text-xs">or</span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.05)" }} />
          </div>

          {/* Email / Password */}
          <div className="space-y-3">
            {[
              { label: "Email", value: email, set: setEmail, type: "email", ph: "you@company.com" },
              { label: "Password", value: password, set: setPassword, type: "password", ph: "••••••••••" },
            ].map((f) => (
              <div key={f.label}>
                <label className="block text-xs text-white/30 mb-1.5 font-medium">{f.label}</label>
                <input type={f.type} value={f.value} onChange={e => f.set(e.target.value)}
                  placeholder={f.ph}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/15 outline-none transition-all"
                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)", fontFamily: "inherit" }} />
              </div>
            ))}
          </div>

          <button className="w-full mt-6 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 8px 32px rgba(99,102,241,0.3)" }}>
            {mode === "login" ? "Sign In" : "Create Account"}
          </button>

          <p className="text-center text-white/20 text-xs mt-5">
            Firebase Auth · Enterprise-grade security · Zero plaintext storage
          </p>
        </div>

        <p className="text-center text-white/15 text-xs mt-6">
          By signing in you agree to our{" "}
          <span className="text-indigo-400/60 cursor-pointer hover:text-indigo-400 transition-colors">Privacy Policy</span>
        </p>
      </div>
    </motion.div>
  );
}

// ─── App Shell ────────────────────────────────────────────────────────────────
export default function App() {
  const [route, setRoute] = useState<Route>("home");
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  // Cmd+K / Ctrl+K to open spotlight
  const handleGlobalKey = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSpotlightOpen(p => !p); }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, [handleGlobalKey]);

  const navItems: { label: string; route: Route; icon: React.ReactNode }[] = [
    { label: "Suite", route: "home", icon: <Home size={14} /> },
    { label: "About", route: "about", icon: <Info size={14} /> },
    { label: "Contact", route: "contact", icon: <Mail size={14} /> },
    { label: "Privacy", route: "privacy", icon: <Lock size={14} /> },
  ];

  return (
    <div className="min-h-screen" style={{ background: "#050505", fontFamily: "'DM Sans', sans-serif" }}>
      {/* Font imports */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
        * { box-sizing: border-box; }
      `}</style>

      {/* Subtle grid background */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: "linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px)",
        backgroundSize: "60px 60px"
      }} />

      {/* Ambient glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(99,102,241,0.06) 0%, transparent 70%)" }} />

      {/* ── Navbar ── */}
      <header className="fixed top-0 left-0 right-0 z-40" style={{ background: "rgba(5,5,5,0.85)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <button onClick={() => setRoute("home")} className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
              <Layers size={14} className="text-white" />
            </div>
            <span className="text-white font-bold text-sm tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>AEGIS NOVA</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8" }}>BETA</span>
          </button>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(n => (
              <button key={n.route} onClick={() => setRoute(n.route)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ color: route === n.route ? "#a5b4fc" : "rgba(255,255,255,0.3)", background: route === n.route ? "rgba(99,102,241,0.1)" : "transparent" }}>
                {n.icon}{n.label}
              </button>
            ))}
          </nav>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            {/* Spotlight trigger */}
            <button onClick={() => setSpotlightOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.25)" }}>
              <Search size={12} />
              <span className="hidden sm:block">Search…</span>
              <kbd className="hidden sm:block text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>⌘K</kbd>
            </button>

            <button className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/5"
              style={{ color: "rgba(255,255,255,0.3)" }}>
              <Bell size={14} />
            </button>
            <button onClick={() => setRoute("login")}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/5"
              style={{ color: "rgba(255,255,255,0.3)" }}>
              <User size={14} />
            </button>
            {/* Mobile menu */}
            <button className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-all"
              style={{ color: "rgba(255,255,255,0.3)" }}
              onClick={() => setNavOpen(p => !p)}>
              <Menu size={14} />
            </button>
          </div>
        </div>

        {/* Mobile Nav Dropdown */}
        <AnimatePresence>
          {navOpen && (
            <motion.div className="md:hidden px-4 pb-4"
              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              {navItems.map(n => (
                <button key={n.route} onClick={() => { setRoute(n.route); setNavOpen(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm text-left transition-all"
                  style={{ color: route === n.route ? "#a5b4fc" : "rgba(255,255,255,0.4)", background: route === n.route ? "rgba(99,102,241,0.08)" : "transparent" }}>
                  {n.icon}{n.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Page Content ── */}
      <main className="pt-14">
        <AnimatePresence mode="wait">
          {route === "home" && (
            <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              {/* Hero */}
              <div className="text-center pt-24 pb-16 px-6">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-6 text-xs font-medium"
                    style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#818cf8" }}>
                    <Moon size={10} /> 100% Serverless · Zero-Data · Browser-Native
                  </div>
                  <h1 className="text-6xl md:text-7xl font-extrabold text-white leading-tight mb-6"
                    style={{ fontFamily: "'Syne', sans-serif", letterSpacing: "-0.04em" }}>
                    Engineering tools<br />
                    <span style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 40%, #ec4899 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>without compromise.</span>
                  </h1>
                  <p className="text-white/40 text-lg max-w-xl mx-auto mb-10">
                    Four elite-grade tools built for engineers at the frontier. Your data never leaves this tab.
                  </p>
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    <button onClick={() => setSpotlightOpen(true)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105"
                      style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 8px 32px rgba(99,102,241,0.3)" }}>
                      <Command size={14} /> Open Command Palette
                    </button>
                    <button onClick={() => setRoute("about")}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:scale-105"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}>
                      Learn More <ChevronRight size={14} />
                    </button>
                  </div>
                </motion.div>
              </div>
              {/* Tools */}
              <ToolGrid />
            </motion.div>
          )}
          {route === "about" && <AboutPage key="about" />}
          {route === "contact" && <ContactPage key="contact" />}
          {route === "privacy" && <PrivacyPage key="privacy" />}
          {route === "login" && <LoginPage key="login" />}
        </AnimatePresence>
      </main>

      {/* ── Footer ── */}
      {route === "home" && (
        <footer className="border-t border-white/4 mt-24 py-10 px-6">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
                <Layers size={10} className="text-white" />
              </div>
              <span className="text-white/20 text-sm" style={{ fontFamily: "'Syne', sans-serif" }}>AEGIS NOVA</span>
            </div>
            <p className="text-white/15 text-xs text-center">© 2025 Aegis Nova. All processing happens on your device. No servers. No secrets.</p>
            <div className="flex items-center gap-4">
              {[{ l: "Privacy", r: "privacy" as Route }, { l: "Contact", r: "contact" as Route }].map(({ l, r }) => (
                <button key={l} onClick={() => setRoute(r)} className="text-white/20 hover:text-white/50 text-xs transition-colors">{l}</button>
              ))}
            </div>
          </div>
        </footer>
      )}

      {/* Spotlight */}
      <Spotlight open={spotlightOpen} onClose={() => setSpotlightOpen(false)} navigate={setRoute} />
    </div>
  );
}
