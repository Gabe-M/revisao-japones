import React from 'react';

interface ScoreBadgeProps {
    score: number;
}

export default function ScoreBadge({ score }: ScoreBadgeProps) {
    let color = '#e74c3c'; // red
    if (score >= 50) color = '#f1c40f'; // yellow
    if (score >= 80) color = '#2ecc71'; // green

    return (
        <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: color,
            color: 'white',
            fontWeight: 'bold',
            fontSize: '1.2em',
            boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
        }}>
            {score}
        </div>
    );
}
