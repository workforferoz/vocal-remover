import React from 'react';
import { SimpleVocalRemover } from '../components/vocalremover/SimpleVocalRemover';

export const Dashboard: React.FC = () => {
  return (
    <div className="pb-8">
      {/* Primary Clean Vocal Remover Tool */}
      <SimpleVocalRemover />
    </div>
  );
};
