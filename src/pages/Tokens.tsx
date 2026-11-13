import React from 'react';
import { usePageMeta } from '../hooks/usePageMeta';
import { TokenPurchaseArea } from '../components/tokens/BuyTokensModal';

export const TokensPage: React.FC = () => {
  usePageMeta(
    'Buy Tokens & Software License - Vocal Remover',
    'Purchase conversion tokens or lifetime software license code for Vocal Remover. Instant delivery via WhatsApp.'
  );

  return (
    <div className="py-4 sm:py-8">
      <TokenPurchaseArea isModal={false} />
    </div>
  );
};
