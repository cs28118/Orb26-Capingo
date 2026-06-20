import './BadgeIcon.css';

export interface Badge {
  id: number | string;
  title: string;
  icon: string;
}

interface BadgeIconProps {
  badges: Badge[];
  showViewAll?: boolean;
}

export default function BadgeIcon({ badges, showViewAll = true }: BadgeIconProps) {
  return (
    <div className="badges-container">
      <div className="badges-grid">
        {badges.map((badge) => (
          <div key={badge.id} className="badge-item">
            <div className="badge-icon"><img src={badge.icon} alt={badge.title} /></div>
            <span className="badge-title">{badge.title}</span>
          </div>
        ))}
      </div>
      
      {showViewAll && (
        <button className="view-all-link">View all badges →</button>
      )}
    </div>
  );
}