import React from 'react';

interface AvatarIconProps {
    avatar?: string;
    className?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function AvatarIcon({ avatar, className = '', size = 'md' }: AvatarIconProps) {
    if (!avatar) {
        return <span className="text-xl">💬</span>;
    }

    const isImage = avatar.startsWith('data:image') || 
                    avatar.startsWith('http://') || 
                    avatar.startsWith('https://') || 
                    avatar.startsWith('/');

    const sizeClasses = {
        sm: 'w-6 h-6 text-sm',
        md: 'w-8 h-8 text-base',
        lg: 'w-10 h-10 text-xl',
        xl: 'w-14 h-14 text-3xl'
    };

    if (isImage) {
        return (
            <img
                src={avatar}
                alt="Avatar"
                className={`rounded-full object-cover border border-border shadow-xs ${sizeClasses[size]} ${className}`}
            />
        );
    }

    return (
        <span className={`inline-flex items-center justify-center rounded-full bg-secondary/40 shrink-0 ${sizeClasses[size]} ${className}`}>
            {avatar}
        </span>
    );
}
