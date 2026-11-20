import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRight, ArrowUpRight, AudioLines, Blocks, Bot, CheckCheck, Code2,
  Fingerprint, GitBranchPlus, LockKeyhole, PanelsTopLeft, PhoneCall,
  ShieldCheck, Sparkles, Workflow,
} from 'lucide-react';
import {
  PRODUCT_LANDINGS, PRODUCT_STATUS_LABELS,
  findProductLanding, productLandingStatus, type ProductSlug,
} from '../config/productLandings';
import '../styles/product-landings.css';
import { SyncStage } from '../components/visual/sync-mascot/SyncStage';

/**
 * Gemeinsames White-Designsystem für die sechs Produkt-Landingpages.
 * Keine eigene Auth-, Backend-, Checkout- oder Infrastrukturinstanz.
 */
function ProductHeroVisual({ variant }: { variant: ProductSlug }) {
  return (
    <div className={'rpl-visual rpl-visual--' + variant} aria-hidden="true">
      <span className="rpl-visual__eyebrow">REALSYNC / {variant.toUpperCase().replace(/-/g, ' ')}</span>
      {variant === 'governance-os' && (
        <div className="rpl-visual__governance">
          <div className="rpl-visual__rings"><ShieldCheck size={95} strokeWidth={1.15} /></div>
          <span className="rpl-float rpl-float--left"><Fingerprint size={19} /> POLICY</span>
          <span className="rpl-float rpl-float--right"><LockKeyhole size={19} /> EVIDENCE</span>
        </div>
      )}
      {variant === 'voice-agent' && (
        <div className="rpl-visual__voice">
          <div className="rpl-voice__phone"><PhoneCall size={65} strokeWidth={1.25}/></div>
          <div className="rpl-voice__bars">{[28, 62, 42, 90, 52, 110, 46, 75, 30].map((h, i) => <span key={i} style={{ height: h + 'px' }} />)}</div>
          <div className="rpl-voice__label"><AudioLines size={18}/> Anfrage → Übergabe</div>
        </div>
      )}
      {variant === 'app-builder' && (
        <div className="rpl-visual__builder">
          <div className="rpl-builder__back"></div>
          <div className="rpl-builder__window"><span className="rpl-builder__top"><span/> <span/> <span/></span><PanelsTopLeft size={80} strokeWidth={1.05}/><span className="rpl-builder__lines"><i/><i/><i/></span></div>
          <span className="rpl-builder__cursor"><Blocks size={25}/></span>
        </div>
      )}
      {variant === 'software-factory' && (
        <div className="rpl-visual__factory">
          {['SPEC', 'CODE', 'TEST', 'REVIEW'].map((step, index) => (
            <div className="rpl-factory__step" key={step}>
              <span>0{index + 1}</span>
              {index === 0 ? <Blocks size={31}/> : index === 1 ? <Code2 size={31}/> : index === 2 ? <CheckCheck size={31}/> : <GitBranchPlus size={31}/>}
              <strong>{step}</strong>
            </div>
          ))}
        </div>
      )}
      {variant === 'automation-os' && (
        <div className="rpl-visual__automation">
          <div className="rpl-auto__node rpl-auto__node--start"><Bot size={31}/> START</div>
          <div className="rpl-auto__line"/>
          <div className="rpl-auto__node rpl-auto__node--main"><Workflow size={63} strokeWidth={1.1}/><span>WORKFLOW</span></div>
          <div className="rpl-auto__line"/>
          <div className="rpl-auto__node rpl-auto__node--end"><CheckCheck size={29}/> REVIEW</div>
        </div>
      )}
      {variant === 'creative-studio' && (
        <div className="rpl-visual__creative">
          <span className="rpl-creative__panel rpl-creative__panel--a"></span>
          <span className="rpl-creative__panel rpl-creative__panel--b"></span>
          <span className="rpl-creative__panel rpl-creative__panel--c"><Sparkles size={66} strokeWidth={1.1}/></span>
          <span className="rpl-creative__caption">CREATE / EXPLORE</span>
        </div>
      )}
    </div>
  );
}

