export function ReviewRating({ rating }: { rating: number }) {
  return (
    <span
      role="img"
      aria-label={`${rating} out of 5 stars`}
      className="text-ui-warning"
    >
      {"★".repeat(rating)}
      {"☆".repeat(5 - rating)}
    </span>
  );
}
