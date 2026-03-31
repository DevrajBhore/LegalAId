/**
 * icons.jsx — Custom SVG icon set for LegalAId
 * Stroke-based, inheriting currentColor. Legal-platform appropriate.
 */

// ── Brand mark — certified document with seal ─────────────────────────────────
export const BrandMark = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
    <path d="M8 4h10l6 6v18H8V4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M18 4v6h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="16" cy="19" r="5" stroke="currentColor" strokeWidth="1.5"/>
    <polyline points="13.5,19 15,20.5 18.5,17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const Ic = (children, vb = "0 0 24 24", def = 18) =>
  ({ size: s = def, className = "" } = {}) => (
    <svg width={s} height={s} viewBox={vb} fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );

export const ArrowLeft    = Ic(<><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></>);
export const ArrowRight   = Ic(<><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>);
export const ChevronRight = Ic(<polyline points="9 18 15 12 9 6"/>);
export const Check        = Ic(<polyline points="20 6 9 17 4 12"/>, "0 0 24 24", 14);
export const X            = Ic(<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>, "0 0 24 24", 14);
export const Menu         = Ic(<><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>, "0 0 24 24", 20);

export const FileText  = Ic(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>);
export const File      = Ic(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>);
export const Download  = Ic(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>, "0 0 24 24", 16);
export const Scroll    = Ic(<><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h8M8 17h5"/></>);

export const User      = Ic(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>);
export const LogOut    = Ic(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>, "0 0 24 24", 16);
export const Mail      = Ic(<><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></>);
export const Lock      = Ic(<><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>, "0 0 24 24", 16);
export const KeyRound  = Ic(<><circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6"/><path d="M15.5 7.5l3 3L22 7l-3-3"/></>);
export const Eye       = Ic(<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>, "0 0 24 24", 16);
export const EyeOff    = Ic(<><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>, "0 0 24 24", 16);
export const Phone     = Ic(<><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></>);

export const Shield      = Ic(<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>, "0 0 24 24", 16);
export const ShieldCheck = Ic(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></>);
export const AlertTriangle = Ic(<><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>, "0 0 24 24", 16);
export const AlertCircle   = Ic(<><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>, "0 0 24 24", 16);
export const Info          = Ic(<><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>, "0 0 24 24", 16);
export const CheckCircle   = Ic(<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>);
export const Loader        = Ic(<><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></>, "0 0 24 24", 16);
export const Zap           = Ic(<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>, "0 0 24 24", 16);

// Proper gavel for legal platform — replaces generic scales icon
export const Gavel = Ic(<><path d="m14.5 12.5-8 8a2.119 2.119 0 1 1-3-3l8-8"/><path d="m16 16 6-6"/><path d="m8 8 6-6"/><path d="m9 7 8 8"/><path d="m21 11-8-8"/></>);
export const Scales  = Ic(<><path d="M12 3v18"/><path d="M3 6h18"/><path d="M6 6l-3 6h6l-3-6z"/><path d="M18 6l-3 6h6l-3-6z"/><path d="M3 18h6"/><path d="M15 18h6"/></>);
export const Search  = Ic(<><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>);
export const Briefcase  = Ic(<><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></>);
export const Building2  = Ic(<><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></>);
export const Cpu        = Ic(<><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></>);
export const IndianRupee = Ic(<><path d="M6 3h12"/><path d="M6 8h12"/><path d="m6 13 8.5 8"/><path d="M6 13h3"/><path d="M9 13c6.667 0 6.667-10 0-10"/></>);
export const Globe       = Ic(<><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></>);
export const MessageSquare = Ic(<><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>);
export const Sparkles   = Ic(<><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></>);
export const Settings   = Ic(<><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></>);
export const ExternalLink = Ic(<><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></>, "0 0 24 24", 14);

// ── Legacy Icons object for backwards compatibility ───────────────────────────
export const Icons = {
  arrowLeft:     <ArrowLeft />,
  arrowRight:    <ArrowRight />,
  check:         <Check />,
  x:             <X />,
  menu:          <Menu />,
  fileText:      <FileText />,
  file:          <File />,
  download:      <Download />,
  user:          <User />,
  logOut:        <LogOut />,
  mail:          <Mail />,
  lock:          <Lock />,
  shield:        <Shield />,
  warning:       <AlertTriangle />,
  info:          <Info />,
  loader:        <Loader />,
  scale:         <Gavel />,           // proper gavel, not abstract scales
  briefcase:     <Briefcase />,
  building:      <Building2 />,       // realistic multi-storey building
  cpu:           <Cpu />,
  dollarSign:    <IndianRupee />,     // Indian Rupee symbol ₹
  externalLink:  <ExternalLink />,
  zap:           <Zap />,
  globe:         <Globe />,
  shieldCheck:   <ShieldCheck />,
  gavel:         <Gavel />,
  sparkles:      <Sparkles />,
  keyRound:      <KeyRound />,
  eye:           <Eye />,
  eyeOff:        <EyeOff />,
  phone:         <Phone />,
  checkCircle:   <CheckCircle />,
  messageSquare: <MessageSquare />,
  settings:      <Settings />,
  scroll:        <Scroll />,
  search:        <Search />,
};
