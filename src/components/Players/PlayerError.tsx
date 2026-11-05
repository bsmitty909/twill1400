import { AlertIcon } from '../Icons';

interface PlayerErrorProps {
  message: string;
  onRetry?: () => void;
}

export function PlayerError({ message, onRetry }: PlayerErrorProps) {
  return (
    <div className="player-error" role="alert">
      <AlertIcon size={28} />
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="player-error-retry" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
