import { MenubarPage } from '@ohmyc/ui/components/menubar/menubar-page'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { useEffect } from 'react'

// React Query needs a client provider. Each desktop popover window owns
// its own client; cache is process-local.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})

export function Menubar() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        void invoke('hide_popover')
      }
    }
    globalThis.addEventListener('keydown', onKey)
    return () => globalThis.removeEventListener('keydown', onKey)
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <MenubarPage />
    </QueryClientProvider>
  )
}
