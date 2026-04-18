import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { SketchMotionLogo } from "./SketchMotionLogo";

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSmoothScroll = useCallback((e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    // Only handle smooth scroll if we're on the landing page
    if (location.pathname === '/') {
      e.preventDefault();
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setMobileMenuOpen(false);
      }
    }
  }, [location.pathname]);

  return (
    <nav 
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        "bg-gradient-to-r from-black/80 via-black/60 to-black/80 backdrop-blur-xl border-b border-white/10",
        scrolled && "bg-black/90 shadow-lg"
      )}
    >
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <SketchMotionLogo />
          <span className="font-display font-bold text-xl text-white">
            SketchMotion
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          <a 
            href="#features" 
            onClick={(e) => handleSmoothScroll(e, 'features')}
            className="text-white/80 hover:text-white transition-colors font-medium cursor-pointer"
          >
            Features
          </a>
          <a 
            href="#pricing" 
            onClick={(e) => handleSmoothScroll(e, 'pricing')}
            className="text-white/80 hover:text-white transition-colors font-medium cursor-pointer"
          >
            Pricing
          </a>
          <a 
            href="#testimonials" 
            onClick={(e) => handleSmoothScroll(e, 'testimonials')}
            className="text-white/80 hover:text-white transition-colors font-medium cursor-pointer"
          >
            Why it works
          </a>
        </div>

        {/* CTA Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <Link to="/dashboard">
            <Button 
              variant="ghost" 
              className="text-white hover:bg-white/10 hover:text-white"
            >
              Log In
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button 
              className="bg-sm-magenta hover:bg-sm-magenta/90 text-white font-semibold px-6 shadow-glow hover:shadow-glow-lg transition-all btn-press"
            >
              Open Workspace
            </Button>
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button 
          className="md:hidden text-white p-2"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      <div className={cn(
        "md:hidden absolute top-full left-0 right-0 transition-all duration-300 border-b border-white/10",
        "bg-gradient-to-r from-black/95 via-black/90 to-black/95 backdrop-blur-xl",
        mobileMenuOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
      )}>
        <div className="px-6 py-4 flex flex-col gap-4">
          <a 
            href="#features" 
            onClick={(e) => handleSmoothScroll(e, 'features')}
            className="text-white/80 hover:text-white transition-colors font-medium py-2 cursor-pointer"
          >
            Features
          </a>
          <a 
            href="#pricing" 
            onClick={(e) => handleSmoothScroll(e, 'pricing')}
            className="text-white/80 hover:text-white transition-colors font-medium py-2 cursor-pointer"
          >
            Pricing
          </a>
          <a 
            href="#testimonials" 
            onClick={(e) => handleSmoothScroll(e, 'testimonials')}
            className="text-white/80 hover:text-white transition-colors font-medium py-2 cursor-pointer"
          >
            Why it works
          </a>
          <hr className="border-white/20" />
          <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)}>
            <Button 
              variant="ghost" 
              className="w-full text-white hover:bg-white/10 hover:text-white"
            >
              Log In
            </Button>
          </Link>
          <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)}>
            <Button 
              className="w-full bg-sm-magenta hover:bg-sm-magenta/90 text-white font-semibold shadow-glow"
            >
              Open Workspace
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
