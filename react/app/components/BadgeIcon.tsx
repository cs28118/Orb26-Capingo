import './BadgeIcon.css';

interface BadgeIconProps {
  icon?: string;
  lockedIcon?: string;
  title?: string;
  isUnlocked: boolean;
}

export default function BadgeIcon({ icon, lockedIcon, title, isUnlocked }: BadgeIconProps) {
  return (
    <div className="badge-item">
      <div className={`badge-icon ${isUnlocked ? 'unlocked' : 'locked'}`}>
        <img src={isUnlocked ? icon : lockedIcon} alt={title || "Badge"} />
      </div>
      <span className="badge-title">{title}</span>
    </div>
  );
}