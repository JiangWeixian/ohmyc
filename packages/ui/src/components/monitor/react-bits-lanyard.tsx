import { Lanyard } from '@/components/monitor-spike/lanyard'

export function ReactBitsLanyard() {
  return (
    <div className="size-full min-h-[520px] max-md:min-h-[420px]">
      <Lanyard position={[0, 0, 24]} gravity={[0, -40, 0]} />
    </div>
  )
}
