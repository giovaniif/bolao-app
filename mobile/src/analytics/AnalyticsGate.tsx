import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { ConsentPrompt } from './ConsentPrompt';
import { identify, needsConsent, resetAnalytics, setConsent, startAnalytics, type Consent } from './analytics';

export function AnalyticsGate() {
  const { user } = useAuth();
  const [asking, setAsking] = useState(false);
  const userId = user?.id;

  useEffect(() => {
    startAnalytics()
      .then(needsConsent)
      .then((ask) => {
        setAsking(ask);
        if (userId) identify(userId);
        else resetAnalytics();
      });
  }, [userId]);

  async function choose(consent: Consent) {
    setAsking(false);
    await setConsent(consent);
    if (consent === 'granted' && userId) identify(userId);
  }

  return <ConsentPrompt visible={asking} onChoose={choose} />;
}
