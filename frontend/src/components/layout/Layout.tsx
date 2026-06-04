import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { site } from '@/config/site'

/**
 * App-shell layout for authenticated routes.
 *
 *  - lg+:    sidebar fixed left at 240px width
 *  - <lg:    sidebar hidden behind hamburger → opens as a Dialog drawer
 *  - all:    a slim topbar with brand mark (mobile only) + theme toggle (right)
 */
export default function Layout() {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-60 shrink-0 sticky top-0 h-screen">
        <Sidebar />
      </aside>

      {/* Mobile drawer — slides in from the left */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="p-0 max-w-[80vw] sm:max-w-xs left-0 top-0 translate-x-0 translate-y-0 h-screen max-h-screen rounded-none border-r data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left max-sm:rounded-none max-sm:rounded-r-none max-sm:bottom-auto"
          aria-describedby={undefined}
        >
          <Sidebar onNavigate={() => setOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile topbar */}
        <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-background/80 backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Link
            to="/"
            className="font-display text-2xl tracking-tightest font-light text-foreground"
          >
            {site.name}
          </Link>
          <ThemeToggle />
        </div>

        {/* Desktop floating theme toggle */}
        <div className="hidden lg:flex fixed top-4 right-6 z-30">
          <ThemeToggle />
        </div>

        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
