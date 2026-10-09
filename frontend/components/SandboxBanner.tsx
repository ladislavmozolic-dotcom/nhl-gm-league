// Fixed strip shown only on the sandbox instance (SANDBOX=1) so nobody mistakes
// the test league for the live one.
export default function SandboxBanner() {
  return (
    <div className="sticky top-0 z-[100] bg-red-600 text-white text-center text-xs font-bold tracking-wide py-1">
      TEST MODE — sandbox copy of the league. Nothing here touches the live league.
    </div>
  );
}
