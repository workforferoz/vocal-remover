import React from 'react';
import { useLocation } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { SimpleVocalRemover } from '../components/vocalremover/SimpleVocalRemover';

export const NewSeparation: React.FC = () => {
  usePageMeta(
    'New Separation - Upload & Separate Stems | Vocal Remover',
    'Upload any audio file to split vocals, instrumental accompaniment, drums, bass, and backing stems locally.'
  );

  const location = useLocation();
  const initialFile = (location.state?.initialFile as File) || null;

  return (
    <div className="pb-16">
      <SimpleVocalRemover initialFile={initialFile} />
    </div>
  );
};
