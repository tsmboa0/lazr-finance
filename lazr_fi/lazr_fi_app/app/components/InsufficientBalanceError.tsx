export default function InsufficientBalanceError({
  show,
  className = "",
  message = "Insufficient balance",
}: {
  show: boolean;
  className?: string;
  message?: string;
}) {
  if (!show) return null;

  return (
    <p className={`text-xs text-red font-medium ${className}`}>
      {message}
    </p>
  );
}
