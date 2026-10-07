import { createFileRoute, redirect } from '@tanstack/react-router'
import { supabase } from '@/integrations/supabase/client'

const ALLOWED_EMAIL = 'owertech82@gmail.com'

export const Route = createFileRoute('/_authenticated')({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      throw redirect({
        to: '/auth',
        search: {
          redirect: location.href,
        },
      })
    }

    if (session.user.email !== ALLOWED_EMAIL) {
      await supabase.auth.signOut()
      throw redirect({
        to: '/auth',
        search: {
          error: 'Acesso negado: e-mail não autorizado.',
        },
      })
    }
  },
})
