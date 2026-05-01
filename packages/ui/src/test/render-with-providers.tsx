import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom'

import type { PropsWithChildren, ReactElement } from 'react'

export interface RenderWithProvidersOptions
  extends Omit<RenderOptions, 'wrapper'> {
  route?: string
  memoryRouterProps?: Omit<MemoryRouterProps, 'children'>
  queryClient?: QueryClient
}

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

function Wrapper({
  children,
  queryClient,
  route,
  memoryRouterProps,
}: PropsWithChildren<{
  queryClient: QueryClient
  route: string
  memoryRouterProps?: Omit<MemoryRouterProps, 'children'>
}>) {
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[route]}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
        {...memoryRouterProps}
      >
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  )
}

export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
) {
  const {
    route = '/',
    memoryRouterProps,
    queryClient = createTestQueryClient(),
    ...renderOptions
  } = options

  return {
    queryClient,
    ...render(ui, {
      wrapper: ({ children }: PropsWithChildren) => (
        <Wrapper queryClient={queryClient} route={route} memoryRouterProps={memoryRouterProps}>
          {children}
        </Wrapper>
      ),
      ...renderOptions,
    }),
  }
}
