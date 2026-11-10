import React from 'react';
import { useLocation } from 'react-router-dom';
import { SimpleVocalRemover } from '../components/vocalremover/SimpleVocalRemover';

export const NewSeparation: React.FC = () => {
  const location = useLocation();
  const initialFile = (location.state?.initialFile as File) || null;

  return (
    <div className="pb-16">
      <SimpleVocalRemover initialFile={initialFile} />
    </div>
  );
};
