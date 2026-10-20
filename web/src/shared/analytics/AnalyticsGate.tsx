import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { ConsentBanner } from './ConsentBanner';
import { identify, needsConsent, resetAnalytics, setConsent, startAnalytics, type Consent } from './analytics';

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;

export function AnalyticsGate() {
  const { user } = useAuth();
  const [asking, setAsking] = useState(() => needsConsent(KEY));
  const userId = user?.id;

  useEffect(() => {
    startAnalytics(KEY).then(() => {
      if (userId) identify(userId);
      else resetAnalytics();
    });
  }, [userId]);

  function choose(consent: Consent) {
    setConsent(consent);
    setAsking(false);
    if (consent === 'granted' && userId) identify(userId);
  }

  return <ConsentBanner visible={asking} onChoose={choose} />;
}