export function ProductLanding() {
  const { pathname } = useLocation();
  const product = findProductLanding(pathname.replace(/^\//, '').replace(/\/$/, ''));
  if (!product) return <main className="rpl rpl-missing"><h1>Produkt nicht gefunden.</h1><Link to="/">Zur Hauptseite</Link></main>;
  const status = productLandingStatus(product);

  return (
    <div className="rpl">
      <a className="rpl-skip" href="#produkt-inhalt">Zum Inhalt springen</a>
      <header className="rpl-header">
        <Link to="/" className="rpl-brand" aria-label="RealSync Dynamics & AI – Startseite">RealSync <span>Dynamics &amp; AI</span></Link>
        <nav aria-label="Produktnavigation">
          <Link to="/#produkte">Alle Produkte</Link>
          <Link to="/audit">Kostenloser Check</Link>
          <Link to="/pricing">Preise</Link>
          <Link to="/welcome" className="rpl-account">Anmelden <ArrowUpRight size={15}/></Link>
        </nav>
      </header>

      <main id="produkt-inhalt">
        <section className="rpl-hero" aria-labelledby="rpl-heading">
          <div className="rpl-hero__copy">
            <span className="rpl-eyebrow">REALSYNC / {product.label} <span className="rpl-status">{PRODUCT_STATUS_LABELS[status]}</span></span>
            <h1 id="rpl-heading">{product.headline}</h1>
            <p className="rpl-lead">{product.description}</p>
            <div className="rpl-actions">
              <Link to={product.action.href} className="rpl-button rpl-button--primary">{product.action.label} <ArrowRight size={18}/></Link>
              <Link to={product.secondary.href} className="rpl-button">{product.secondary.label}</Link>
            </div>
            <p className="rpl-hero__note">{product.note}</p>
          </div>
          <div className="rpl-sync-composition" data-testid={'product-sync-' + product.slug}>
            <ProductHeroVisual variant={product.slug} />
            <SyncStage variant={product.slug} caption={product.name} statusLabel="SYNC · RealSync Dynamics & AI" />
          </div>
        </section>

        <section className="rpl-section" aria-labelledby="rpl-features-heading">
          <span className="rpl-eyebrow">DIE MÖGLICHKEITEN</span>
          <h2 id="rpl-features-heading">Ein Produkt. Ein klarer Ablauf.</h2>
          <div className="rpl-feature-grid">
            {product.points.map((point, i) => (
              <article className="rpl-feature" key={point}>
                <span>0{i + 1}</span>
                <h3>{point}</h3>
                <ArrowUpRight size={24} aria-hidden="true"/>
              </article>
            ))}
          </div>
        </section>

        <section className="rpl-section rpl-platform" aria-labelledby="rpl-platform-heading">
          <div>
            <span className="rpl-eyebrow">GEMEINSAME INFRASTRUKTUR</span>
            <h2 id="rpl-platform-heading">Ein Dach. Alle Produkte.</h2>
            <p>Login, Mandanten, Abrechnung und Governance sind Teil der gemeinsamen RealSync-Plattform. Es entsteht keine zweite Infrastruktur für dieses Produkt.</p>
          </div>
          <div className="rpl-platform__icons"><ShieldCheck size={40}/><LockKeyhole size={40}/><Blocks size={40}/></div>
        </section>

        <section className="rpl-section" aria-labelledby="rpl-more-heading">
          <span className="rpl-eyebrow">REALSYNC PRODUKTFAMILIE</span>
          <h2 id="rpl-more-heading">Mehr aus einer Plattform.</h2>
          <div className="rpl-more">
            {PRODUCT_LANDINGS.filter((item) => item.slug !== product.slug).map((item) => (
              <Link key={item.slug} to={'/' + item.slug} className="rpl-more__item">
                <span>{item.name}</span><ArrowUpRight size={17}/><small>{PRODUCT_STATUS_LABELS[productLandingStatus(item)]}</small>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <footer className="rpl-footer"><Link to="/">RealSync Dynamics &amp; AI</Link><div><Link to="/impressum">Impressum</Link><Link to="/datenschutz">Datenschutz</Link><Link to="/agb">AGB</Link></div></footer>
    </div>
  );
}

export default ProductLanding;
