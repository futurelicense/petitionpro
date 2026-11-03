import Link from "next/link";

export function PublicBrand({ lede }: { lede: string }) {
  return <>
    <header className="rail"><div className="rail-inner">
      <div className="rail-mark"><p className="kicker">Start with clarity</p><h1 className="brand">Petition<span>Pro</span></h1></div>
      <nav className="sitenav" aria-label="Sections">
        <Link href="/">Free assessment</Link><Link href="/diy">DIY workspace</Link><Link href="/login">Admin sign in</Link>
      </nav>
      <p className="public-rail-note">Define your endeavor. Understand your evidence. Choose your next step.</p>
    </div></header>
    <p className="lede">{lede}</p>
  </>;
}
