import JobTrackerModal from './JobTrackerModal';

interface Props {
  onToast: (message: string) => void;
}

export default function QuickJobTracker({ onToast }: Props) {
  return <JobTrackerModal embedded onClose={() => {}} onSuccess={onToast} />;
}
