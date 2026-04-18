import { ChevronLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { MarkdownRenderer } from './MarkdownRenderer';

interface EntityDetailProps {
  title: string;
  content: string;
  onBack: () => void;
}

export function EntityDetail({ title, content, onBack }: EntityDetailProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="h-full"
    >
      <button
        onClick={onBack}
        type="button"
        className="mb-6 inline-flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1 text-[13px] font-medium text-[var(--text-secondary)] transition-smooth hover:bg-white/[0.03] hover:text-[var(--text-primary)]"
      >
        <ChevronLeft size={16} />
        <span className="text-[13px] font-medium">Back to {title}</span>
      </button>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, delay: 0.05, ease: 'easeOut' }}
        className="panel overflow-hidden p-6"
      >
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }}>
          <MarkdownRenderer content={content} />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
