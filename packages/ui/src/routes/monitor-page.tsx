// Route page for /explore/monitor — full-bleed personal coding monitor.
// ExplorerLayout receives padded={false} at the route level so this renders
// directly inside <motion.main> without the padding shell.
import { MonitorSpikeView } from '@/components/monitor-spike/monitor-spike-view'

export function MonitorPage() {
  return <MonitorSpikeView />
}
