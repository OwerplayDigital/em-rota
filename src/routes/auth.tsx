import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { LogIn, Mail, Lock } from 'lucide-react'
import { z } from 'zod'

export const Route = createFileRoute('/auth')({
  validateSearch: z.object({
    redirect: z.string().optional(),
    error: z.string().optional(),
  }),
  component: AuthPage,
})

function AuthPage() {
  const navigate = useNavigate()
  const search = useSearch({ from: '/auth' })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (search.error) {
      toast.error(search.error)
    }
    
    // Check if already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && session.user.email === 'owertech82@gmail.com') {
        navigate({ to: search.redirect || '/dashboard' })
      }
    })
  }, [search.error, navigate, search.redirect])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      if (data.user?.email !== 'owertech82@gmail.com') {
        await supabase.auth.signOut()
        throw new Error('Acesso negado: e-mail não autorizado.')
      }

      toast.success('Bem-vindo ao Em Rota!')
      navigate({ to: search.redirect || '/dashboard' })
    } catch (error: any) {
      toast.error(error.message || 'Erro na autenticação')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/3 rounded-full blur-[120px] -z-10 translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-primary/3 rounded-full blur-[120px] -z-10 -translate-x-1/2 translate-y-1/2" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md z-10"
      >
        <Card className="bg-card border-border shadow-2xl rounded-[2.5rem] overflow-hidden">
          <CardHeader className="space-y-4 pt-10 pb-6 text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
              <LogIn className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-3xl font-bold tracking-tight text-foreground">
                EM ROTA
              </CardTitle>
              <p className="text-muted-foreground text-xs font-light uppercase tracking-[0.2em]">
                Acesso à Dashboard
              </p>
            </div>
          </CardHeader>
          <CardContent className="px-8 pb-10 pt-2">
            <form onSubmit={handleAuth} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ml-1">
                  E-mail
                </Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-muted/30 border-border rounded-xl pl-12 h-12 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ml-1">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-muted/30 border-border rounded-xl pl-12 h-12 focus:ring-primary/20"
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-border/50 text-center">
              <p className="text-[9px] text-muted-foreground font-light uppercase tracking-widest leading-relaxed">
                Este sistema é privado e restrito.<br />
                Apenas usuários autorizados podem acessar.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
