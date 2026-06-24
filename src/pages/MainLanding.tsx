import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { useHealthStatus } from '../hooks/useHealthStatus';
import {
    ShieldCheck,
    ScanLine,
    Activity,
    ArrowRight,
    PlayCircle,
} from 'lucide-react';

function SmartLink({ to, className, children }: {
    to: string; className?: string; children: React.ReactNode;
}) {
    if (to.startsWith('/')) return <Link to={to} className={className}>{children}</Link>Link>;
    return <a href={to} className={className}>{children}</a>a>;
}

const NAV_LINKS = [
  { label: 'Produkt',         to: '#produkt' },
  { label: 'Automatisierung', to: '/automations' },
  { label: 'Evidence',        to: '/evidence' },
  { label: 'AI Act',          to: '/ai-act' },
  { label: 'Sicherheit',      to: '#sicherheit' },
  { label: 'Preise',          to: '#preise' },
  ];

function InfoCard({
    label, value, suffix, status, delay = '0s', className = '',
}: {
    label: string; value?: string | number; suffix?: string;
    status?: 'compliant' | 'ready' | 'live'; delay?: string; className?: string;
}) {
    return (
          <div
                  className={`absolute p-4 rounded-xl border border-[#00e5cc]/25 backdrop-blur-xl ${className}`}
                  style={{
                            background: 'rgba(3,7,18,0.75)',
                            boxShadow: '0 0 28px rgba(0,229,204,0.10), inset 0 1px 0 rgba(0,229,204,0.14)',
                            animation: 'rs-float 4.5s ease-in-out infinite',
                            animationDelay: delay,
                  }}
                >
                <div className="text-[#00e5cc] text-[10px] font-semibold tracking-widest uppercase mb-2 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00e5cc] animate-pulse" />
                  {label}
                </div>div>
            {value !== undefined && (
                          <div>
                                    <span className="text-white text-3xl font-black">{value}</span>span>
                            {suffix && <span className="text-slate-400 text-sm ml-1">{suffix}</span>span>}
                          </div>div>
                )}
            {status === 'compliant' && <div className="text-[#00e5cc] font-bold text-sm">Compliant</div>div>}
            {status === 'ready'     && <div className="text-green-400 font-bold text-sm">READY</div>div>}
            {status === 'live'      && (
                          <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-[#00e5cc] animate-pulse" />
                                    <span className="text-[#00e5cc] font-semibold text-sm">Live</span>span>
                                    <svg viewBox="0 0 60 20" className="w-12 h-5" fill="none" stroke="#00e5cc" strokeWidth="1.5">
                                                <polyline points="0,10 10,10 14,3 18,17 22,10 28,10 32,5 36,15 40,10 60,10" />
                                    </svg>svg>
                          </div>div>
                )}
          </div>div>
        );
}

export function MainLanding() {
    const { status: healthStatus } = useHealthStatus();
    const [mounted,   setMounted]   = useState(false);
    const [evidence,  setEvidence]  = useState(0);
    const [riskScore, setRiskScore] = useState(0);
  
    useEffect(() => {
          setMounted(true);
          const ev = setInterval(() => setEvidence(p  => p < 1248 ? p + Math.ceil((1248 - p) / 10) : 1248), 40);
          const rs = setInterval(() => setRiskScore(p => p < 87   ? p + Math.ceil((87   - p) / 15) : 87),   40);
          return () => { clearInterval(ev); clearInterval(rs); };
    }, []);
  
    return (
          <>
                <SEOHead
                          title="RealSync Dynamics AI – Das KI-Betriebssystem für DSGVO & EU AI Act"
                          description="RealSync Dynamics AI überwacht Websites, KI-Systeme, Risiken und Nachweise kontinuierlich — DSGVO-konform, AI-Act-ready und auditierbar."
                        />
          
                <div
                          className="min-h-screen text-white overflow-x-hidden"
                          style={{ background: 'rgb(3,7,18)', fontFamily: "'Plus Jakarta Sans','Inter',system-ui,sans-serif" }}
                        >
                  {/* ── Sterne ── */}
                        <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
                          {Array.from({ length: 90 }).map((_, i) => (
                                      <div key={i} className="absolute rounded-full bg-white"
                                                      style={{
                                                                        width:  (Math.sin(i * 7.3) * 0.8 + 1.2) + 'px',
                                                                        height: (Math.sin(i * 7.3) * 0.8 + 1.2) + 'px',
                                                                        top:    (((i * 37.1) % 100)) + '%',
                                                                        left:   (((i * 61.8) % 100)) + '%',
                                                                        opacity: (Math.cos(i * 3.7) * 0.25 + 0.30),
                                                                        animation: `rs-twinkle ${(i % 3) + 2.5}s ease-in-out infinite`,
                                                                        animationDelay: ((i * 0.17) % 4) + 's',
                                                      }}
                                                    />
                                    ))}
                        </div>div>
                
                  {/* ── Erde + Orbital-Szene ── */}
                        <div className="fixed inset-0 -z-10 pointer-events-none">
                                  <div className="absolute inset-0 flex items-center justify-end" style={{ paddingRight: '2%' }}>
                                              <div className="relative" style={{ width: 760, height: 760 }}>
                                                {/* Outer ring */}
                                                            <div className="absolute inset-0 rounded-full border border-[#00e5cc]/08"
                                                                              style={{ transform: 'scale(1.28)' }} />
                                                {/* Inner ring */}
                                                            <div className="absolute inset-0 rounded-full border border-[#00e5cc]/05"
                                                                              style={{ transform: 'scale(1.10)' }} />
                                              
                                                {/* Earth globe */}
                                                            <div
                                                                              className={`absolute inset-0 rounded-full transition-all duration-[2000ms] ${
                                                                                                  mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
                                                                              }`}
                                                                              style={{
                                                                                                  background: `
                                                                                                                      radial-gradient(circle at 28% 36%, rgba(59,130,246,0.60) 0%, transparent 42%),
                                                                                                                                          radial-gradient(circle at 66% 62%, rgba(16,185,129,0.28) 0%, transparent 38%),
                                                                                                                                                              radial-gradient(circle at 50% 50%, #0c1e3a 0%, #071428 55%, #030d1e 100%)
                                                                                                                                                                                `,
                                                                                                  boxShadow: `
                                                                                                                      0 0 130px rgba(0,229,204,0.28),
                                                                                                                                          0 0  70px rgba(59,130,246,0.22),
                                                                                                                                                              inset -45px -45px 90px rgba(0,0,0,0.65)
                                                                                                                                                                                `,
                                                                              }}
                                                                            >
                                                              {/* Europa-Kontinent-Highlight */}
                                                                            <div className="absolute" style={{
                                                                                                top:'28%', left:'40%', width:'38%', height:'38%',
                                                                                                background:`
                                                                                                                    radial-gradient(ellipse at 38% 52%, rgba(34,197,94,0.38) 0%, transparent 58%),
                                                                                                                                        radial-gradient(ellipse at 64% 38%, rgba(22,163,74,0.22) 0%, transparent 48%)
                                                                                                                                                          `,
                                                                                                filter:'blur(3px)',
                                                                            }}/>
                                                              {/* Stadtlichter */}
                                                              {[
                                                                              {t:'36%',l:'48%'},{t:'40%',l:'53%'},{t:'44%',l:'46%'},
                                                                              {t:'33%',l:'56%'},{t:'48%',l:'60%'},{t:'53%',l:'50%'},
                                                                              {t:'38%',l:'62%'},{t:'58%',l:'44%'},{t:'30%',l:'44%'},
                                                                                              ].map((p,i)=>(
                                                                                                                  <div key={i} className="absolute rounded-full bg-amber-300/80"
                                                                                                                                        style={{ top:p.t, left:p.l, width:'3px', height:'3px',
                                                                                                                                                                      boxShadow:'0 0 5px rgba(251,191,36,0.9)',
                                                                                                                                                                      animation:`rs-twinkle ${1.5+i*0.4}s ease-in-out infinite`,
                                                                                                                                                                      animationDelay:`${i*0.2}s`,
                                                                                                                                                }}
                                                                                                                                      />
                                                                                                                ))}
                                                              {/* Atmosphären-Glanz */}
                                                                            <div className="absolute inset-0 rounded-full" style={{
                                                                                                background:'radial-gradient(circle at 27% 34%, rgba(255,255,255,0.07) 0%, transparent 48%)',
                                                                            }}/>
                                                            </div>div>
                                              
                                                {/* Umlaufende User-Nodes */}
                                                {[0,72,144,216,288].map((angle,i)=>(
                                          <div key={i} className="absolute"
                                                              style={{
                                                                                    width:28, height:28,
                                                                                    top:'50%', left:'50%',
                                                                                    marginTop:'-14px', marginLeft:'-14px',
                                                                                    animation:`rs-orbit-${i} ${18+i*2.5}s linear infinite`,
                                                                                    animationDelay:`${i * -3.5}s`,
                                                              }}
                                                            >
                                                            <div className="w-7 h-7 rounded-full border border-[#00e5cc]/35 flex items-center justify-center"
                                                                                  style={{ background:'rgba(0,229,204,0.07)', boxShadow:'0 0 10px rgba(0,229,204,0.18)' }}>
                                                                                <div className="w-3 h-3 rounded-full bg-slate-400/50"/>
                                                            </div>div>
                                          </div>div>
                                        ))}
                                              
                                                {/* Saturn-Planet oben */}
                                                            <div className="absolute" style={{
                                          top:'-8%', left:'30%',
                                          width:64, height:64,
                                          animation:'rs-float 12s ease-in-out infinite',
                        }}>
                                                                            <div className="w-16 h-10 rounded-full absolute top-3" style={{
                                            background:'radial-gradient(circle at 35% 40%, #d4a574, #8b6914)',
                                            boxShadow:'0 0 20px rgba(212,165,116,0.35)',
                        }}/>
                                                                            <div className="absolute" style={{
                                            top:'8px', left:'-12px', width:'88px', height:'28px',
                                            border:'2px solid rgba(212,165,116,0.4)',
                                            borderRadius:'50%',
                                            transform:'rotateX(70deg)',
                        }}/>
                                                            </div>div>
                                              
                                                {/* Kleiner Planet rechts oben */}
                                                            <div className="absolute" style={{
                                          top:'8%', right:'-5%', width:28, height:28,
                                          animation:'rs-float 8s ease-in-out infinite 1s',
                        }}>
                                                                            <div className="w-7 h-7 rounded-full" style={{
                                            background:'radial-gradient(circle at 35% 35%, #6b7280, #374151)',
                                            boxShadow:'0 0 12px rgba(107,114,128,0.4)',
                        }}/>
                                                            </div>div>
                                              
                                                {/* Mond unten rechts */}
                                                            <div className="absolute" style={{
                                          bottom:'5%', right:'-8%', width:44, height:44,
                                          animation:'rs-float 10s ease-in-out infinite 2s',
                        }}>
                                                                            <div className="w-11 h-11 rounded-full" style={{
                                            background:'radial-gradient(circle at 38% 35%, #9ca3af, #4b5563)',
                                            boxShadow:'0 0 16px rgba(156,163,175,0.3)',
                        }}/>
                                                            </div>div>
                                              </div>div>
                                  </div>div>
                        
                          {/* Links-Overlay: Text lesbar halten */}
                                  <div className="absolute inset-0" style={{
                                      background:`
                                                    linear-gradient(90deg, rgb(3,7,18) 32%, rgba(3,7,18,0.75) 52%, rgba(3,7,18,0.15) 72%, transparent 100%),
                                                                  linear-gradient(180deg, rgba(3,7,18,0.55) 0%, transparent 12%, transparent 88%, rgba(3,7,18,0.75) 100%)
                                                                              `,
                        }}/>
                        </div>div>
                
                  {/* ════════════════ NAVBAR ════════════════ */}
                        <nav className="fixed top-0 left-0 right-0 z-50" style={{
                                    background:'rgba(3,7,18,0.65)',
                                    backdropFilter:'blur(18px)',
                                    borderBottom:'1px solid rgba(0,229,204,0.09)',
                        }}>
                                  <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                                              <SmartLink to="/" className="flex items-center gap-2.5">
                                                            <svg viewBox="0 0 24 24" fill="none" stroke="#00e5cc" strokeWidth="1.5"
                                                                              className="w-8 h-8 flex-shrink-0"
                                                                              style={{ filter:'drop-shadow(0 0 7px rgba(0,229,204,0.65))' }}>
                                                                            <line x1="12" y1="2"  x2="12" y2="22"/>
                                                                            <line x1="2"  y1="12" x2="22" y2="12"/>
                                                                            <line x1="5"  y1="5"  x2="19" y2="19"/>
                                                                            <line x1="19" y1="5"  x2="5"  y2="19"/>
                                                              {[0,45,90,135,180,225,270,315].map((a,i)=>(
                                                                                                  <circle key={i}
                                                                                                                        cx={12+8*Math.cos(a*Math.PI/180)}
                                                                                                                        cy={12+8*Math.sin(a*Math.PI/180)}
                                                                                                                        r="1.4" fill="#00e5cc"/>
                                                                                                ))}
                                                            </svg>svg>
                                                            <span className="text-base font-bold tracking-tight">
                                                                            <span className="text-white">RealSync</span>span>
                                                                            <span className="text-slate-400 font-normal ml-1">Dynamics.AI</span>span>
                                                            </span>span>
                                              </SmartLink>SmartLink>
                                  
                                              <div className="hidden md:flex items-center gap-7">
                                                {NAV_LINKS.map(l=>(
                                          <SmartLink key={l.label} to={l.to}
                                                              className="text-slate-300 hover:text-[#00e5cc] text-sm font-medium transition-colors duration-200">
                                            {l.label}
                                          </SmartLink>SmartLink>
                                        ))}
                                                            <SmartLink to="/login"
                                                                              className="text-slate-300 hover:text-[#00e5cc] text-sm font-medium transition-colors duration-200">
                                                                            Login
                                                            </SmartLink>SmartLink>
                                              </div>div>
                                  
                                              <SmartLink to="/login"
                                                              className="hidden md:inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm text-black transition-all duration-200 hover:scale-105 hover:brightness-110"
                                                              style={{ background:'#00e5cc', boxShadow:'0 0 22px rgba(0,229,204,0.38)' }}>
                                                            Kostenlos starten <ArrowRight size={14}/>
                                              </SmartLink>SmartLink>
                                  </div>div>
                        </nav>nav>
                
                  {/* ════════════════ HERO ════════════════ */}
                        <section className="relative min-h-screen flex items-center pt-16">
                                  <div className="max-w-7xl mx-auto w-full px-6 grid md:grid-cols-2 gap-8 py-24">
                                  
                                    {/* Left: Text-Seite */}
                                              <div className="flex flex-col justify-center space-y-7 z-10">
                                              
                                                {/* Badge */}
                                                            <div className={`inline-flex items-center gap-2 w-fit px-4 py-2 rounded-full border border-[#00e5cc]/30
                                                                            text-[#00e5cc] text-[11px] font-bold tracking-[0.18em] uppercase
                                                                                            transition-all duration-1000 ${mounted?'opacity-100 translate-y-0':'opacity-0 translate-y-3'}`}
                                                                              style={{ background:'rgba(0,229,204,0.07)' }}>
                                                                            <span className="w-2 h-2 rounded-full bg-[#00e5cc] animate-pulse"/>
                                                                            NEU&nbsp;&nbsp;GOVERNANCE COMPLEXITY SCORE →
                                                            </div>div>
                                              
                                                {/* H1 */}
                                                            <h1 className={`text-5xl md:text-[3.75rem] font-black leading-[1.04] tracking-[-0.025em]
                                                                            transition-all duration-1000 delay-100
                                                                                            ${mounted?'opacity-100 translate-y-0':'opacity-0 translate-y-5'}`}>
                                                                            Das KI-<br/>Betriebssystem für<br/>
                                                                            <span style={{
                                            background:'linear-gradient(135deg,#00e5cc 0%,#00bfff 100%)',
                                            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
                        }}>
                                                                                              DSGVO & EU AI Act
                                                                            </span>span>
                                                            </h1>h1>
                                              
                                                            <p className="text-slate-400 text-xs tracking-[0.22em] uppercase font-semibold">
                                                                            AI GOVERNANCE OS FOR TRUST & VALUE
                                                            </p>p>
                                              
                                                            <p className="text-slate-300 text-[1.05rem] leading-relaxed max-w-[440px]">
                                                                            RealSync Dynamics AI überwacht Websites, KI-Systeme, Risiken und Nachweise
                                                                            kontinuierlich — DSGVO-konform, AI-Act-ready und auditierbar.
                                                            </p>p>
                                              
                                                {/* Feature-Zeile */}
                                                            <div className="grid grid-cols-3 gap-5 pt-1">
                                                              {[
                          { Icon: ShieldCheck, label:'DSGVO-KONFORM',  text:'Nachweise, Prozesse und Richtlinien automatisiert.' },
                          { Icon: ScanLine,    label:'AI-ACT-READY',   text:'Risikobewertung, Transparenz & Dokumentation.' },
                          { Icon: Activity,    label:'KONTINUIERLICH', text:'Monitoring, Alerts & Evidence in Echtzeit.' },
                                          ].map(({ Icon, label, text }) => (
                                                              <div key={label} className="space-y-1.5">
                                                                                  <div className="flex items-center gap-1.5 text-[#00e5cc] text-[10px] font-bold tracking-widest">
                                                                                                        <Icon size={13}/> {label}
                                                                                    </div>div>
                                                                                  <p className="text-slate-500 text-xs leading-snug">{text}</p>p>
                                                              </div>div>
                                                            ))}
                                                            </div>div>
                                              
                                                {/* CTAs */}
                                                            <div className="flex gap-4 pt-3 flex-wrap">
                                                                            <SmartLink to="/login"
                                                                                                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg font-black text-black text-sm
                                                                                transition-all duration-300 hover:scale-105 hover:brightness-110"
                                                                                                style={{ background:'#00e5cc', boxShadow:'0 0 32px rgba(0,229,204,0.42)' }}>
                                                                                              Kostenlos starten <ArrowRight size={15}/>
                                                                            </SmartLink>SmartLink>
                                                                            <SmartLink to="/preview"
                                                                                                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg font-semibold text-white text-sm
                                                                                border border-white/12 hover:border-[#00e5cc]/45 transition-all duration-300">
                                                                                              <PlayCircle size={15}/> Produkt-Tour ansehen
                                                                            </SmartLink>SmartLink>
                                                            </div>div>
                                              </div>div>
                                  
                                    {/* Right: Floating Info-Cards */}
                                              <div className="relative hidden md:block h-[640px]">
                                                            <InfoCard label="DSGVO"      status="compliant"
                                                                              className="top-14 left-2 w-44"   delay="0s"/>
                                                            <InfoCard label="RISK SCORE" value={riskScore} suffix="/100"
                                                                              className="top-36 right-0 w-48"  delay="0.18s"/>
                                                            <InfoCard label="EVIDENCE"   value={evidence.toLocaleString('de-DE')} suffix="Nachweise"
                                                                              className="bottom-32 left-6 w-44" delay="0.36s"/>
                                                            <InfoCard label="EU AI ACT"  status="ready"
                                                                              className="bottom-40 right-4 w-44" delay="0.54s"/>
                                                            <InfoCard label="MONITORING" status={healthStatus === 'up' ? 'live' : 'live'}
                                                                              className="bottom-8 left-1/2 -translate-x-1/2 w-56" delay="0.72s"/>
                                              </div>div>
                                  </div>div>
                        </section>section>
                
                  {/* ── Globale Keyframes ── */}
                        <style>{`
                                  @keyframes rs-float {
                                              0%,100% { transform: translateY(0px); }
                                                          50%      { transform: translateY(-18px); }
                                                                    }
                                                                              @keyframes rs-twinkle {
                                                                                          0%,100% { opacity: 0.12; } 50% { opacity: 0.65; }
                                                                                                    }
                                                                                                              @keyframes rs-orbit-0 {
                                                                                                                          from { transform: rotate(0deg)   translateY(-390px) rotate(0deg);   }
                                                                                                                                      to   { transform: rotate(360deg) translateY(-390px) rotate(-360deg); }
                                                                                                                                                }
                                                                                                                                                          @keyframes rs-orbit-1 {
                                                                                                                                                                      from { transform: rotate(72deg)  translateY(-390px) rotate(-72deg);  }
                                                                                                                                                                                  to   { transform: rotate(432deg) translateY(-390px) rotate(-432deg); }
                                                                                                                                                                                            }
                                                                                                                                                                                                      @keyframes rs-orbit-2 {
                                                                                                                                                                                                                  from { transform: rotate(144deg) translateY(-390px) rotate(-144deg); }
                                                                                                                                                                                                                              to   { transform: rotate(504deg) translateY(-390px) rotate(-504deg); }
                                                                                                                                                                                                                                        }
                                                                                                                                                                                                                                                  @keyframes rs-orbit-3 {
                                                                                                                                                                                                                                                              from { transform: rotate(216deg) translateY(-390px) rotate(-216deg); }
                                                                                                                                                                                                                                                                          to   { transform: rotate(576deg) translateY(-390px) rotate(-576deg); }
                                                                                                                                                                                                                                                                                    }
                                                                                                                                                                                                                                                                                              @keyframes rs-orbit-4 {
                                                                                                                                                                                                                                                                                                          from { transform: rotate(288deg) translateY(-390px) rotate(-288deg); }
                                                                                                                                                                                                                                                                                                                      to   { transform: rotate(648deg) translateY(-390px) rotate(-648deg); }
                                                                                                                                                                                                                                                                                                                                }
                                                                                                                                                                                                                                                                                                                                        `}</style>style>
                </div>div>
          </>>
        );
}</></div>
