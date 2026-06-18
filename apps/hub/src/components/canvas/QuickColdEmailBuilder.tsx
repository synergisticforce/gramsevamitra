import ColdEmailModal from './ColdEmailModal';

interface Props {
  onToast: (message: string) => void;
}

export default function QuickColdEmailBuilder({ onToast }: Props) {
  return <ColdEmailModal embedded onClose={() => {}} onSuccess={onToast} />;
}
