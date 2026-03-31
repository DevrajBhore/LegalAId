import { Icons } from "../../utils/icons";

export default function AuthShowcase({ eyebrow, headline, emphasis, description, highlights=[], footerTitle, footerPoints=[] }) {
  return (
    <div className="auth-brand">
      <div className="auth-left-orb auth-left-orb-1"/>
      <div className="auth-left-orb auth-left-orb-2"/>

      <div className="auth-brand-logo">
        <span className="auth-brand-mark">{Icons.gavel}</span>
        <div>
          <div className="auth-brand-name">Legal<em>AI</em>d</div>
          <div className="auth-brand-tagline">AI drafting · Indian legal knowledge</div>
        </div>
      </div>

      <div style={{marginBottom:28}}>
        <div className="auth-brand-eyebrow">{eyebrow}</div>
        <h1 className="auth-brand-headline">
          {headline}{emphasis && <><br/><em>{emphasis}</em></>}
        </h1>
        <p className="auth-brand-sub">{description}</p>
      </div>

      <div className="auth-showcase-grid">
        {highlights.map(item => (
          <article key={item.title} className="auth-showcase-card">
            <span className="auth-showcase-icon">{item.icon}</span>
            <div><h3>{item.title}</h3><p>{item.text}</p></div>
          </article>
        ))}
      </div>

      {footerPoints.length > 0 && (
        <div className="auth-showcase-panel">
          <div className="auth-showcase-panel-label">{footerTitle||"Workflow"}</div>
          <div className="auth-showcase-list">
            {footerPoints.map(pt => (
              <div key={pt} className="auth-showcase-list-item">
                <span className="auth-showcase-list-icon">{Icons.check}</span>
                <span>{pt}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
