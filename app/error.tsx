'use client';
export default function ErrorPage({ reset }: { reset: () => void }) { return <main id="main" className="product-page"><span className="eyebrow">REQUEST INTERRUPTED</span><h1>Something went wrong.</h1><p>Reload this view and try again. No transaction was submitted by this interface.</p><button className="button primary" onClick={reset}>Try again</button></main>; }
