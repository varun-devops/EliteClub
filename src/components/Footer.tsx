import Link from 'next/link'
import { Instagram, Facebook, Youtube, Linkedin, Mail } from 'lucide-react'
import Logo from './Logo'
import { BRAND } from '@/lib/constants'

export default function Footer() {
  return (
    <footer className="bg-ink-2 border-t border-gold/15 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="grid md:grid-cols-4 gap-12 mb-14">
          <div className="md:col-span-2">
            <Logo size={56} withText />
            <p className="font-cormorant text-[18px] text-cream/55 mt-5 max-w-sm leading-relaxed">
              {BRAND.subtitle}. A trusted platform connecting verified talent with
              India&apos;s most prestigious brands.
            </p>
            <p className="font-cinzel text-gold-light text-[13px] tracking-[0.3em] mt-5">
              {BRAND.tagline.toUpperCase()}
            </p>
          </div>

          <div>
            <h4 className="eyebrow mb-5">Platform</h4>
            <ul className="space-y-3 font-cormorant text-[16px] text-cream/65">
              <li><Link href="/register" className="hover:text-gold">Register</Link></li>
              <li><Link href="/hire" className="hover:text-gold">Hire Talent</Link></li>
              <li><Link href="/#championship" className="hover:text-gold">Championship</Link></li>
              <li><Link href="/#packages" className="hover:text-gold">Membership</Link></li>
              <li><Link href="/partner" className="hover:text-gold">Become a Partner</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="eyebrow mb-5">Join As</h4>
            <ul className="space-y-3 font-cormorant text-[16px] text-cream/65">
              <li><Link href="/register/influencer" className="hover:text-gold">Influencer</Link></li>
              <li><Link href="/register/photographer" className="hover:text-gold">Photographer</Link></li>
              <li><Link href="/register/videographer" className="hover:text-gold">Videographer</Link></li>
              <li><Link href="/hire" className="hover:text-gold">Business / Brand</Link></li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-8 border-t border-gold/10">
          <p className="font-montserrat text-[11px] tracking-[0.15em] text-cream/40">
            © {new Date().getFullYear()} {BRAND.name}. All Rights Reserved.
          </p>
          <div className="flex items-center gap-5 text-gold/70">
            <a href="#" aria-label="Instagram" className="hover:text-gold"><Instagram size={18} /></a>
            <a href="#" aria-label="Facebook" className="hover:text-gold"><Facebook size={18} /></a>
            <a href="#" aria-label="YouTube" className="hover:text-gold"><Youtube size={18} /></a>
            <a href="#" aria-label="LinkedIn" className="hover:text-gold"><Linkedin size={18} /></a>
            <a href="mailto:hello@eliteclub.in" aria-label="Email" className="hover:text-gold"><Mail size={18} /></a>
          </div>
        </div>

        {/* Powered-by credit */}
        <div className="pt-6 text-center">
          <p className="font-montserrat text-[11px] tracking-[0.25em] uppercase text-cream/35">
            Powered by <span className="text-gold-light">Reckon</span>
          </p>
        </div>
      </div>
    </footer>
  )
}
