import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Send, CheckCircle, AlertCircle, User, MessageSquare, Tag, Loader2, Github, Twitter, Linkedin, Shield, Clock, Globe } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface FormState {
  name:     string;
  email:    string;
  subject:  string;
  category: string;
  message:  string;
}

type SubmitStatus = "idle" | "sending" | "success" | "error";

const CATEGORIES = [
  { value: "bug",       label: "🐛 Bug Report" },
  { value: "feature",   label: "✨ Feature Request" },
  { value: "security",  label: "🔒 Security Disclosure" },
  { value: "enterprise",label: "🏢 Enterprise Inquiry" },
  { value: "general",   label: "💬 General Question" },
  { value: "privacy",   label: "🛡️ Privacy / Legal" },
];

// ─── Contact Channels ─────────────────────────────────────────────────────────
const CONTACT_INFO = [
  {
    icon: <Mail size={16} className="text-indigo-400" />,
    label: "Email",
    value: "Gxplcp@gmail.com",
    href: "mailto:Gxplcp@gmail.com",
    bg: "rgba(99,102,241,0.08)",
    border: "rgba(99,102,241,0.15)",
  },
  {
    icon: <Clock size={16} className="text-blue-400" />,
    label: "Response Time",
    value: "Within 72 hours",
    href: null,
    bg: "rgba(96,165,250,0.08)",
    border: "rgba(96,165,250,0.15)",
  },
  {
    icon: <Globe size={16} className="text-green-400" />,
    label: "Coverage",
    value: "Worldwide · All time zones",
    href: null,
    bg: "rgba(74,222,128,0.08)",
    border: "rgba(74,222,128,0.15)",
  },
  {
    icon: <Shield size={16} className="text-orange-400" />,
    label: "Security",
    value: "Responsible disclosure welcome",
    href: null,
    bg: "rgba(249,115,22,0.08)",
    border: "rgba(249,115,22,0.15)",
  },
];

