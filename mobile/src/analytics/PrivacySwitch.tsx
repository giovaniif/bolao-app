import { Toggle } from '../components/Toggle';

export function PrivacySwitch({ enabled, value, onChange }: { enabled: boolean; value: boolean; onChange: (on: boolean) => void }) {
  if (!enabled) return null;
  return <Toggle label="Compartilhar dados de uso" hint="Sem seu nome ou e-mail. Ajuda a melhorar o app." value={value} onChange={onChange} />;
}
