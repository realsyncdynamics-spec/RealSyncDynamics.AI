import React, { useState } from 'react';
import { useScanLimits } from './useScanLimits';
import { ScanLimitModal } from './ScanLimitModal';

interface ScanActionGuardProps {
  children: (canScan: boolean, onScan: () => void) => React.ReactNode;
  onScanAttempt?: (canScan: boolean) => void;
}

/**
 * Guard component that manages scan limit enforcement.
 * Wraps scan-triggering components and provides limit checking.
 *
 * Usage:
 * <ScanActionGuard>
 *   {(canScan, onScan) => (
 *     <button onClick={onScan} disabled={!canScan}>
 *       Start Scan
 *     </button>
 *   )}
 * </ScanActionGuard>
 */
export function ScanActionGuard({ children, onScanAttempt }: ScanActionGuardProps) {
  const scanLimitStatus = useScanLimits();
  const [showLimitModal, setShowLimitModal] = useState(false);

  const canScan = scanLimitStatus?.canScan ?? true; // Assume can scan for paid tiers (null status)
  const isAtLimit = scanLimitStatus?.isAtLimit ?? false;

  const handleScanAttempt = () => {
    if (isAtLimit && scanLimitStatus) {
      setShowLimitModal(true);
      onScanAttempt?.(false);
    } else {
      onScanAttempt?.(true);
    }
  };

  return (
    <>
      {children(canScan, handleScanAttempt)}
      {scanLimitStatus && (
        <ScanLimitModal
          isOpen={showLimitModal}
          onClose={() => setShowLimitModal(false)}
          limit={scanLimitStatus.limit}
          used={scanLimitStatus.used}
          remaining={scanLimitStatus.remaining}
          resetDate={scanLimitStatus.resetDate}
        />
      )}
    </>
  );
}
