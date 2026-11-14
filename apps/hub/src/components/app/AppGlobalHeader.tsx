import SiteDoorBar from '../layout/SiteDoorBar';

export default function AppGlobalHeader() {
  return (
    <header className="print:hidden sticky top-0 z-50 w-full shrink-0 border-b border-slate-200 bg-white">
      <SiteDoorBar />
    </header>
  );
}
