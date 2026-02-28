import clsx from 'clsx';

interface AchievementBadgesProps {
  timePunctuality: number;
  completionRate: number;
  focusMinutes: number;
  isLoading?: boolean;
}

function colorClass(value: number) {
  if (value >= 80) return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
  if (value >= 50) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
  return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
}

function SkeletonBadge() {
  return (
    <div className="flex flex-col items-center gap-0.5 animate-pulse">
      <div className="h-4 w-10 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="h-3 w-14 bg-gray-200 dark:bg-gray-700 rounded" />
    </div>
  );
}

export default function AchievementBadges({
  timePunctuality,
  completionRate,
  focusMinutes,
  isLoading = false,
}: AchievementBadgesProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-3">
        <SkeletonBadge />
        <SkeletonBadge />
        <SkeletonBadge />
      </div>
    );
  }

  const focusHours = Math.floor(focusMinutes / 60);
  const focusRemMin = focusMinutes % 60;
  const focusLabel = focusHours > 0 ? `${focusHours}h ${focusRemMin}m` : `${focusMinutes}m`;

  const badges = [
    { label: '시간 준수', value: `${Math.round(timePunctuality)}%`, score: timePunctuality },
    { label: '완료율', value: `${Math.round(completionRate)}%`, score: completionRate },
    { label: '집중 시간', value: focusLabel, score: completionRate },
  ];

  return (
    <div className="flex items-center gap-2">
      {badges.map((badge) => (
        <span
          key={badge.label}
          className={clsx(
            'inline-flex flex-col items-center px-2 py-0.5 rounded-full text-xs font-semibold',
            colorClass(badge.score)
          )}
        >
          <span>{badge.value}</span>
          <span className="font-normal opacity-80">{badge.label}</span>
        </span>
      ))}
    </div>
  );
}
