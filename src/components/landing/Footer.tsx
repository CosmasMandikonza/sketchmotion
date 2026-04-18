import { Link } from "react-router-dom";
import { Sparkles, Twitter, Github, Youtube, Linkedin } from "lucide-react";

export function Footer() {
  return (
    <footer className="py-12 px-4 border-t border-white/10">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sm-magenta to-sm-purple flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="font-display font-bold text-xl text-white">
                SketchMotion
              </span>
            </Link>
            <p className="text-white/60 text-sm mb-4">
              Storyboard-to-motion workspace for dependable creative review.
            </p>
            <div className="flex gap-4">
              <a href="#" className="text-white/40 hover:text-white transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="text-white/40 hover:text-white transition-colors">
                <Github className="w-5 h-5" />
              </a>
              <a href="#" className="text-white/40 hover:text-white transition-colors">
                <Youtube className="w-5 h-5" />
              </a>
              <a href="#" className="text-white/40 hover:text-white transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-2">
              <li><Link to="/#features" className="text-white/60 hover:text-white transition-colors text-sm">Features</Link></li>
              <li><Link to="/#pricing" className="text-white/60 hover:text-white transition-colors text-sm">Pricing</Link></li>
              <li><Link to="/dashboard" className="text-white/60 hover:text-white transition-colors text-sm">Dashboard</Link></li>
              <li><a href="#" className="text-white/60 hover:text-white transition-colors text-sm">Changelog</a></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-semibold text-white mb-4">Resources</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-white/60 hover:text-white transition-colors text-sm">Documentation</a></li>
              <li><a href="#" className="text-white/60 hover:text-white transition-colors text-sm">Tutorials</a></li>
              <li><a href="#" className="text-white/60 hover:text-white transition-colors text-sm">Blog</a></li>
              <li><a href="#" className="text-white/60 hover:text-white transition-colors text-sm">Community</a></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-white mb-4">Company</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-white/60 hover:text-white transition-colors text-sm">About</a></li>
              <li><a href="#" className="text-white/60 hover:text-white transition-colors text-sm">Careers</a></li>
              <li><a href="#" className="text-white/60 hover:text-white transition-colors text-sm">Privacy</a></li>
              <li><a href="#" className="text-white/60 hover:text-white transition-colors text-sm">Terms</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-white/40 text-sm">
            (c) 2024 SketchMotion. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-white/40 hover:text-white transition-colors text-sm">Privacy Policy</a>
            <a href="#" className="text-white/40 hover:text-white transition-colors text-sm">Terms of Service</a>
            <a href="#" className="text-white/40 hover:text-white transition-colors text-sm">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
