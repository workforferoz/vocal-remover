import React from 'react';
import { usePageMeta } from '../hooks/usePageMeta';
import { SimpleVocalRemover } from '../components/vocalremover/SimpleVocalRemover';

export const Dashboard: React.FC = () => {
  usePageMeta(
    'Vocal Remover & Karaoke Maker - AI Stem Separation',
    'Extract clean instrumental karaoke tracks and isolate vocals directly on your device using local AI processing. Fast, private, and high fidelity.'
  );

  return (
    <div className="pb-8">
      {/* Primary Clean Vocal Remover Tool */}
      <SimpleVocalRemover />
    </div>
  );
};
