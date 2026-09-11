import { 
  LayoutDashboard, 
  History, 
  TrendingUp, 
  Menu,
  ChevronRight,
  LogOut,
  Smartphone,
  X,
  Map
} from 'lucide-react'
import { Link, useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'


const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Jornadas', icon: Map, href: '/jornadas' },
  { label: 'Histórico', icon: History, href: '/historico' },
  { label: 'Desempenho', icon: TrendingUp, href: '/desempenho' },
]

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error("Erro ao sair")
    } else {
      toast.success("Até breve!")
      navigate({ to: "/auth" })
    }
  }

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Abrir menu"
          className="fixed top-6 left-5 z-[110] md:hidden text-foreground/70 hover:text-primary transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
      )}

      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed left-0 top-0 h-full w-64 bg-sidebar border-r border-sidebar-border flex flex-col z-[100] transition-all duration-500 md:translate-x-0 shadow-[4px_0_24px_rgba(0,0,0,0.02)]",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-8 pt-10">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-2xl bg-primary flex items-center justify-center shadow-[0_8px_16px_rgba(var(--color-primary),0.2)] overflow-hidden">
              <img src="/favicon.png" alt="Logo" className="w-6 h-6 object-contain" />
            </div>
            <h1 className="text-xl font-bold tracking-tighter text-foreground">
              EM ROTA
            </h1>
          </div>
          <div className="text-[9px] font-bold text-primary/40 uppercase tracking-[0.3em] ml-12">Pro Edition</div>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 mt-8">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setIsOpen(false)}
              className={cn(
                "flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative",
                "text-sidebar-foreground/50 hover:text-primary hover:bg-primary/5",
                "[&.active]:bg-primary/10 [&.active]:text-primary [&.active]:shadow-sm"
              )}
            >
              <item.icon className="w-5 h-5 opacity-40 group-hover:opacity-100 transition-all duration-300 group-[.active]:opacity-100" />
              <span className="font-semibold text-[13px] tracking-tight">
                {item.label}
              </span>
              <ChevronRight className="ml-auto w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-40 group-hover:translate-x-0 transition-all duration-300" />
              
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-0 group-[.active]:h-5 bg-primary rounded-full transition-all duration-300 opacity-0 group-[.active]:opacity-100 -translate-x-1" />
            </Link>
          ))}
        </nav>

        <div className="p-6 border-t border-sidebar-border/50">
          <div className="p-4 rounded-3xl bg-primary/[0.03] border border-primary/5 space-y-3 hover:bg-primary/[0.05] transition-all duration-300 group">
            <div className="flex items-center justify-between">
              <div className="text-[8px] text-primary/40 uppercase tracking-[0.2em] font-bold group-hover:text-primary/60 transition-colors">Telegram Bot</div>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center border border-primary/5 shadow-sm group-hover:border-primary/10 transition-colors">
                <Smartphone className="w-4 h-4 text-primary/40 group-hover:text-primary/70 transition-colors" />
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] font-bold text-foreground/80">Conectado</div>
                <p className="text-[9px] text-primary/30 leading-tight font-medium">Sincronização Ativa</p>
              </div>
            </div>
          </div>
          
          <button 
            onClick={handleLogout}
            className="w-full mt-4 py-3 flex items-center justify-center gap-2 text-muted-foreground/40 hover:text-destructive/60 transition-all duration-300 group"
          >
            <LogOut className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Sair do Painel</span>
          </button>
        </div>
      </aside>

    </>
  )
}