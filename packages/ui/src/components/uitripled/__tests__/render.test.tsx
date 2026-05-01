/**
 * Smoke test suite for uitripled primitives
 *
 * Verifies that all 18 shadcn base primitives and 4 native animated wrappers
 * render without React errors in the React 19 + Tailwind v3 + @radix-ui/react environment.
 *
 * Components tested:
 * - Base primitives: Card, Button, Badge, Input, Textarea, Label, Separator,
 *   ScrollArea, Tabs, Dialog, Select, Switch, Tooltip, DropdownMenu,
 *   Slider, Checkbox, Avatar, PasswordInput
 * - Native animated wrappers: NativeDialog, NativeTooltip, NativeTabs, NativeButton
 */

import { render, screen } from '@testing-library/react'
import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
// Simple base primitives
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
// Interactive base primitives
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
// Native animated wrappers
import {
  NativeButton,
  NativeDialog,
  NativeDialogContent,
  NativeDialogTitle,
  NativeTabs,
  NativeTooltip,
  NativeTooltipProvider,
} from '@/components/uitripled'

// ─── Test 1: Card components ────────────────────────────────────────

describe('Card components', () => {
  it('renders Card with all sub-components without errors', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Test Card</CardTitle>
          <CardDescription>Card description</CardDescription>
        </CardHeader>
        <CardContent>Card body content</CardContent>
        <CardFooter>Footer text</CardFooter>
      </Card>,
    )

    expect(screen.getByText('Test Card')).toBeInTheDocument()
    expect(screen.getByText('Card description')).toBeInTheDocument()
    expect(screen.getByText('Card body content')).toBeInTheDocument()
    expect(screen.getByText('Footer text')).toBeInTheDocument()
  })
})

// ─── Test 2: Button variants ────────────────────────────────────────

describe('Button component', () => {
  it('renders with default variant', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('renders with outline, destructive, secondary, and ghost variants', () => {
    const variants = ['outline', 'destructive', 'secondary', 'ghost'] as const

    for (const variant of variants) {
      const { unmount } = render(
        <Button variant={variant}>{variant} button</Button>,
      )
      expect(screen.getByText(`${variant} button`)).toBeInTheDocument()
      unmount()
    }
  })
})

// ─── Test 3: Badge variants ─────────────────────────────────────────

describe('Badge component', () => {
  it('renders with default, secondary, destructive, and outline variants', () => {
    const variants = ['default', 'secondary', 'destructive', 'outline'] as const

    for (const variant of variants) {
      const { unmount } = render(
        <Badge variant={variant}>{variant} badge</Badge>,
      )
      expect(screen.getByText(`${variant} badge`)).toBeInTheDocument()
      unmount()
    }
  })
})

// ─── Test 4: Input and Textarea ─────────────────────────────────────

describe('Input and Textarea', () => {
  it('renders Input and accepts props', () => {
    render(<Input placeholder="Enter text" />)
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
  })

  it('renders Textarea and accepts props', () => {
    render(<Textarea placeholder="Enter long text" />)
    expect(screen.getByPlaceholderText('Enter long text')).toBeInTheDocument()
  })
})

// ─── Test 5: Tabs ───────────────────────────────────────────────────

describe('Tabs component ', () => {
  it('renders Tabs with triggers and content panels', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>,
    )

    expect(screen.getByText('Tab 1')).toBeInTheDocument()
    expect(screen.getByText('Tab 2')).toBeInTheDocument()
    expect(screen.getByText('Content 1')).toBeInTheDocument()
  })
})

// ─── Test 6: Dialog  ───────────────────────────────────────

describe('Dialog component ', () => {
  it('renders dialog content when open', () => {
    render(
      <Dialog open={true} onOpenChange={() => {}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test Dialog</DialogTitle>
            <DialogDescription>Dialog description</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    )

    expect(screen.getByText('Test Dialog')).toBeInTheDocument()
    expect(screen.getByText('Dialog description')).toBeInTheDocument()
  })

  it('renders dialog with trigger', () => {
    render(
      <Dialog>
        <DialogTrigger>Open Dialog</DialogTrigger>
        <DialogContent>
          <DialogTitle>Triggered Dialog</DialogTitle>
        </DialogContent>
      </Dialog>,
    )

    expect(screen.getByText('Open Dialog')).toBeInTheDocument()
  })
})

// ─── Test 7: Select  ───────────────────────────────────────

describe('Select component ', () => {
  it('renders Select with trigger', () => {
    const { container } = render(
      <Select defaultValue="a">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Option A</SelectItem>
          <SelectItem value="b">Option B</SelectItem>
        </SelectContent>
      </Select>,
    )

    // base-ui Select uses a combobox trigger; items are in a popup that renders on open
    const trigger = container.querySelector('[data-slot="select-trigger"]')
    expect(trigger).toBeTruthy()
    expect(trigger).toHaveAttribute('role', 'combobox')
  })
})

// ─── Test 8: Switch  ───────────────────────────────────────

describe('Switch component ', () => {
  it('renders Switch without errors', () => {
    const { container } = render(<Switch />)
    const switchElement = container.querySelector('[data-slot="switch"]')
    expect(switchElement).toBeTruthy()
  })
})

// ─── Test 9: Tooltip  ──────────────────────────────────────

describe('Tooltip component ', () => {
  it('renders Tooltip with trigger and content', () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Hover me</TooltipTrigger>
          <TooltipContent>Tooltip text</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    )

    expect(screen.getByText('Hover me')).toBeInTheDocument()
  })
})

