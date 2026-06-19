import { Button } from '@/components/ui/button'
import {
  NativeDialog,
  NativeDialogContent,
  NativeDialogDescription,
  NativeDialogFooter,
  NativeDialogHeader,
  NativeDialogTitle,
} from '@/components/uitripled/native-dialog'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Design System/NativeDialog',
  component: NativeDialog,
  tags: ['test', 'autodocs'],
} satisfies Meta<typeof NativeDialog>

export default meta

type Story = StoryObj<typeof meta>

export const Open: Story = {
  render: () => (
    <NativeDialog open>
      <NativeDialogContent className="bg-[var(--surface-overlay)] text-[var(--text-primary)]">
        <NativeDialogHeader>
          <NativeDialogTitle>Delete command</NativeDialogTitle>
          <NativeDialogDescription>
            This shows the dialog chrome, title, description, and footer actions.
          </NativeDialogDescription>
        </NativeDialogHeader>
        <NativeDialogFooter>
          <Button variant="ghost">Cancel</Button>
          <Button variant="destructive">Delete</Button>
        </NativeDialogFooter>
      </NativeDialogContent>
    </NativeDialog>
  ),
}