// ─── Input Component ──────────────────────────────────────────────────────────
function Field({ label, icon, error, children }: { label: string; icon: React.ReactNode; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-white/25">{icon}</span>
        <label className="text-xs font-medium text-white/40 uppercase tracking-wider">{label}</label>
      </div>
      {children}
      <AnimatePresence>
        {error && (
          <motion.p className="text-xs text-red-400/80 flex items-center gap-1"
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <AlertCircle size={10} /> {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

const inputStyle = {
  background:   "rgba(0,0,0,0.35)",
  border:       "1px solid rgba(255,255,255,0.06)",
  borderRadius: 12,
  color:        "rgba(255,255,255,0.8)",
  outline:      "none",
  fontFamily:   "'DM Sans', sans-serif",
  transition:   "border-color 0.2s",
};

// ─── Mailto Fallback Builder ──────────────────────────────────────────────────
function buildMailtoUrl(form: FormState): string {
  const subject = encodeURIComponent(`[Aegis Nova] [${form.category.toUpperCase()}] ${form.subject}`);
  const body = encodeURIComponent(
    `Name: ${form.name}\nEmail: ${form.email}\nCategory: ${form.category}\n\n${form.message}`
  );
  return `mailto:Gxplcp@gmail.com?subject=${subject}&body=${body}`;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ContactPage() {
  const [form, setForm] = useState<FormState>({
    name:     "",
    email:    "",
    subject:  "",
    category: "general",
    message:  "",
  });
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const formRef = useRef<HTMLFormElement>(null);

  const update = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(p => ({ ...p, [field]: e.target.value }));
    if (errors[field]) setErrors(p => ({ ...p, [field]: "" }));
  };

  const validate = (): boolean => {
    const errs: Partial<FormState> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.email.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Enter a valid email address";
    if (!form.subject.trim()) errs.subject = "Subject is required";
    if (!form.message.trim() || form.message.trim().length < 20) errs.message = "Message must be at least 20 characters";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setStatus("sending");

    /**
     * IMPORTANT: Aegis Nova is 100% serverless / static.
     * There is no backend to receive form submissions.
     *
     * Option A (current): mailto: link — opens the user's email client.
     * Option B: Integrate Formspree (https://formspree.io) — add your endpoint below.
     * Option C: Integrate EmailJS — pure client-side email delivery.
     *
     * To use Formspree, replace the mailto logic with:
     *   const res = await fetch("https://formspree.io/f/YOUR_FORM_ID", {
     *     method: "POST",
     *     headers: { "Content-Type": "application/json", Accept: "application/json" },
     *     body: JSON.stringify(form),
     *   });
     *   if (res.ok) setStatus("success"); else setStatus("error");
     */

    // Simulate a brief send animation, then open mailto
    await new Promise(r => setTimeout(r, 1200));

    try {
      window.location.href = buildMailtoUrl(form);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  const reset = () => {
    setForm({ name: "", email: "", subject: "", category: "general", message: "" });
    setErrors({});
    setStatus("idle");
  };

  return (
    <motion.div className="max-w-6xl mx-auto px-6 py-20"
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>

      {/* Header */}
      <div className="mb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-6 text-xs font-medium"
          style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#818cf8" }}>
          <Mail size={12} /> Get in Touch
        </div>
        <h1 className="text-5xl font-extrabold text-white mb-4" style={{ fontFamily: "'Syne', sans-serif", letterSpacing: "-0.03em" }}>
          Talk to us.
        </h1>
        <p className="text-white/40 max-w-lg mx-auto leading-relaxed">
          Questions, feedback, enterprise inquiries, or security disclosures — we respond to everything sent to{" "}
          <a href="mailto:Gxplcp@gmail.com" className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
            Gxplcp@gmail.com
          </a>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

        {/* ── Left Column: Info ── */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-white/60 text-sm font-semibold uppercase tracking-widest mb-6">Contact Channels</h2>

          {CONTACT_INFO.map((info) => (
            <motion.div key={info.label}
              className="p-4 rounded-2xl flex items-start gap-3"
              style={{ background: info.bg, border: `1px solid ${info.border}` }}
              whileHover={{ scale: 1.01 }} transition={{ type: "spring", stiffness: 400 }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(0,0,0,0.3)" }}>
                {info.icon}
              </div>
              <div>
                <div className="text-white/30 text-[10px] uppercase font-semibold tracking-wider mb-0.5">{info.label}</div>
                {info.href
                  ? <a href={info.href} className="text-white/70 text-sm hover:text-white transition-colors">{info.value}</a>
                  : <div className="text-white/70 text-sm">{info.value}</div>
                }
              </div>
            </motion.div>
          ))}

          {/* Social links */}
          <div className="mt-8">
            <h3 className="text-white/25 text-xs uppercase font-semibold tracking-widest mb-4">Follow the Project</h3>
            <div className="flex gap-3">
              {[
                { icon: <Github size={16} />, href: "https://github.com", label: "GitHub" },
                { icon: <Twitter size={16} />, href: "https://twitter.com", label: "Twitter" },
                { icon: <Linkedin size={16} />, href: "https://linkedin.com", label: "LinkedIn" },
              ].map(s => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                  title={s.label}
                  className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-110"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)" }}>
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Security disclosure callout */}
          <div className="mt-6 p-5 rounded-2xl"
            style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.12)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Shield size={14} className="text-orange-400" />
              <span className="text-orange-400 text-xs font-semibold">Security Researchers</span>
            </div>
            <p className="text-white/35 text-xs leading-relaxed">
              We welcome responsible security disclosures. Select "Security Disclosure" as the category — we will acknowledge within 24 hours and coordinate a fix and CVE together.
            </p>
          </div>
        </div>

        {/* ── Right Column: Form ── */}
        <div className="lg:col-span-3">
          <div className="rounded-3xl p-8 relative overflow-hidden"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", backdropFilter: "blur(20px)" }}>
            {/* Top accent */}
            <div className="absolute top-0 left-0 right-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.5), transparent)" }} />

            <AnimatePresence mode="wait">
              {/* ── Success State ── */}
              {status === "success" && (
                <motion.div key="success" className="flex flex-col items-center justify-center py-16 text-center"
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
                    style={{ background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.3)" }}>
                    <CheckCircle size={32} className="text-green-400" />
                  </div>
                  <h3 className="text-white text-xl font-bold mb-3" style={{ fontFamily: "'Syne', sans-serif" }}>
                    Message Ready to Send!
                  </h3>
                  <p className="text-white/40 text-sm max-w-sm leading-relaxed mb-2">
                    Your default email client has been opened with the message pre-filled. Hit send to reach us at{" "}
                    <span className="text-indigo-400">Gxplcp@gmail.com</span>.
                  </p>
                  <p className="text-white/20 text-xs mb-8">
                    No email client? Copy the address and paste it directly.
                  </p>
                  <div className="flex gap-3">
                    <a href="mailto:Gxplcp@gmail.com"
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105"
                      style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
                      <Mail size={14} /> Open Email
                    </a>
                    <button onClick={reset}
                      className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:scale-105"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
                      Send Another
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── Error State ── */}
              {status === "error" && (
                <motion.div key="error" className="flex flex-col items-center justify-center py-16 text-center"
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
                    style={{ background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)" }}>
                    <AlertCircle size={32} className="text-red-400" />
                  </div>
                  <h3 className="text-white text-xl font-bold mb-3">Couldn't Open Email Client</h3>
                  <p className="text-white/40 text-sm max-w-sm mb-8">
                    Please email us directly at{" "}
                    <a href="mailto:Gxplcp@gmail.com" className="text-indigo-400 hover:text-indigo-300">Gxplcp@gmail.com</a>
                  </p>
                  <button onClick={reset} className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:scale-105"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
                    Try Again
                  </button>
                </motion.div>
              )}

              {/* ── Form ── */}
              {(status === "idle" || status === "sending") && (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <h2 className="text-white font-bold text-xl mb-8" style={{ fontFamily: "'Syne', sans-serif" }}>
                    Send a Message
                  </h2>

                  {/* NOTE: Using div instead of form to avoid default HTML form behavior on static pages */}
                  <div ref={formRef as unknown as React.RefObject<HTMLDivElement>} className="space-y-5">
                    {/* Name + Email row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Name" icon={<User size={12} />} error={errors.name}>
                        <input type="text" value={form.name} onChange={update("name")}
                          placeholder="Alex Chen"
                          className="w-full px-4 py-3 text-sm"
                          style={{ ...inputStyle, borderColor: errors.name ? "rgba(248,113,113,0.4)" : "rgba(255,255,255,0.06)" }} />
                      </Field>
                      <Field label="Email" icon={<Mail size={12} />} error={errors.email}>
                        <input type="email" value={form.email} onChange={update("email")}
                          placeholder="alex@company.com"
                          className="w-full px-4 py-3 text-sm"
                          style={{ ...inputStyle, borderColor: errors.email ? "rgba(248,113,113,0.4)" : "rgba(255,255,255,0.06)" }} />
                      </Field>
                    </div>

                    {/* Category */}
                    <Field label="Category" icon={<Tag size={12} />}>
                      <select value={form.category} onChange={update("category")}
                        className="w-full px-4 py-3 text-sm cursor-pointer"
                        style={{ ...inputStyle, borderColor: "rgba(255,255,255,0.06)" }}>
                        {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </Field>

                    {/* Subject */}
                    <Field label="Subject" icon={<MessageSquare size={12} />} error={errors.subject}>
                      <input type="text" value={form.subject} onChange={update("subject")}
                        placeholder="Brief summary of your inquiry…"
                        className="w-full px-4 py-3 text-sm"
                        style={{ ...inputStyle, borderColor: errors.subject ? "rgba(248,113,113,0.4)" : "rgba(255,255,255,0.06)" }} />
                    </Field>

                    {/* Message */}
                    <Field label="Message" icon={<MessageSquare size={12} />} error={errors.message}>
                      <textarea value={form.message} onChange={update("message")}
                        placeholder="Describe your request in detail. For bugs, include steps to reproduce. For features, describe the use case."
                        rows={6}
                        className="w-full px-4 py-3 text-sm resize-none"
                        style={{ ...inputStyle, borderColor: errors.message ? "rgba(248,113,113,0.4)" : "rgba(255,255,255,0.06)", lineHeight: 1.6 }} />
                      <div className="text-right text-[10px] mt-1" style={{ color: form.message.length < 20 ? "rgba(248,113,113,0.5)" : "rgba(255,255,255,0.2)" }}>
                        {form.message.length} chars {form.message.length < 20 && `(${20 - form.message.length} more needed)`}
                      </div>
                    </Field>

                    {/* Privacy note */}
                    <div className="flex items-start gap-2 p-3 rounded-xl"
                      style={{ background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.08)" }}>
                      <Shield size={12} className="text-indigo-400/60 flex-shrink-0 mt-0.5" />
                      <p className="text-white/25 text-[11px] leading-relaxed">
                        This form uses your local email client — no data is submitted to any server. Your message travels directly from your device to our inbox.
                      </p>
                    </div>

                    {/* Submit */}
                    <button onClick={handleSubmit} disabled={status === "sending"}
                      className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed"
                      style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #7c3aed 100%)", boxShadow: "0 8px 32px rgba(99,102,241,0.25)", fontFamily: "'DM Sans', sans-serif" }}>
                      {status === "sending"
                        ? <><Loader2 size={16} className="animate-spin" /> Preparing Message…</>
                        : <><Send size={16} /> Send Message to Aegis Nova</>
                      }
                    </button>

                    <p className="text-center text-white/15 text-[11px]">
                      Or email directly: <a href="mailto:Gxplcp@gmail.com" className="text-indigo-400/50 hover:text-indigo-400 transition-colors">Gxplcp@gmail.com</a>
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* FAQ strip */}
      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { q: "Do you offer enterprise licenses?", a: "Yes — we offer custom SLAs, on-premise deployments, and white-label options. Use the Enterprise Inquiry category." },
          { q: "Is there a public API?", a: "A documented REST + WebSocket API is on our roadmap. Sign up via email to be notified on launch." },
          { q: "Can I contribute to Aegis Nova?", a: "Absolutely. The repository is open source. Check the Contributing guide and open a PR or discussion on GitHub." },
        ].map(({ q, a }) => (
          <div key={q} className="p-5 rounded-2xl" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <h4 className="text-white/70 text-sm font-semibold mb-2">{q}</h4>
            <p className="text-white/30 text-xs leading-relaxed">{a}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