// ─── Test 10: DropdownMenu  ────────────────────────────────

describe('DropdownMenu component ', () => {
  it('renders DropdownMenu with trigger and items', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item 1</DropdownMenuItem>
          <DropdownMenuItem>Item 2</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )

    expect(screen.getByText('Menu')).toBeInTheDocument()
  })
})

// ─── Test 11: Label, Separator, ScrollArea ──────────────────────────

describe('Label, Separator, ScrollArea', () => {
  it('renders Label', () => {
    render(<Label>Form Label</Label>)
    expect(screen.getByText('Form Label')).toBeInTheDocument()
  })

  it('renders Separator without errors', () => {
    const { container } = render(<Separator />)
    const separator = container.querySelector('[data-slot="separator"]')
    expect(separator).toBeTruthy()
  })

  it('renders ScrollArea with content', () => {
    render(
      <ScrollArea>
        <div>Scrollable content</div>
      </ScrollArea>,
    )
    expect(screen.getByText('Scrollable content')).toBeInTheDocument()
  })
})

// ─── Test 12: Slider  ──────────────────────────────────────

describe('Slider component ', () => {
  it('renders Slider with value', () => {
    const { container } = render(<Slider defaultValue={[50]} />)
    const slider = container.querySelector('[data-slot="slider"]')
    expect(slider).toBeTruthy()
  })
})

// ─── Test 13: Checkbox  ────────────────────────────────────

describe('Checkbox component ', () => {
  it('renders Checkbox without errors', () => {
    const { container } = render(<Checkbox />)
    const checkbox = container.querySelector('[data-slot="checkbox"]')
    expect(checkbox).toBeTruthy()
  })
})

// ─── Test 14: Avatar ────────────────────────────────────────────────

describe('Avatar component ', () => {
  it('renders Avatar with fallback', () => {
    render(
      <Avatar>
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>,
    )
    expect(screen.getByText('AB')).toBeInTheDocument()
  })

  it('renders Avatar with image and fallback', () => {
    render(
      <Avatar>
        <AvatarImage src="https://example.com/avatar.jpg" alt="User avatar" />
        <AvatarFallback>CD</AvatarFallback>
      </Avatar>,
    )
    // Fallback should render even when image is provided
    expect(screen.getByText('CD')).toBeInTheDocument()
  })
})

// ─── Test 15: PasswordInput ─────────────────────────────────────────

describe('PasswordInput component', () => {
  it('renders PasswordInput with placeholder', () => {
    render(<PasswordInput placeholder="Enter password" />)
    expect(screen.getByPlaceholderText('Enter password')).toBeInTheDocument()
  })

  it('renders toggle visibility button', () => {
    const { container } = render(<PasswordInput />)
    // The toggle button should be rendered
    const toggleButton = container.querySelector("button[type='button']")
    expect(toggleButton).toBeTruthy()
  })
})

// ─── Test 16: NativeDialog (animated wrapper) ───────────────────────

describe('NativeDialog (animated wrapper)', () => {
  it('renders without errors', () => {
    render(
      <NativeDialog open={true} onOpenChange={() => {}}>
        <NativeDialogContent>
          <NativeDialogTitle>Native Dialog Test</NativeDialogTitle>
        </NativeDialogContent>
      </NativeDialog>,
    )

    // Radix Dialog renders into a portal; check document.body for dialog content
    expect(screen.getByText('Native Dialog Test')).toBeInTheDocument()
  })
})

// ─── Test 17: NativeTooltip (animated wrapper) ──────────────────────

describe('NativeTooltip (animated wrapper)', () => {
  it('renders without errors', () => {
    render(
      <NativeTooltipProvider>
        <NativeTooltip content="Tooltip hint">
          <button>Hover target</button>
        </NativeTooltip>
      </NativeTooltipProvider>,
    )

    expect(screen.getByText('Hover target')).toBeInTheDocument()
  })
})

// ─── Test 18: NativeTabs (animated wrapper) ─────────────────────────

describe('NativeTabs (animated wrapper)', () => {
  it('renders without errors', () => {
    render(
      <NativeTabs
        items={[
          { id: 't1', label: 'First', content: <span>First content</span> },
          { id: 't2', label: 'Second', content: <span>Second content</span> },
        ]}
        defaultValue="t1"
      />,
    )

    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
  })
})

// ─── Test 19: NativeButton (animated wrapper) ───────────────────────

describe('NativeButton (animated wrapper)', () => {
  it('renders without errors', () => {
    render(<NativeButton>Animated Button</NativeButton>)
    expect(screen.getByText('Animated Button')).toBeInTheDocument()
  })
})
