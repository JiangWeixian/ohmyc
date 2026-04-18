import type { CategoryId } from './SettingsSidebar';
import { GeneralSettings } from './GeneralSettings';

interface SettingsContentProps {
  category: CategoryId;
}

export function SettingsContent({ category }: SettingsContentProps) {
  return (
    <main className="flex-1 overflow-y-auto max-w-3xl mx-auto py-8 px-6">
      {category === 'general' ? (
        <GeneralSettings />
      ) : (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-[var(--text-tertiary)] text-sm">Coming soon</p>
        </div>
      )}
    </main>
  );
}
