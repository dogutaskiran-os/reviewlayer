import {
  ArrowRight, Check, ClipboardCheck, Code2, LockKeyhole, MessageSquare,
  MousePointer2, ShieldCheck, Sparkles, X, createIcons,
} from "lucide";
import "./marketing.css";

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <header class="site-header">
    <a class="wordmark" href="#top" aria-label="ReviewLayer home"><span class="wordmark-mark"><i data-lucide="message-square"></i></span><span>ReviewLayer</span></a>
    <nav class="site-nav" aria-label="Main navigation">
      <a href="#workflow">How it works</a>
      <a href="#pricing">Pricing</a>
      <a href="#install">Install</a>
    </nav>
    <a class="header-link" href="/dashboard.html">Sign in <i data-lucide="arrow-right"></i></a>
  </header>

  <main id="top">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-backdrop" aria-hidden="true"></div>
      <div class="hero-content content-width">
        <p class="eyebrow light">Website feedback for agencies</p>
        <h1 id="hero-title">Let clients point at the page instead of explaining it in email.</h1>
        <p class="hero-copy">Add one script to any client site. Reviewers click the exact element, leave a note, and your team gets a clean feedback inbox with page and element context.</p>
        <div class="hero-actions">
          <a class="button button-coral" href="/dashboard.html">Start free for 14 days <i data-lucide="arrow-right"></i></a>
          <a class="button button-ghost" href="/demo.html">Try the review experience</a>
        </div>
        <div class="hero-proof">
          <span><i data-lucide="shield-check"></i>No client account needed</span>
          <span><i data-lucide="code-2"></i>Works on any stack</span>
          <span><i data-lucide="lock-keyhole"></i>Private review codes</span>
        </div>
      </div>
    </section>

    <section class="review-showcase content-width" id="workflow" aria-labelledby="workflow-title">
      <div class="section-intro">
        <p class="eyebrow">The review loop</p>
        <h2 id="workflow-title">From “the button near the top” to an exact element.</h2>
        <p>ReviewLayer keeps client feedback attached to the page it belongs to. Your team sees the note, the URL and the element context together.</p>
      </div>
      <div class="review-window" aria-label="ReviewLayer client review interface preview">
        <div class="window-bar"><span class="window-dot coral"></span><span class="window-dot yellow"></span><span class="window-dot green"></span><span class="window-url">preview.client.com</span><span class="window-mode">Review mode</span></div>
        <div class="window-body">
          <div class="preview-page">
            <div class="preview-nav"><strong>northstar</strong><span>Work</span><span>Approach</span><span>Contact</span></div>
            <div class="preview-hero"><div><p class="preview-kicker">Independent design studio</p><h3>Make a useful first impression.</h3><p>Websites and products with a clear point of view.</p><span class="preview-button">Start a project</span></div><div class="preview-art"><div class="preview-art-card"><p>This quarter</p><strong>A calmer way to make progress.</strong><span>New enquiries <b>+42%</b></span></div></div></div>
            <span class="feedback-pin pin-one">1</span><span class="feedback-pin pin-two">2</span>
          </div>
          <aside class="review-popover"><div class="popover-head"><span>New feedback</span><i data-lucide="x"></i></div><p class="target-label">hero-heading</p><p class="target-copy">Make a useful first impression.</p><label>What should change?</label><div class="fake-input">Could we make this specific to the launch?</div><span class="send-row">Send feedback <i data-lucide="arrow-right"></i></span></aside>
        </div>
      </div>
      <div class="workflow-steps">
        <article><span class="step-index">01</span><i data-lucide="code-2"></i><h3>Add the script</h3><p>Install once on a staging or live website. WordPress, Webflow, Shopify, React or plain HTML all work.</p></article>
        <article><span class="step-index">02</span><i data-lucide="mouse-pointer-2"></i><h3>Send the review code</h3><p>Your client opens the page and clicks what they mean. No screenshots and no new account to create.</p></article>
        <article><span class="step-index">03</span><i data-lucide="clipboard-check"></i><h3>Resolve the queue</h3><p>Work through precise feedback in one inbox and close items as changes ship.</p></article>
      </div>
    </section>

    <section class="quiet-section">
      <div class="content-width photo-layout">
        <div class="photo-frame"><img src="/images/annote-workbench.png" alt="A web designer reviewing a website with pinned feedback comments on a laptop" /></div>
        <div class="photo-copy"><p class="eyebrow">Built for client work</p><h2>Less interpretation. Faster approvals.</h2><p>Clients comment while they are looking at the actual work. Designers and developers get the page, element and message in one place.</p><p>Use a separate project and review code for every client site.</p></div>
      </div>
    </section>

    <section class="pricing-section content-width" id="pricing" aria-labelledby="pricing-title">
      <div class="section-intro compact"><p class="eyebrow">Simple pricing</p><h2 id="pricing-title">Chargeable work deserves a clean review loop.</h2><p>Every plan starts with a 14-day trial. No credit card required during the trial.</p></div>
      <div class="pricing-grid">
        <article class="price-card"><p class="eyebrow">Solo</p><h3>$19<span>/month</span></h3><p>For freelancers and small studios.</p><ul><li><i data-lucide="check"></i>5 active projects</li><li><i data-lucide="check"></i>Unlimited reviewers</li><li><i data-lucide="check"></i>Element-level comments</li></ul><a class="button button-dark" href="/dashboard.html">Start free</a></article>
        <article class="price-card featured"><p class="eyebrow">Studio</p><h3>$49<span>/month</span></h3><p>For teams running client reviews every week.</p><ul><li><i data-lucide="check"></i>Unlimited projects</li><li><i data-lucide="check"></i>Team workspace</li><li><i data-lucide="check"></i>Unlimited reviewers</li></ul><a class="button button-coral" href="/dashboard.html">Start free</a></article>
        <article class="price-card"><p class="eyebrow">Agency</p><h3>$99<span>/month</span></h3><p>For agencies managing multiple client teams.</p><ul><li><i data-lucide="check"></i>Everything in Studio</li><li><i data-lucide="check"></i>White-label ready</li><li><i data-lucide="check"></i>Priority support</li></ul><a class="button button-dark" href="/dashboard.html">Start free</a></article>
      </div>
    </section>

    <section class="install-section" id="install">
      <div class="content-width install-layout">
        <div><p class="eyebrow light">One script</p><h2>Install it on the site you already have.</h2><p>Create a project, whitelist the client site and paste the generated snippet. The review layer stays isolated from the page styling.</p><a class="button button-coral" href="/dashboard.html">Create a workspace <i data-lucide="arrow-right"></i></a></div>
        <pre aria-label="Example ReviewLayer installation"><code>&lt;script src="https://review.pubmesh.media/annote.js"&gt;&lt;/script&gt;
&lt;script&gt;
  Annote.mount({
    reviewId: "client-redesign",
    apiBase: "https://review.pubmesh.media"
  });
&lt;/script&gt;</code></pre>
      </div>
    </section>

    <section class="open-source-section content-width">
      <div><p class="eyebrow">Your feedback stays together</p><h2>Projects, reviewers and comments in one workspace.</h2><p>ReviewLayer runs as a dedicated service with its own account, workspace and data layer. The product can move to its final domain later without changing the review workflow.</p></div>
      <div class="license-note"><i data-lucide="sparkles"></i><span>14-day trial<br /><small>Start without a card</small></span></div>
      <a class="button button-dark" href="/dashboard.html">Start free</a>
    </section>
  </main>

  <footer class="site-footer content-width"><a class="wordmark" href="#top"><span class="wordmark-mark"><i data-lucide="message-square"></i></span><span>ReviewLayer</span></a><p>Clearer website reviews.</p><a href="/dashboard.html">Sign in</a></footer>
`;

createIcons({
  icons: { ArrowRight, Check, ClipboardCheck, Code2, LockKeyhole, MessageSquare, MousePointer2, ShieldCheck, Sparkles, X },
  attrs: { "stroke-width": 2 },
});
